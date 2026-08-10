/**
 * 将 Library Vault 文档向量化。
 *
 * 用户内容只读 storage/vault；AnythingLLM Document.addDocuments 仍需要
 * documents 目录下的 JSON，故把中间产物写到：
 *   storage/documents/embed-cache/<workspaceSlug>/
 * （内部缓存，listTree 不展示；已嵌入且 content_hash 未变则跳过）
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { listTree } = require("./index");
const { Document } = require("../../models/documents");
const {
  sanitizeFileName,
  isWithin,
  purgeVectorCache,
} = require("../files");
const { Library } = require("../../models/library");

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".mdx",
  ".rst",
  ".csv",
  ".html",
  ".htm",
]);

const MAX_EMBED_BYTES = 8 * 1024 * 1024;

/**
 * 分块策略版本：变更时即使 vault 文件 content_hash 不变也会强制重嵌。
 * v2: title-only 父节不入库 + pageContent 仅叶子标题正文 + section_path 元数据
 * （AnythingLLM vector-cache 按路径缓存向量；策略变了必须 purge，否则 SQL 元数据与 Lance 正文错位）
 */
const CHUNK_SCHEMA_VERSION = 2;

/** 从树结构收集所有文件节点 */
function collectFiles(node, acc = []) {
  if (!node) return acc;
  if (node.type === "file") {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node.items)) {
    for (const child of node.items) collectFiles(child, acc);
  }
  return acc;
}

function stableDocFilename(relativePath) {
  const hash = crypto
    .createHash("sha1")
    .update(relativePath.replace(/\\/g, "/"))
    .digest("hex")
    .slice(0, 12);
  const base = path.basename(relativePath).replace(/\.[^.]+$/, "");
  const safe = sanitizeFileName(base).slice(0, 48) || "note";
  return `${safe}-${hash}`;
}

/**
 * 直接从 vault 根路径读取文本（不经 editor 限制，支持 md/txt 等）
 */
function readVaultText(library, relativePath) {
  const root = path.resolve(library.rootPath);
  const normalized = path
    .normalize(String(relativePath || ""))
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[\\/]+/, "");
  const target = path.resolve(root, normalized);
  if (!isWithin(root, target)) {
    throw new Error("Path outside vault.");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error("File not found.");
  }
  const size = fs.statSync(target).size;
  if (size > MAX_EMBED_BYTES) {
    throw new Error(`文件过大（>${MAX_EMBED_BYTES} 字节），跳过`);
  }
  return fs.readFileSync(target, "utf8");
}

/** 去标题后正文过短视为「无实质正文」（可调） */
const SECTION_BODY_MIN_CHARS = 48;

/**
 * 去掉首行 # 标题后的正文
 */
function sectionBodyText(content = "") {
  const raw = String(content || "");
  const lines = raw.split("\n");
  if (!lines.length) return "";
  if (/^#{1,6}\s+/.test(lines[0])) {
    return lines.slice(1).join("\n").trim();
  }
  return raw.trim();
}

/**
 * 是否「只有标题 / 标题下几乎无正文」——不单独进向量库
 */
function isTitleOnlySection(sec) {
  if (!sec?.heading) return false;
  const body = sectionBodyText(sec.content);
  if (!body) return true;
  if (/^[\s\-*_=.#]+$/.test(body)) return true;
  if (body.length < SECTION_BODY_MIN_CHARS) return true;
  return false;
}

function headingLevelFromContent(content = "") {
  const first = String(content || "").split("\n")[0] || "";
  const m = first.match(/^(#{1,6})\s+/);
  return m ? m[1].length : 0;
}

/**
 * NotebookLM 风格：按 Markdown 标题切分；
 * - 仅标题/过短节不单独成块，路径挂到后续有正文的节
 * - 有正文的节带完整 section_path，避免空壳标题占 [1]
 *
 * @returns {{
 *   heading: string|null,
 *   content: string,
 *   start: number,
 *   end: number,
 *   sectionPath: string[],
 *   bodyCharCount: number,
 *   level: number
 * }[]}
 */
function splitMarkdownSections(content = "") {
  const text = String(content || "");
  if (!text.trim()) return [];

  const re = /^#{1,3}\s+.+$/gm;
  const matches = [...text.matchAll(re)];
  if (!matches.length) {
    return [
      {
        heading: null,
        content: text,
        start: 0,
        end: text.length,
        sectionPath: [],
        bodyCharCount: text.trim().length,
        level: 0,
      },
    ];
  }

  /** @type {{ heading: string|null, content: string, start: number, end: number, level: number }[]} */
  const raw = [];

  // 标题前的序言
  if (matches[0].index > 0) {
    const pre = text.slice(0, matches[0].index).trim();
    if (pre) {
      raw.push({
        heading: null,
        content: pre,
        start: 0,
        end: matches[0].index,
        level: 0,
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const slice = text.slice(start, end);
    const firstLine = slice.split("\n")[0] || "";
    const level = headingLevelFromContent(slice);
    raw.push({
      heading: firstLine.replace(/^#+\s+/, "").trim() || firstLine.trim(),
      content: slice.trim(),
      start,
      end,
      level: level || 2,
    });
  }

  // 无标题碎片段并入上一节
  const coalesced = [];
  for (const sec of raw) {
    if (
      coalesced.length &&
      !sec.heading &&
      sec.content.length < 80
    ) {
      const prev = coalesced[coalesced.length - 1];
      prev.content = `${prev.content}\n\n${sec.content}`.trim();
      prev.end = sec.end;
      continue;
    }
    coalesced.push({ ...sec });
  }

  // 标题层级栈 + 跳过 titleOnly，有正文的节带 sectionPath
  /** @type {{ level: number, heading: string }[]} */
  const stack = [];
  const embeddable = [];

  for (const sec of coalesced) {
    if (sec.heading) {
      const level = sec.level || 2;
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      stack.push({ level, heading: sec.heading });
    }

    const body = sectionBodyText(sec.content);
    const bodyCharCount = body.length;

    // 无标题序言：直接保留（若过短已在上面合并）
    if (!sec.heading) {
      if (!sec.content?.trim()) continue;
      embeddable.push({
        ...sec,
        sectionPath: [],
        bodyCharCount: sec.content.trim().length,
      });
      continue;
    }

    // 仅标题 / 正文过短：不单独入库（路径已在 stack，留给后续有正文的子节）
    if (isTitleOnlySection(sec)) {
      continue;
    }

    const sectionPath = stack.map((s) => s.heading);
    embeddable.push({
      ...sec,
      sectionPath,
      bodyCharCount,
    });
  }

  // 若全部被滤掉（极端：全文只有空标题），回退整篇
  if (!embeddable.length && text.trim()) {
    return [
      {
        heading: null,
        content: text,
        start: 0,
        end: text.length,
        sectionPath: [],
        bodyCharCount: text.trim().length,
        level: 0,
      },
    ];
  }

  return embeddable;
}

function contentHash(content) {
  return crypto.createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

/**
 * 写入 documents/embed-cache 下的 JSON，返回相对 documentsPath 的 location。
 * Document.addDocuments 要求 location 在 documents 根下可 resolve。
 * 用户侧知识库树只认 vault，不展示此目录。
 */
function getDocumentsPath() {
  return process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, "../../storage/documents")
    : path.resolve(
        process.env.STORAGE_DIR || path.join(__dirname, "../../storage"),
        "documents"
      );
}

/**
 * 清除某 vault 文件对应的全部 embed-cache JSON 及其 vector-cache。
 * vector-cache 按路径 digest 缓存，不按内容；分片重写后必须删，否则会装回旧向量。
 */
function purgeEmbedCacheForVaultFile(workspaceSlug, relativePath) {
  const documentsPath = getDocumentsPath();
  const folder = path.join(documentsPath, "embed-cache", workspaceSlug);
  if (!fs.existsSync(folder)) return;
  const baseName = stableDocFilename(relativePath);
  let entries = [];
  try {
    entries = fs.readdirSync(folder);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name !== `${baseName}.json` && !name.startsWith(`${baseName}-`)) continue;
    if (!name.endsWith(".json")) continue;
    const loc = `embed-cache/${workspaceSlug}/${name}`;
    try {
      purgeVectorCache(loc);
    } catch (e) {
      console.warn("[embedAll] purgeVectorCache:", loc, e.message);
    }
    const abs = path.join(folder, name);
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }
}

function writeVaultFileDocuments(workspaceSlug, relativePath, content, fileName) {
  const documentsPath = getDocumentsPath();
  const folder = path.join(documentsPath, "embed-cache", workspaceSlug);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  // 先清旧分片 + vector-cache，避免 sN 路径复用导致「SQL 是新标题、Lance 是旧空壳」
  purgeEmbedCacheForVaultFile(workspaceSlug, relativePath);

  const baseName = stableDocFilename(relativePath);
  const vaultUri = `vault://${relativePath.replace(/\\/g, "/")}`;
  const titleBase = fileName || path.basename(relativePath);
  const pageContent = typeof content === "string" ? content : "";
  const fileHash = contentHash(pageContent);
  const sections = splitMarkdownSections(pageContent);
  const locations = [];

  const writeOne = (suffix, sec) => {
    const filename = suffix ? `${baseName}-${suffix}` : baseName;
    const abs = path.join(folder, `${filename}.json`);
    const rawBody = sec.content || "";
    if (!rawBody.trim()) return;

    const sectionPath = Array.isArray(sec.sectionPath)
      ? sec.sectionPath.filter(Boolean)
      : sec.heading
        ? [sec.heading]
        : [];
    const pathLabel = sectionPath.join(" > ");
    // 叶子节标题 + 正文（与悬停/跳转高亮一致）；父路径只进元数据，不进 pageContent
    // rawBody 已是「本级 # 标题行 + 正文」（title-only 父节不会单独成块）
    const pageContentOut = rawBody;
    const leafHeading = sec.heading || sectionPath[sectionPath.length - 1] || null;
    const bodyChars =
      typeof sec.bodyCharCount === "number"
        ? sec.bodyCharCount
        : sectionBodyText(rawBody).length;

    const data = {
      id: uuidv4(),
      url: `file://${relativePath.replace(/\\/g, "/")}${suffix ? `#${suffix}` : ""}`,
      // 列表标题：文件名 · 叶子节（不用完整祖先路径，避免来源展示过长）
      title: leafHeading ? `${titleBase} · ${leafHeading}` : titleBase,
      docAuthor: "library-vault",
      description: pathLabel
        ? `Vault section: ${relativePath} / ${pathLabel}`
        : `Vault: ${relativePath}`,
      docSource: vaultUri,
      chunkSource: suffix ? `${vaultUri}#${suffix}` : vaultUri,
      published: new Date().toLocaleString(),
      wordCount: pageContentOut.split(/\s+/).filter(Boolean).length,
      pageContent: pageContentOut,
      token_count_estimate: Math.ceil(pageContentOut.length / 4),
      start_char_offset: sec.start ?? 0,
      end_char_offset: sec.end ?? rawBody.length,
      section_heading: leafHeading,
      section_path: sectionPath,
      body_char_count: bodyChars,
      parent_document: relativePath.replace(/\\/g, "/"),
      content_hash: fileHash,
      chunk_schema_version: CHUNK_SCHEMA_VERSION,
    };
    fs.writeFileSync(abs, JSON.stringify(data, null, 2), "utf8");
    // 写入前再清一次该路径 vector-cache（防御性）
    try {
      purgeVectorCache(`embed-cache/${workspaceSlug}/${filename}.json`);
    } catch {
      /* ignore */
    }
    // 相对 documents 根，供 Document.addDocuments 使用
    locations.push(`embed-cache/${workspaceSlug}/${filename}.json`);
  };

  if (sections.length <= 1) {
    const only = sections[0];
    writeOne("", {
      heading: only?.heading || null,
      content: only?.content || pageContent,
      start: only?.start ?? 0,
      end: only?.end ?? pageContent.length,
      sectionPath: only?.sectionPath || (only?.heading ? [only.heading] : []),
      bodyCharCount:
        only?.bodyCharCount ?? sectionBodyText(only?.content || pageContent).length,
    });
    return locations;
  }

  // 多节：仅有实质正文的节独立嵌入（title-only 已在 split 中剔除）
  sections.forEach((sec, i) => {
    if (!sec.content?.trim()) return;
    writeOne(`s${i}`, sec);
  });
  return locations;
}

/**
 * 对工作区知识库文件树中全部可嵌入文档做分块向量化。
 * @returns {{ embedded: string[], skipped: string[], failed: string[], errors: string[], total: number }}
 */
async function embedAllLibraryDocuments(library, workspace, userId = null) {
  const {
    beginSyncEmbed,
    endSyncEmbed,
  } = require("../EmbeddingWorkerManager");
  const slug = workspace?.slug;
  if (slug) beginSyncEmbed(slug);
  try {
    return await embedAllLibraryDocumentsInner(library, workspace, userId);
  } finally {
    if (slug) endSyncEmbed(slug);
  }
}

async function embedAllLibraryDocumentsInner(library, workspace, userId = null) {
  const tree = await listTree(library);
  const allFiles = collectFiles(tree);
  const existing = await Document.forWorkspace(workspace.id);
  const existingByDocpath = new Map(
    existing.map((d) => [d.docpath.replace(/\\/g, "/"), d])
  );
  // vault 源路径 → 已嵌入 docpath 列表（一文件可多 section）
  const vaultSourceToDocpaths = new Map();
  const addVaultMap = (vaultPath, docpath) => {
    const key = String(vaultPath || "")
      .replace(/\\/g, "/")
      .replace(/#s\d+$/i, "");
    if (!key || !docpath) return;
    if (!vaultSourceToDocpaths.has(key)) vaultSourceToDocpaths.set(key, []);
    vaultSourceToDocpaths.get(key).push(docpath.replace(/\\/g, "/"));
  };
  for (const d of existing) {
    try {
      const meta = JSON.parse(d.metadata || "{}");
      const docpath = d.docpath.replace(/\\/g, "/");
      if (typeof meta.parent_document === "string" && meta.parent_document) {
        addVaultMap(meta.parent_document, docpath);
      }
      if (
        typeof meta.docSource === "string" &&
        meta.docSource.startsWith("vault://")
      ) {
        addVaultMap(meta.docSource.slice("vault://".length), docpath);
      }
      if (
        typeof meta.chunkSource === "string" &&
        meta.chunkSource.startsWith("vault://")
      ) {
        addVaultMap(meta.chunkSource.slice("vault://".length), docpath);
      }
    } catch {
      /* ignore */
    }
  }

  const toEmbed = [];
  const toRemove = [];
  /** 本批实际嵌入的 Vault 文档路径（按文档计，非分片） */
  const sourcesToEmbed = [];
  const skipped = [];
  const failed = [];
  const errors = [];

  for (const file of allFiles) {
    const rel = (file.path || "").replace(/\\/g, "/");

    // 仅 Vault 文本
    const ext = (file.extension || path.extname(file.name || "")).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      skipped.push(rel);
      continue;
    }

    try {
      const content = readVaultText(library, rel);
      if (!content.trim()) {
        skipped.push(rel);
        continue;
      }

      const hash = contentHash(content);
      const prevList = [
        ...new Set(vaultSourceToDocpaths.get(rel) || []),
      ];

      // 已向量化且内容哈希 + 分块策略版本一致 → 跳过
      if (prevList.length > 0) {
        let unchanged = true;
        for (const p of prevList) {
          const d = existingByDocpath.get(p);
          if (!d) {
            unchanged = false;
            break;
          }
          try {
            const meta = JSON.parse(d.metadata || "{}");
            if (meta.content_hash !== hash) {
              unchanged = false;
              break;
            }
            // 旧嵌入无 chunk_schema_version，或版本落后 → 强制重嵌（并 purge vector-cache）
            if (Number(meta.chunk_schema_version) !== CHUNK_SCHEMA_VERSION) {
              unchanged = false;
              break;
            }
            // 防御：title-only 空壳不应再出现在索引里
            if (
              typeof meta.body_char_count === "number" &&
              meta.body_char_count < SECTION_BODY_MIN_CHARS &&
              meta.section_heading
            ) {
              unchanged = false;
              break;
            }
          } catch {
            unchanged = false;
            break;
          }
        }
        if (unchanged) {
          skipped.push(rel);
          continue;
        }
      }

      // 内容变了 / 策略变了 / 未嵌入：写 embed-cache（内含 purge 旧 vector-cache）并重新入库
      const locations = writeVaultFileDocuments(
        workspace.slug,
        rel,
        content,
        file.name
      );

      for (const prev of prevList) {
        toRemove.push(prev);
        try {
          purgeVectorCache(prev);
        } catch {
          /* ignore */
        }
      }
      for (const location of locations) {
        if (existingByDocpath.has(location)) toRemove.push(location);
        try {
          purgeVectorCache(location);
        } catch {
          /* ignore */
        }
        toEmbed.push(location);
      }
      sourcesToEmbed.push(rel);
    } catch (e) {
      failed.push(rel);
      errors.push(`${rel}: ${e.message}`);
    }
  }

  // 去重
  const uniqueRemove = [...new Set(toRemove)];
  const uniqueEmbed = [...new Set(toEmbed)];
  const documentCount = sourcesToEmbed.length;

  if (uniqueRemove.length > 0) {
    await Document.removeDocuments(workspace, uniqueRemove, userId);
  }

  if (uniqueEmbed.length === 0) {
    return {
      embedded: [],
      skipped,
      failed,
      errors,
      total: allFiles.length,
      documentCount: 0,
      message:
        skipped.length > 0 || allFiles.length > 0
          ? "当前文档已全部嵌入"
          : "当前没有可嵌入的文档",
    };
  }

  const {
    isNativeEmbedder,
    embedFiles,
  } = require("../EmbeddingWorkerManager");

  if (isNativeEmbedder()) {
    await embedFiles(
      workspace.slug,
      uniqueEmbed,
      workspace.id,
      userId ?? null
    );
    return {
      embedded: uniqueEmbed,
      sources: sourcesToEmbed,
      skipped,
      failed,
      errors,
      total: allFiles.length,
      documentCount,
      queued: true,
      message: `已嵌入${documentCount}个文档`,
    };
  }

  const {
    failedToEmbed = [],
    errors: embedErrors = [],
    embedded = [],
  } = await Document.addDocuments(workspace, uniqueEmbed, userId);

  if (failedToEmbed.length) {
    failed.push(...failedToEmbed);
    errors.push(...embedErrors);
  }

  // 成功嵌入后按 parent_document 标记（indexStatus 存 content_hash 便于排查）
  const byParent = new Map();
  try {
    for (const loc of embedded) {
      const d = await Document.get({
        docpath: String(loc).replace(/\\/g, "/"),
        workspaceId: workspace.id,
      });
      if (!d) continue;
      let meta = {};
      try {
        meta = JSON.parse(d.metadata || "{}");
      } catch {
        /* ignore */
      }
      if (meta.parent_document && meta.content_hash) {
        byParent.set(meta.parent_document, meta.content_hash);
      }
    }
    for (const [parent, hash] of byParent.entries()) {
      await Library.markIndexed(library, parent, hash);
    }
  } catch (e) {
    console.warn("[embedAll] markIndexed:", e.message);
  }

  const successDocCount =
    byParent.size > 0 ? byParent.size : documentCount;

  return {
    embedded,
    sources: sourcesToEmbed,
    skipped,
    failed,
    errors,
    total: allFiles.length,
    documentCount: successDocCount,
    message:
      failedToEmbed.length > 0
        ? `已嵌入${successDocCount}个文档，${failedToEmbed.length}个分片失败`
        : `已嵌入${successDocCount}个文档`,
  };
}

module.exports = {
  embedAllLibraryDocuments,
};
