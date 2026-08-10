const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
const { VAULT_ROOT, ensureLibraryRoot } = require("../utils/libraryVault");

const Library = {
  forWorkspace: async function (workspace) {
    if (!workspace?.id || !workspace?.slug)
      throw new Error("A workspace is required for a library.");

    const preferredRoot = path.join(VAULT_ROOT, workspace.slug);
    const existing = await prisma.libraries.findUnique({
      where: { workspaceId: workspace.id },
    });

    if (existing) {
      const current = path.resolve(existing.rootPath);
      const preferred = path.resolve(preferredRoot);
      if (current !== preferred) {
        await ensureLibraryRoot(preferred);
        // rootPath 变更时把旧目录内容迁到 vault/<slug>
        try {
          if (fs.existsSync(current) && current !== preferred) {
            for (const name of fs.readdirSync(current)) {
              const from = path.join(current, name);
              const to = path.join(preferred, name);
              if (!fs.existsSync(to)) fs.renameSync(from, to);
            }
          }
        } catch (e) {
          console.warn("[library] vault migrate:", e.message);
        }
        return await prisma.libraries.update({
          where: { id: existing.id },
          data: { rootPath: preferred, lastUpdatedAt: new Date() },
        });
      }
      await ensureLibraryRoot(existing.rootPath);
      return existing;
    }

    await ensureLibraryRoot(preferredRoot);
    return await prisma.libraries.create({
      data: {
        workspaceId: workspace.id,
        name: workspace.name,
        rootPath: preferredRoot,
      },
    });
  },

  /**
   * @param {object} library
   * @param {object} file - { path, name, extension, size }
   * @param {object} [extra] - sourceType, indexStatus
   */
  recordFile: async function (library, file, extra = {}) {
    const data = {
      displayName: file.name,
      extension: file.extension,
      size: file.size ?? 0,
      lastUpdatedAt: new Date(),
    };
    if (extra.sourceType) data.sourceType = extra.sourceType;
    if (extra.indexStatus) data.indexStatus = extra.indexStatus;

    return await prisma.library_files.upsert({
      where: {
        libraryId_relativePath: {
          libraryId: library.id,
          relativePath: file.path,
        },
      },
      create: {
        libraryId: library.id,
        relativePath: file.path,
        displayName: file.name,
        extension: file.extension,
        size: file.size ?? 0,
        sourceType: extra.sourceType || "vault",
        indexStatus: extra.indexStatus || "pending",
      },
      update: data,
    });
  },

  /** 标记文件已嵌入（内容哈希一致时用于跳过） */
  markIndexed: async function (library, relativePath, contentHash) {
    try {
      await prisma.library_files.updateMany({
        where: {
          libraryId: library.id,
          relativePath: relativePath.replace(/\\/g, "/"),
        },
        data: {
          indexStatus: contentHash ? `indexed:${contentHash}` : "indexed",
          lastUpdatedAt: new Date(),
        },
      });
    } catch (e) {
      console.warn("[library] markIndexed:", e.message);
    }
  },
};

module.exports = { Library };
