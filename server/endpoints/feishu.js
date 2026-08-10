const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const {
  getAuthUrl,
  exchangeCode,
  getAuthStatus,
  getUserAccessToken,
  parseKnowledgeBaseUrl,
  parseDocUrl,
  getDocxMarkdown,
  getSpaceInfo,
  getSpaceById,
  fetchAllDocs,
} = require("../utils/feishuApi");
const path = require("path");
const fs = require("fs/promises");
const { writeMarkdown } = require("../utils/libraryVault");
const { Library } = require("../models/library");

const routeGuards = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceSlug,
];

function safeFileStem(name, fallback = "document") {
  const base = String(name || fallback)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80);
  return base || fallback;
}

function feishuEndpoints(app) {
  if (!app) return;

  // ===================== OAuth 授权 =====================
  const pendingStates = new Map();

  app.get("/feishu/auth-url", routeGuards, async (_request, response) => {
    try {
      const { url, state } = getAuthUrl();
      pendingStates.set(state, Date.now());
      for (const [key, ts] of pendingStates) {
        if (Date.now() - ts > 5 * 60 * 1000) pendingStates.delete(key);
      }
      response.status(200).json({ url, state });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.get("/feishu/oauth/callback", async (request, response) => {
    try {
      const { code, state } = request.query;

      if (!code) {
        return response.status(400).send(`
            <html><body style="font-family:sans-serif;padding:40px;text-align:center">
              <h2 style="color:red">授权失败</h2>
              <p>未收到授权码，请重试。</p>
            </body></html>
          `);
      }

      if (!pendingStates.has(state)) {
        return response.status(400).send(`
            <html><body style="font-family:sans-serif;padding:40px;text-align:center">
              <h2 style="color:red">授权失败</h2>
              <p>State 验证失败（可能已过期），请重新发起授权。</p>
            </body></html>
          `);
      }
      pendingStates.delete(state);

      const redirectUri =
        process.env.FEISHU_REDIRECT_URI ||
        `http://localhost:${process.env.SERVER_PORT || 3001}/api/feishu/oauth/callback`;

      const result = await exchangeCode(code, redirectUri);

      response.status(200).send(`
          <html><body style="font-family:sans-serif;padding:40px;text-align:center">
            <h2 style="color:#3370FF">飞书授权成功!</h2>
            <p>已获得知识库读取权限</p>
            <p style="color:#666;font-size:14px">Token 有效期: ${Math.round(result.expiresIn / 3600)} 小时</p>
            <p style="color:#666;font-size:14px">范围: ${result.scope || "wiki:wiki.readonly"}</p>
            <p style="margin-top:20px;color:#999;font-size:13px">此窗口可以关闭，返回应用继续操作。</p>
          </body></html>
        `);
    } catch (error) {
      response.status(400).send(`
          <html><body style="font-family:sans-serif;padding:40px;text-align:center">
            <h2 style="color:red">授权失败</h2>
            <p>${error.message}</p>
            <p style="color:#999;font-size:13px">请检查应用配置后重试。</p>
          </body></html>
        `);
    }
  });

  app.get("/feishu/auth-status", routeGuards, async (_request, response) => {
    try {
      const status = getAuthStatus();
      response.status(200).json(status);
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  });

  // ===================== 单文档 → Vault/FeiShu/*.md =====================
  app.post(
    "/feishu/:slug/docs",
    routeGuards,
    async (request, response) => {
      try {
        const { url, title } = reqBody(request);
        if (!url) {
          return response.status(400).json({ error: "请输入飞书文档链接" });
        }

        const workspace = response.locals.workspace;
        const library = await Library.forWorkspace(workspace);

        const docToken = parseDocUrl(url);
        const markdown = await getDocxMarkdown(docToken);

        if (!markdown) {
          return response
            .status(400)
            .json({ error: "无法读取飞书文档内容，请确认链接有效且已授权。" });
        }

        const firstLine = markdown
          .split("\n")[0]
          ?.replace(/^#+\s*/, "")
          ?.trim();
        const docTitle = safeFileStem(title || firstLine || docToken, docToken);

        // 避免同名覆盖：FeiShu/标题.md、标题-2.md …
        let relativePath = path.posix.join("FeiShu", `${docTitle}.md`);
        let n = 2;
        while (true) {
          try {
            await fs.access(path.join(library.rootPath, relativePath));
            relativePath = path.posix.join("FeiShu", `${docTitle}-${n}.md`);
            n += 1;
          } catch {
            break;
          }
        }

        const file = await writeMarkdown(library, relativePath, markdown);
        await Library.recordFile(library, file, { sourceType: "feishu" });

        response.status(201).json({
          file,
          filename: file.name,
          path: file.path,
          message: `文档「${docTitle}」已导入知识库 FeiShu/`,
        });
      } catch (error) {
        console.error("飞书文档添加失败:", error);
        response.status(400).json({ error: error.message });
      }
    }
  );

  // ===================== 知识库批量导入 → Vault/FeiShu/<kbName>/ =====================
  app.post(
    "/feishu/:slug/import-kb",
    routeGuards,
    async (request, response) => {
      try {
        const { url } = reqBody(request);
        if (!url) {
          return response.status(400).json({ error: "请输入飞书知识库链接" });
        }

        const workspace = response.locals.workspace;
        const library = await Library.forWorkspace(workspace);

        const authToken = await getUserAccessToken();
        const { isSpace, token: urlToken } = parseKnowledgeBaseUrl(url);

        let spaceId, rootNodeToken, kbName;
        if (isSpace) {
          spaceId = urlToken;
          rootNodeToken = null;
          const space = await getSpaceById(spaceId);
          kbName = safeFileStem(space?.name || "飞书知识库", "飞书知识库");
        } else {
          const spaceNode = await getSpaceInfo(urlToken);
          spaceId = spaceNode.space_id;
          rootNodeToken = spaceNode.node_token;
          kbName = safeFileStem(spaceNode.title || "飞书知识库", "飞书知识库");
        }

        const docs = await fetchAllDocs(spaceId, rootNodeToken, authToken);

        if (docs.length === 0) {
          return response.status(200).json({
            success: true,
            count: 0,
            message: "知识库中没有找到可导入的文档。",
          });
        }

        let savedCount = 0;
        const files = [];
        for (const doc of docs) {
          // doc.path 相对知识库根，如 "目录/页.md"
          const rel = path.posix
            .join("FeiShu", kbName, String(doc.path || "").replace(/\\/g, "/"))
            .replace(/^\/+/, "");
          const file = await writeMarkdown(library, rel, doc.content || "");
          await Library.recordFile(library, file, { sourceType: "feishu" });
          files.push(file);
          savedCount++;
        }

        response.status(200).json({
          success: true,
          count: savedCount,
          kbName,
          files,
          message: `成功导入 ${savedCount} 篇文档到「FeiShu/${kbName}」`,
        });
      } catch (error) {
        console.error("飞书知识库导入失败:", error);
        response.status(400).json({ error: error.message });
      }
    }
  );
}

module.exports = { feishuEndpoints };
