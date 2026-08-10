const { extractVideoSubtitle } = require("../utils/videoSubtitle");
const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const path = require("path");
const fs = require("fs/promises");
const { writeMarkdown } = require("../utils/libraryVault");
const { Library } = require("../models/library");
const { connectorVaultFolder } = require("../utils/libraryVault/connectorFolders");

const routeGuards = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceSlug,
];

async function getLibrary(response) {
  return await Library.forWorkspace(response.locals.workspace);
}

/** bilibili → BiliBili/，youtube → YouTube/ */
function vaultFolderForPlatform(platform) {
  const key = String(platform || "").toLowerCase();
  if (key === "bilibili" || key === "youtube") {
    return connectorVaultFolder(key);
  }
  return connectorVaultFolder("video");
}

async function uniqueVaultMdPath(library, folder, titleStem) {
  let relativePath = path.posix.join(folder, `${titleStem}.md`);
  let n = 2;
  while (true) {
    try {
      await fs.access(path.join(library.rootPath, relativePath));
      relativePath = path.posix.join(folder, `${titleStem}-${n}.md`);
      n += 1;
    } catch {
      return relativePath;
    }
  }
}

function videoEndpoints(app) {
  if (!app) return;

  /**
   * 从视频链接提取字幕并保存为 Markdown 到知识库
   * Bilibili → Vault/BiliBili/，YouTube → Vault/YouTube/
   * POST /video/:slug/extract
   * Body: { url: string }
   */
  app.post(
    "/video/:slug/extract",
    routeGuards,
    async (request, response) => {
      try {
        const { url } = reqBody(request);
        if (!url) throw new Error("请输入视频链接。");

        const result = await extractVideoSubtitle(url);
        const folder = vaultFolderForPlatform(result.platform);

        const safeTitle = String(result.title || "video")
          .replace(/[\\/:*?"<>|]/g, "_")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 80) || "video";

        const library = await getLibrary(response);
        const relativePath = await uniqueVaultMdPath(
          library,
          folder,
          safeTitle
        );

        const file = await writeMarkdown(
          library,
          relativePath,
          result.markdown
        );
        const record = await Library.recordFile(library, file, {
          sourceType: result.platform || "video",
        });

        response.status(201).json({
          success: true,
          file: record,
          platform: result.platform,
          folder,
          language: result.language,
          title: result.title,
          message: `字幕已导入 ${folder}/：${result.title}`,
        });
      } catch (error) {
        console.error("[video.extract]", error.message);
        response.status(400).json({ error: error.message });
      }
    }
  );
}

module.exports = { videoEndpoints };
