const { Telemetry } = require("../../models/telemetry");
const { CollectorApi } = require("../../utils/collectorApi");
const { Workspace } = require("../../models/workspace");
const {
  flexUserRoleValid,
  ROLES,
} = require("../../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../../utils/middleware/validatedRequest");
const {
  isSupportedRepoProvider,
} = require("../../utils/middleware/isSupportedRepoProviders");
const {
  importConnectorForWorkspace,
} = require("../../utils/libraryVault/importConnector");
const { reqBody } = require("../../utils/http");
const { userFromSession, multiUserMode } = require("../../utils/http");

/**
 * 若请求带 workspaceSlug，将 collector 文本结果写入 Library vault（Markdown）
 */
async function maybeImportToLibrary(request, response, connectorKey, collectorResult) {
  try {
    if (!collectorResult || collectorResult.success === false) return collectorResult;

    const body = reqBody(request) || {};
    const workspaceSlug =
      body.workspaceSlug || body.slug || request.params?.slug || null;
    if (!workspaceSlug) return collectorResult;

    const user = await userFromSession(request, response);
    const workspace = multiUserMode(response)
      ? await Workspace.getWithUser(user, { slug: workspaceSlug })
      : await Workspace.get({ slug: workspaceSlug });

    if (!workspace) {
      console.warn(`[ext] workspaceSlug=${workspaceSlug} 无效，跳过 vault 导入`);
      return collectorResult;
    }

    const importResult = await importConnectorForWorkspace(
      workspace,
      connectorKey,
      collectorResult
    );

    return {
      ...collectorResult,
      library: importResult
        ? {
            count: importResult.count,
            folder: importResult.folder,
            message:
              importResult.count > 0
                ? `已导入 ${importResult.count} 个 Markdown 到 Vault/${importResult.folder}`
                : "未找到可导入的文本内容",
          }
        : null,
    };
  } catch (e) {
    console.error(`[ext] 导入 Library vault 失败 (${connectorKey}):`, e);
    return {
      ...collectorResult,
      library: { count: 0, folder: null, error: e.message },
    };
  }
}

function extensionEndpoints(app) {
  if (!app) return;

  const roleGuard = flexUserRoleValid([ROLES.all]);

  app.post(
    "/ext/:repo_platform/branches",
    [validatedRequest, roleGuard, isSupportedRepoProvider],
    async (request, response) => {
      try {
        const { repo_platform } = request.params;
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: `/ext/${repo_platform}-repo/branches`,
            method: "POST",
            body: request.body,
          });
        response.status(200).json(responseFromProcessor);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/:repo_platform/repo",
    [validatedRequest, roleGuard, isSupportedRepoProvider],
    async (request, response) => {
      try {
        const { repo_platform } = request.params;
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: `/ext/${repo_platform}-repo`,
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: `${repo_platform}_repo`,
        });
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          repo_platform,
          responseFromProcessor
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/youtube/transcript",
    [validatedRequest, roleGuard],
    async (request, response) => {
      try {
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: "/ext/youtube-transcript",
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: "youtube_transcript",
        });
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          "youtube",
          responseFromProcessor
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/confluence",
    [validatedRequest, roleGuard],
    async (request, response) => {
      try {
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: "/ext/confluence",
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: "confluence",
        });
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          "confluence",
          responseFromProcessor
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/website-depth",
    [validatedRequest, roleGuard],
    async (request, response) => {
      try {
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: "/ext/website-depth",
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: "website_depth",
        });
        // website-depth 成功时没有 success 字段时补上
        const normalized = {
          success: responseFromProcessor?.success !== false,
          ...responseFromProcessor,
        };
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          "website-depth",
          normalized
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/drupalwiki",
    [validatedRequest, roleGuard],
    async (request, response) => {
      try {
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: "/ext/drupalwiki",
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: "drupalwiki",
        });
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          "drupalwiki",
          responseFromProcessor
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/obsidian/vault",
    [validatedRequest, roleGuard],
    async (request, response) => {
      try {
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: "/ext/obsidian/vault",
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: "obsidian_vault",
        });
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          "obsidian",
          responseFromProcessor
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/ext/paperless-ngx",
    [validatedRequest, roleGuard],
    async (request, response) => {
      try {
        const responseFromProcessor =
          await new CollectorApi().forwardExtensionRequest({
            endpoint: "/ext/paperless-ngx",
            method: "POST",
            body: request.body,
          });
        await Telemetry.sendTelemetry("extension_invoked", {
          type: "paperless_ngx",
        });
        const withLibrary = await maybeImportToLibrary(
          request,
          response,
          "paperless-ngx",
          responseFromProcessor
        );
        response.status(200).json(withLibrary);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );
}

module.exports = { extensionEndpoints };
