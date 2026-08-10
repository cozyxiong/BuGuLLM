const fs = require("fs/promises");
const path = require("path");

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, "../../storage")
);
/**
 * BaGu 用户内容根：storage/vault（可用 BAGU_VAULT_DIR 覆盖）。
 * storage/documents 仅作 AnythingLLM Document 引擎/embed-cache 内部缓存，不进产品树。
 */
const VAULT_ROOT = path.resolve(
  process.env.BAGU_VAULT_DIR || path.join(STORAGE_ROOT, "vault")
);
const EDITABLE_EXTENSIONS = new Set([".md", ".markdown"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const MAX_NOTE_BYTES = 2 * 1024 * 1024;
const ORDER_FILENAME = ".orders.json";

/* ====== Order helpers ====== */

async function readOrders(root) {
  const orderPath = path.join(root, ORDER_FILENAME);
  try {
    const raw = await fs.readFile(orderPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeOrders(root, orders) {
  const orderPath = path.join(root, ORDER_FILENAME);
  await fs.writeFile(orderPath, JSON.stringify(orders, null, 2), "utf8");
}

/** Sort items by order map, falling back to alphabetical for unknowns */
function applyOrder(items, folderRelPath, orders) {
  const folderOrder = orders[folderRelPath];
  if (!folderOrder || !Array.isArray(folderOrder)) return items;
  const orderMap = new Map(folderOrder.map((name, i) => [name, i]));
  return [...items].sort((a, b) => {
    const ai = orderMap.has(a.name) ? orderMap.get(a.name) : 99999;
    const bi = orderMap.has(b.name) ? orderMap.get(b.name) : 99999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

/** Update order: insert sourceName before beforeName in folder's order list */
function updateOrderEntry(orders, folderRelPath, sourceName, beforeName) {
  let list = orders[folderRelPath] || [];
  list = list.filter((n) => n !== sourceName);
  if (!beforeName) {
    list.push(sourceName);
  } else {
    const idx = list.indexOf(beforeName);
    if (idx >= 0) {
      list.splice(idx, 0, sourceName);
    } else {
      list.push(sourceName);
    }
  }
  orders[folderRelPath] = list;
  return orders;
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelativePath(relativePath = "") {
  if (typeof relativePath !== "string" || relativePath.includes("\0"))
    throw new Error("A valid relative path is required.");

  const normalized = path.normalize(relativePath).replace(/^[\\/]+/, "");
  if (!normalized || normalized === "." || path.isAbsolute(relativePath))
    throw new Error("A valid relative path is required.");

  return normalized;
}

function libraryRoot(library) {
  if (!library?.rootPath) throw new Error("Library root is not configured.");
  return path.resolve(library.rootPath);
}

function resolveLibraryPath(library, relativePath) {
  const root = libraryRoot(library);
  const target = path.resolve(root, normalizeRelativePath(relativePath));
  if (!isWithin(root, target)) throw new Error("Path must stay inside the Vault.");
  return target;
}

async function ensureLibraryRoot(rootPath) {
  await fs.mkdir(rootPath, { recursive: true });
  const rootStats = await fs.lstat(rootPath);
  if (rootStats.isSymbolicLink())
    throw new Error("The configured Vault root cannot be a symbolic link.");
  return rootPath;
}

async function statSafe(targetPath) {
  try {
    return await fs.lstat(targetPath);
  } catch {
    return null;
  }
}

async function assertNoSymlinkInPath(root, target) {
  const relative = path.relative(root, target);
  let current = root;

  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stats = await statSafe(current);
    if (stats?.isSymbolicLink())
      throw new Error("Symbolic links are not supported inside the Vault.");
    if (!stats) return;
  }
}

async function listTree(library) {
  const root = libraryRoot(library);
  await ensureLibraryRoot(root);
  const orders = await readOrders(root);

  async function readFolder(folderPath, folderRelPath) {
    const children = await fs.readdir(folderPath, { withFileTypes: true });
    const items = [];

    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.isSymbolicLink()) continue;
      // 隐藏排序元数据文件
      if (child.name === ORDER_FILENAME) continue;
      const childPath = path.join(folderPath, child.name);
      const relativePath = path.relative(root, childPath).replace(/\\/g, "/");

      if (child.isDirectory()) {
        items.push({
          name: child.name,
          path: relativePath,
          type: "folder",
          items: await readFolder(childPath, relativePath),
        });
        continue;
      }

      if (!child.isFile()) continue;
      const stats = await fs.stat(childPath);
      items.push({
        name: child.name,
        path: relativePath,
        type: "file",
        extension: path.extname(child.name).toLowerCase(),
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    }

    return applyOrder(items, folderRelPath, orders);
  }

  // 仅展示 Vault；不再合并 storage/documents（AnythingLLM 旧管线）
  const vaultItems = await readFolder(root, "");

  return {
    name: library.name,
    path: "",
    type: "folder",
    items: vaultItems,
  };
}

async function readFile(library, relativePath) {
  const target = resolveLibraryPath(library, relativePath);
  await assertNoSymlinkInPath(libraryRoot(library), target);
  const stats = await statSafe(target);
  if (!stats?.isFile()) throw new Error("File not found.");

  const extension = path.extname(target).toLowerCase();

  // 图片文件：返回 base64 data URL 供前端预览
  if (IMAGE_EXTENSIONS.has(extension)) {
    const buffer = await fs.readFile(target);
    const mime = extension === ".svg" ? "image/svg+xml" : `image/${extension.slice(1).replace("jpg", "jpeg")}`;
    return {
      path: normalizeRelativePath(relativePath),
      name: path.basename(target),
      content: `data:${mime};base64,${buffer.toString("base64")}`,
      updatedAt: stats.mtime.toISOString(),
    };
  }

  if (!EDITABLE_EXTENSIONS.has(extension))
    throw new Error("Only Markdown files can be read in the editor.");

  return {
    path: normalizeRelativePath(relativePath),
    name: path.basename(target),
    content: await fs.readFile(target, "utf8"),
    updatedAt: stats.mtime.toISOString(),
  };
}

async function writeMarkdown(library, relativePath, content) {
  if (typeof content !== "string") throw new Error("Note content must be text.");
  if (Buffer.byteLength(content, "utf8") > MAX_NOTE_BYTES)
    throw new Error("Note content exceeds the 2 MB limit.");

  const target = resolveLibraryPath(library, relativePath);
  await assertNoSymlinkInPath(libraryRoot(library), target);
  const extension = path.extname(target).toLowerCase();
  if (!EDITABLE_EXTENSIONS.has(extension))
    throw new Error("Only Markdown files can be created or edited.");

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  const stats = await fs.stat(target);
  return {
    path: normalizeRelativePath(relativePath),
    name: path.basename(target),
    extension,
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
  };
}

module.exports = {
  VAULT_ROOT,
  ensureLibraryRoot,
  listTree,
  readFile,
  writeMarkdown,
  createFolder,
  deleteFile,
  importFile,
  moveFile,
  renameFile,
};

async function createFolder(library, relativePath) {
  const target = resolveLibraryPath(library, relativePath);
  await assertNoSymlinkInPath(libraryRoot(library), target);
  await fs.mkdir(target, { recursive: true });
  return { success: true, path: normalizeRelativePath(relativePath) };
}

async function deleteFile(library, relativePath) {
  const target = resolveLibraryPath(library, relativePath);
  await assertNoSymlinkInPath(libraryRoot(library), target);
  const stats = await statSafe(target);
  if (!stats) throw new Error("File not found.");
  if (stats.isDirectory()) {
    await fs.rm(target, { recursive: true, force: true });
  } else if (stats.isFile()) {
    await fs.unlink(target);
  } else {
    throw new Error("Not a valid file or folder.");
  }
  return { success: true };
}

async function importFile(library, sourcePath, relativePath) {
  const target = resolveLibraryPath(library, relativePath);
  await assertNoSymlinkInPath(libraryRoot(library), target);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(sourcePath, target);
  const stats = await fs.stat(target);
  return {
    path: normalizeRelativePath(relativePath),
    name: path.basename(target),
    extension: path.extname(target).toLowerCase(),
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
  };
}

async function moveFile(library, sourcePath, targetDir, beforeName) {
  const source = resolveLibraryPath(library, sourcePath);
  await assertNoSymlinkInPath(libraryRoot(library), source);
  const sourceStats = await statSafe(source);
  if (!sourceStats) throw new Error("Source file not found.");

  const root = libraryRoot(library);
  const targetDirAbs = targetDir ? resolveLibraryPath(library, targetDir) : root;
  const targetDirStats = await statSafe(targetDirAbs);
  if (!targetDirStats?.isDirectory()) throw new Error("Target folder not found.");

  const basename = path.basename(source);
  const sourceRelDir = path.relative(root, path.dirname(source)).replace(/\\/g, "/");
  const targetRelDir = targetDir || "";

  /** 初始化或更新某目录的排序 */
  async function applyOrderUpdate(folderRelPath, sourceName, beforeName) {
    const orders = await readOrders(root);
    let list = orders[folderRelPath];
    // 首次排序：从文件系统读取完整目录列表作为初始顺序
    if (!list || !Array.isArray(list)) {
      const folderAbs = folderRelPath ? resolveLibraryPath(library, folderRelPath) : root;
      const entries = await fs.readdir(folderAbs, { withFileTypes: true });
      list = entries
        .filter((e) => e.name !== ORDER_FILENAME && !e.isSymbolicLink())
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
    } else {
      list = [...list];
    }
    // 移除旧位置
    list = list.filter((n) => n !== sourceName);
    // 插入到新位置
    if (!beforeName) {
      list.push(sourceName);
    } else {
      const idx = list.indexOf(beforeName);
      if (idx >= 0) {
        list.splice(idx, 0, sourceName);
      } else {
        list.push(sourceName);
      }
    }
    orders[folderRelPath] = list;
    await writeOrders(root, orders);
  }

  // 同目录重排：只更新顺序，不移动文件
  if (sourceRelDir === targetRelDir) {
    if (beforeName || beforeName === null) {
      await applyOrderUpdate(targetRelDir, basename, beforeName);
    }
    return { path: sourcePath, name: basename, reordered: true };
  }

  // 跨目录移动
  const dest = path.join(targetDirAbs, basename);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(source, dest);

  // 更新目标目录的排序
  if (beforeName || beforeName === null) {
    await applyOrderUpdate(targetRelDir, basename, beforeName);
  }

  const destRelative = path.relative(libraryRoot(library), dest);
  return {
    path: normalizeRelativePath(destRelative),
    name: basename,
  };
}

async function renameFile(library, relativePath, newName) {
  const target = resolveLibraryPath(library, relativePath);
  await assertNoSymlinkInPath(libraryRoot(library), target);
  const stats = await statSafe(target);
  if (!stats) throw new Error("File not found.");

  // 去掉路径分隔符防止越级
  const safeName = newName.replace(/[\\/:*?"<>|]/g, "_");
  const parentDir = path.dirname(target);
  const newPath = path.join(parentDir, safeName);

  if (target === newPath) return { success: true, path: normalizeRelativePath(relativePath) };

  await fs.rename(target, newPath);
  const newRelative = path.relative(libraryRoot(library), newPath);
  return { success: true, path: normalizeRelativePath(newRelative), name: safeName };
}
