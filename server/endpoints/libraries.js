const { Library } = require("../models/library");
const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const {
  listTree,
  readFile,
  writeMarkdown,
  createFolder,
  deleteFile,
  importFile,
  moveFile,
  renameFile,
} = require("../utils/libraryVault");
const {
  embedAllLibraryDocuments,
} = require("../utils/libraryVault/embedAll");
const multer = require("multer");
const path = require("path");
const os = require("os");

const upload = multer({ dest: path.join(os.tmpdir(), "bagu-uploads") });

/**
 * Windows 下 multer 使用 latin1 编码存储 originalname，
 * 中文文件名会乱码，需要手动解码为 UTF-8。
 */
function decodeFilename(name) {
  if (!name) return name;
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

const routeGuards = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceSlug,
];

async function getLibrary(response) {
  return await Library.forWorkspace(response.locals.workspace);
}

function libraryEndpoints(app) {
  if (!app) return;

  app.get("/libraries/:slug", routeGuards, async (_request, response) => {
    try {
      const library = await getLibrary(response);
      // 仅 Vault 树（含 FeiShu/ 等连接器目录）；不再合并 DB 虚拟节点
      const tree = await listTree(library);
      response.status(200).json({ library, tree });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  app.get(
    "/libraries/:slug/files",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const file = await readFile(library, request.query.path);
        response.status(200).json({ file });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/libraries/:slug/files",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const { path: filePath, content = "" } = reqBody(request);
        const file = await writeMarkdown(library, filePath, content);
        const record = await Library.recordFile(library, file);
        response.status(201).json({ file: record });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.put(
    "/libraries/:slug/files",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const { path: filePath, content } = reqBody(request);
        const file = await writeMarkdown(library, filePath, content);
        const record = await Library.recordFile(library, file);
        response.status(200).json({ file: record });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.delete(
    "/libraries/:slug/files",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const { path: filePath } = reqBody(request);
        await deleteFile(library, filePath);
        response.status(200).json({ success: true });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/libraries/:slug/folders",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const { path: folderPath } = reqBody(request);
        const result = await createFolder(library, folderPath);
        response.status(201).json(result);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/libraries/:slug/import",
    routeGuards,
    upload.single("file"),
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        if (!request.file) {
          return response.status(400).json({ error: "No file uploaded." });
        }
        const targetName =
          request.body.path || decodeFilename(request.file.originalname);
        const file = await importFile(
          library,
          request.file.path,
          targetName
        );
        // Clean up temp file (multer doesn't auto-clean on Windows reliably)
        const fs = require("fs/promises");
        await fs.unlink(request.file.path).catch(() => {});
        const record = await Library.recordFile(library, file);
        response.status(201).json({ file: record });
      } catch (error) {
        console.error(error);
        response.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * 将文件树中所有已导入文档 Embedding 分块向量化（不再次导入文件）
   * POST /libraries/:slug/embed-all
   */
  app.post(
    "/libraries/:slug/embed-all",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const workspace = response.locals.workspace;
        const userId = response.locals?.user?.id ?? null;
        const result = await embedAllLibraryDocuments(
          library,
          workspace,
          userId
        );
        response.status(200).json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error("[libraries/embed-all]", error);
        response.status(500).json({
          success: false,
          error: error.message || "嵌入失败",
        });
      }
    }
  );

  /**
   * 当前工作区是否仍有嵌入任务（用于刷新后恢复按钮转圈）
   * GET /libraries/:slug/embed-status
   */
  app.get(
    "/libraries/:slug/embed-status",
    routeGuards,
    async (_request, response) => {
      try {
        const workspace = response.locals.workspace;
        const { isEmbeddingActive } = require("../utils/EmbeddingWorkerManager");
        response.status(200).json({
          active: isEmbeddingActive(workspace.slug),
        });
      } catch (error) {
        response.status(500).json({ active: false, error: error.message });
      }
    }
  );

  app.put(
    "/libraries/:slug/move",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const { source, target, before } = reqBody(request);
        const result = await moveFile(library, source, target, before || null);
        response.status(200).json(result);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.put(
    "/libraries/:slug/rename",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const { path: filePath, newName } = reqBody(request);
        if (!filePath || !newName) throw new Error("参数不完整：path 和 newName 必填。");

        const result = await renameFile(library, filePath, newName);
        response.status(200).json(result);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  // 直链文件（图片等），用于 Markdown 预览中的相对路径引用
  app.get(
    "/libraries/:slug/file/*",
    routeGuards,
    async (request, response) => {
      try {
        const library = await getLibrary(response);
        const filePath = request.params[0]; // 通配符捕获的路径
        if (!filePath) {
          return response.status(400).json({ error: "Missing file path" });
        }

        const result = await readFile(library, filePath);
        if (!result) {
          return response.status(404).json({ error: "File not found" });
        }

        // 如果是 data URL（base64），解析出原始 buffer 返回
        if (result.content?.startsWith("data:")) {
          const [header, base64] = result.content.split(",", 2);
          const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
          const buffer = Buffer.from(base64, "base64");
          response.setHeader("Content-Type", mime);
          response.setHeader("Cache-Control", "public, max-age=3600");
          return response.send(buffer);
        }

        // 纯文本文件
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.send(result.content || "");
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );
}

module.exports = { libraryEndpoints };
