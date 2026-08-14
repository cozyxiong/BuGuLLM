const { LearningItem } = require("../models/learningItems");
const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { ratingToQuality } = require("../utils/sm2");
const { SystemSettings } = require("../models/systemSettings");
const { Library } = require("../models/library");
const { readFile, listTree } = require("../utils/libraryVault");
const {
  resolveLearningBudget,
} = require("../utils/learning/generateCore");

const routeGuards = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceSlug,
];

function parseItemContent(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (Array.isArray(raw)) return { nodes: raw };
  if (raw && typeof raw === "object") return { ...raw };
  return {};
}

async function applyLearningItemPatch(id, workspaceId, body = {}) {
  const item = await LearningItem.getById(id, workspaceId);
  if (!item) return null;
  const patch = {};
  if (body.title !== undefined) patch.title = String(body.title || "");
  if (body.sessionTitle !== undefined) {
    const name = String(body.sessionTitle || "").trim();
    const content = parseItemContent(item.content);
    content.sessionTitle = name;
    patch.content = content;
    if (item.itemType === "mindmap" && name && body.title === undefined) {
      patch.title = name;
    }
  }
  if (!Object.keys(patch).length) return item;
  return LearningItem.update(id, workspaceId, patch);
}

function isNoteFile(p = "") {
  return /\.(md|markdown|txt)$/i.test(String(p));
}

function collectNotePathsFromTree(node, wanted, inherited, out) {
  if (!node) return;
  const rel = String(node.path || "").replace(/\\/g, "/");
  const selected = inherited || wanted.has(rel);
  if (node.type === "file") {
    if (selected && isNoteFile(rel || node.name)) out.add(rel);
    return;
  }
  for (const child of node.items || []) {
    collectNotePathsFromTree(child, wanted, selected, out);
  }
}

async function countSelectedNoteChars(library, filePaths = []) {
  const wanted = new Set(
    (filePaths || []).map((p) => String(p || "").replace(/\\/g, "/")).filter(Boolean)
  );
  const files = new Set();
  if (wanted.size) {
    try {
      const tree = await listTree(library);
      collectNotePathsFromTree(tree, wanted, false, files);
    } catch {
      /* 树读失败时退回逐个读 */
    }
    for (const p of wanted) {
      if (isNoteFile(p)) files.add(p);
    }
  }

  let usedChars = 0;
  for (const p of files) {
    try {
      const file = await readFile(library, p);
      usedChars += Array.from(String(file.content || "")).length;
    } catch (e) {
      console.warn(`[learning] 字数统计跳过 ${p}: ${e.message}`);
    }
  }
  return usedChars;
}

function srSettingKey(workspaceId) {
  return `learning_sr_enabled_ws_${workspaceId}`;
}

async function isSpacedRepetitionEnabled(workspaceId) {
  const val = await SystemSettings.getValueOrFallback(
    { label: srSettingKey(workspaceId) },
    "false"
  );
  return val === true || val === "true" || val === "1";
}

function learningEndpoints(app) {
  if (!app) return;

  app.get(
    "/learning/:slug/settings",
    routeGuards,
    async (_request, response) => {
      try {
        const spacedRepetitionEnabled = await isSpacedRepetitionEnabled(
          response.locals.workspace.id
        );
        response.status(200).json({ settings: { spacedRepetitionEnabled } });
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  app.put(
    "/learning/:slug/settings",
    routeGuards,
    async (request, response) => {
      try {
        const workspaceId = response.locals.workspace.id;
        const { spacedRepetitionEnabled } = reqBody(request);
        const on =
          spacedRepetitionEnabled === true ||
          spacedRepetitionEnabled === "true";
        await SystemSettings._updateSettings({
          [srSettingKey(workspaceId)]: on ? "true" : "false",
        });
        response.status(200).json({
          settings: { spacedRepetitionEnabled: on },
        });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  // List learning items
  app.get(
    "/learning/:slug/items",
    routeGuards,
    async (request, response) => {
      try {
        const {
          itemType,
          type,
          reviewState,
          limit,
          offset,
        } = request.query;
        const result = await LearningItem.list(
          response.locals.workspace.id,
          {
            itemType: itemType || type,
            reviewState,
            limit: Number(limit) || 50,
            offset: Number(offset) || 0,
          }
        );
        response.status(200).json(result);
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  // Mindmaps list shortcut
  app.get(
    "/learning/:slug/mindmaps",
    routeGuards,
    async (request, response) => {
      try {
        const items = await LearningItem.getMindmaps(
          response.locals.workspace.id,
          Number(request.query.limit) || 30
        );
        response.status(200).json({ items });
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  // Get due / practice queue
  app.get(
    "/learning/:slug/due",
    routeGuards,
    async (request, response) => {
      try {
        const workspaceId = response.locals.workspace.id;
        const srEnabled = await isSpacedRepetitionEnabled(workspaceId);
        const items = await LearningItem.getDueReviews(workspaceId, {
          limit: Number(request.query.limit) || 40,
          practiceMode: !srEnabled,
        });
        response.status(200).json({
          items,
          spacedRepetitionEnabled: srEnabled,
          mode: srEnabled ? "spaced" : "practice",
        });
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  // Trash
  app.get(
    "/learning/:slug/trash",
    routeGuards,
    async (request, response) => {
      try {
        const items = await LearningItem.getTrash(
          response.locals.workspace.id
        );
        response.status(200).json({ items });
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  app.get(
    "/learning/:slug/items/:id",
    routeGuards,
    async (request, response) => {
      try {
        const item = await LearningItem.getById(
          Number(request.params.id),
          response.locals.workspace.id
        );
        if (!item)
          return response.status(404).json({ error: "Item not found." });
        response.status(200).json({ item });
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/learning/:slug/items",
    routeGuards,
    async (request, response) => {
      try {
        const data = reqBody(request) || {};
        if (data.id != null && (data.sessionTitle !== undefined || data.title !== undefined)) {
          const updated = await applyLearningItemPatch(
            Number(data.id),
            response.locals.workspace.id,
            data
          );
          if (!updated)
            return response.status(404).json({ error: "Item not found." });
          return response.status(200).json({ item: updated });
        }
        const item = await LearningItem.create(
          response.locals.workspace.id,
          data
        );
        response.status(201).json({ item });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * 按需为闪卡生成 RAG 答案（打开/翻转时调用）。
   * 已有 ready 答案则直接返回，避免重复消耗。
   */
  app.post(
    "/learning/:slug/items/:id/ensure-answer",
    routeGuards,
    async (request, response) => {
      try {
        const workspace = response.locals.workspace;
        const user = response.locals.user || null;
        const id = Number(request.params.id);
        const item = await LearningItem.getById(id, workspace.id);
        if (!item)
          return response.status(404).json({ error: "Item not found." });
        if (item.itemType !== "flashcard") {
          return response
            .status(400)
            .json({ error: "Only flashcards support ensure-answer." });
        }

        const content =
          typeof item.content === "object" && item.content
            ? { ...item.content }
            : {};
        const hasBack = String(content.back || "").trim().length > 0;
        const hasSources =
          Array.isArray(content.sources) && content.sources.length > 0;
        // 已有答案且带来源：直接缓存返回；缺来源则补跑 RAG
        if (content.answerStatus === "ready" && hasBack && hasSources) {
          return response.status(200).json({ item, cached: true });
        }

        const question = String(
          content.front || content.question || item.title || ""
        ).trim();
        if (!question) {
          return response.status(400).json({ error: "卡片没有问题文本。" });
        }

        const { answerInterviewQuestion } = require("../utils/learning/interviewRag");
        const selectedPaths = Array.isArray(content.sourcePaths)
          ? content.sourcePaths
          : [];
        const { text, sources } = await answerInterviewQuestion({
          workspace,
          question,
          user,
          selectedPaths,
        });

        const nextContent = {
          ...content,
          back: text,
          sources,
          answerMode: "rag",
          answerStatus: "ready",
          ...(content.sessionTitle
            ? { sessionTitle: content.sessionTitle }
            : {}),
        };
        const updated = await LearningItem.update(id, workspace.id, {
          content: nextContent,
        });
        response.status(200).json({ item: updated, cached: false });
      } catch (error) {
        console.error("ensure-answer error:", error);
        response.status(500).json({ error: error.message });
      }
    }
  );

  // Review: always records event; SM-2 updates interval/nextReviewAt
  app.post(
    "/learning/:slug/review",
    routeGuards,
    async (request, response) => {
      try {
        const { itemId, rating } = reqBody(request);
        if (itemId == null || rating == null) {
          return response
            .status(400)
            .json({ error: "itemId and rating are required." });
        }
        const quality =
          typeof rating === "number"
            ? rating
            : ratingToQuality(String(rating));
        const label =
          typeof rating === "string" ? rating : String(rating);
        const item = await LearningItem.review(
          Number(itemId),
          response.locals.workspace.id,
          quality,
          label
        );
        response.status(200).json({ item });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/learning/:slug/trash",
    routeGuards,
    async (request, response) => {
      try {
        const { itemId } = reqBody(request);
        await LearningItem.moveToTrash(
          Number(itemId),
          response.locals.workspace.id
        );
        response.status(200).json({ success: true });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/learning/:slug/restore",
    routeGuards,
    async (request, response) => {
      try {
        const { itemId } = reqBody(request);
        await LearningItem.restore(
          Number(itemId),
          response.locals.workspace.id
        );
        response.status(200).json({ success: true });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  async function updateLearningItem(request, response) {
    const id = Number(request.params.id);
    const body = reqBody(request) || {};
    const updated = await applyLearningItemPatch(
      id,
      response.locals.workspace.id,
      body
    );
    if (!updated)
      return response.status(404).json({ error: "Item not found." });
    response.status(200).json({ item: updated });
  }

  app.post(
    "/learning/:slug/rename",
    routeGuards,
    async (request, response) => {
      try {
        const body = reqBody(request) || {};
        const ids = (Array.isArray(body.itemIds) ? body.itemIds : [body.itemId])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));
        if (!ids.length)
          return response.status(400).json({ error: "缺少要重命名的记录。" });
        const workspaceId = response.locals.workspace.id;
        const items = [];
        for (const id of ids) {
          const updated = await applyLearningItemPatch(id, workspaceId, body);
          if (updated) items.push(updated);
        }
        if (!items.length)
          return response.status(404).json({ error: "Item not found." });
        response.status(200).json({ items, success: true });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/learning/:slug/items/:id/update",
    routeGuards,
    async (request, response) => {
      try {
        await updateLearningItem(request, response);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.put(
    "/learning/:slug/items/:id",
    routeGuards,
    async (request, response) => {
      try {
        await updateLearningItem(request, response);
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/learning/:slug/items/batch-delete",
    routeGuards,
    async (request, response) => {
      try {
        const body = reqBody(request) || {};
        const ids = (Array.isArray(body.itemIds) ? body.itemIds : [body.itemId])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));
        if (!ids.length)
          return response.status(400).json({ error: "缺少要删除的记录。" });
        const result = await LearningItem.deleteMany(
          ids,
          response.locals.workspace.id
        );
        response.status(200).json({
          success: true,
          count: result?.count ?? ids.length,
        });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.delete(
    "/learning/:slug/items/:id",
    routeGuards,
    async (request, response) => {
      try {
        await LearningItem.delete(
          Number(request.params.id),
          response.locals.workspace.id
        );
        response.status(200).json({ success: true });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );

  app.post(
    "/learning/:slug/context-budget",
    routeGuards,
    async (request, response) => {
      try {
        const { filePaths, kind, count } = reqBody(request);
        const workspace = response.locals.workspace;
        const { noteBudget, windowTokens } = resolveLearningBudget(workspace, {
          kind,
          count,
        });
        const budget = noteBudget;
        const paths = Array.isArray(filePaths)
          ? filePaths.filter(Boolean)
          : [];
        let usedChars = 0;
        if (paths.length) {
          const library = await Library.forWorkspace(workspace);
          usedChars = await countSelectedNoteChars(library, paths);
        }
        response.status(200).json({
          usedChars,
          budgetChars: budget,
          windowTokens,
          over: usedChars > budget,
        });
      } catch (error) {
        response.status(500).json({ error: error.message });
      }
    }
  );

  app.delete(
    "/learning/:slug/trash",
    routeGuards,
    async (_request, response) => {
      try {
        await LearningItem.emptyTrash(response.locals.workspace.id);
        response.status(200).json({ success: true });
      } catch (error) {
        response.status(400).json({ error: error.message });
      }
    }
  );
}

module.exports = { learningEndpoints };
