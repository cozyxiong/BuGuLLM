const { LearningItem } = require("../models/learningItems");
const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { getLLMProvider } = require("../utils/helpers");
const { TokenManager } = require("../utils/helpers/tiktoken");
const { readFile } = require("../utils/libraryVault");
const { Library } = require("../models/library");
const {
  DEFAULT_FLASHCARD_COUNT,
  MAX_FLASHCARD_COUNT,
  DEFAULT_QUIZ_COUNT,
  MAX_QUIZ_COUNT,
  assembleContext,
  resolveLearningBudget,
  parseJsonFromResponse,
  clampCount,
  interviewQuestionsOnlyPrompt,
  quizSystemPrompt,
  mindmapSystemPrompt,
  buildUserPrompt,
  materializeQuestionStems,
  materializeFlashcards,
  materializeQuiz,
  materializeMindmap,
} = require("../utils/learning/generateCore");
const { answerInterviewQuestion } = require("../utils/learning/interviewRag");

const routeGuards = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceSlug,
];

/** 生成后预填答案的题数（其余按需生成，提升首屏速度） */
const PREFETCH_ANSWER_COUNT = 2;

async function getLibrary(response) {
  return await Library.forWorkspace(response.locals.workspace);
}

async function loadSelectedDocuments(library, body, workspace, noteBudget) {
  let paths = [];
  if (Array.isArray(body.filePaths) && body.filePaths.length) {
    paths = body.filePaths.filter(Boolean);
  } else if (body.filePath) {
    paths = [body.filePath];
  }
  if (!paths.length) throw new Error("请至少选择一份面试笔记。");

  const docs = [];
  for (const p of paths) {
    try {
      const file = await readFile(library, p);
      docs.push({
        path: p,
        name: file.name || p.split(/[/\\]/).pop(),
        content: file.content || "",
      });
    } catch (e) {
      console.warn(`[generate] 跳过 ${p}: ${e.message}`);
    }
  }
  if (!docs.length) throw new Error("无法读取所选笔记内容。");

  const tokenManager = new TokenManager(
    workspace?.chatModel || "gpt-3.5-turbo"
  );
  const assembled = assembleContext(docs, noteBudget, tokenManager);
  if (!assembled.combined.trim()) throw new Error("所选笔记内容为空。");
  return assembled;
}

async function callLLM(workspace, systemPrompt, userPrompt, maxTokens = 4096) {
  const llmProvider = getLLMProvider({
    provider: workspace?.chatProvider,
    model: workspace?.chatModel,
  });
  const result = await llmProvider.getChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.4, maxTokens }
  );
  const text = result?.textResponse || result?.content || "";
  if (!String(text).trim()) {
    console.error("[generate] LLM empty response", {
      model: workspace?.chatModel,
      provider: workspace?.chatProvider,
      maxTokens,
    });
  }
  return text;
}

function generateEndpoints(app) {
  if (!app) return;

  app.post(
    "/generate/:slug/mindmap",
    routeGuards,
    async (request, response) => {
      try {
        const body = reqBody(request);
        const { save = true } = body;
        const workspace = response.locals.workspace;
        const library = await getLibrary(response);
        const plan = resolveLearningBudget(workspace, { kind: "mindmap" });
        const { combined, paths, names, roleHints } =
          await loadSelectedDocuments(library, body, workspace, plan.noteBudget);

        const systemPrompt = mindmapSystemPrompt(roleHints);
        const userPrompt = buildUserPrompt(combined, {
          taskLine: "请根据笔记生成结构化思维导图（JSON，含 nodes）。",
          roleHints,
        });
        const llmResponse = await callLLM(
          workspace,
          systemPrompt,
          userPrompt,
          plan.outputTokens
        );
        let parsed;
        try {
          parsed = parseJsonFromResponse(llmResponse, { preferArray: false });
        } catch (e) {
          throw new Error(
            `导图解析失败：${e.message}。模型可能输出了非 JSON，请重试。`
          );
        }
        const normalized = materializeMindmap(parsed, {
          sourcePaths: paths,
          sourceNames: names,
        });

        let item = null;
        if (save === true || save === "true") {
          item = await LearningItem.create(workspace.id, {
            itemType: "mindmap",
            title: normalized.title,
            content: normalized.content,
            sourcePaths: paths,
          });
        }
        response.status(200).json({
          mindmap: normalized.content,
          item,
          nodesCount: normalized.content?.nodes?.length || 0,
        });
      } catch (error) {
        console.error("Mindmap generation error:", error);
        response.status(500).json({ error: error.message });
      }
    }
  );

  /**
   * 面试卡片（快）：
   * 1) LLM 只根据所选文档出题（不联网、不写答案）
   * 2) 入库为 pending；仅预填前 PREFETCH 道答案，其余打开卡片时再生成
   */
  app.post(
    "/generate/:slug/flashcards",
    routeGuards,
    async (request, response) => {
      try {
        const body = reqBody(request);
        const { count = DEFAULT_FLASHCARD_COUNT, save = true } = body;
        const workspace = response.locals.workspace;
        const user = response.locals.user || null;
        const library = await getLibrary(response);
        const n = clampCount(
          count,
          DEFAULT_FLASHCARD_COUNT,
          MAX_FLASHCARD_COUNT
        );
        const plan = resolveLearningBudget(workspace, {
          kind: "cards",
          count: n,
        });
        const { combined, paths, names, roleHints } =
          await loadSelectedDocuments(library, body, workspace, plan.noteBudget);

        const systemPrompt = interviewQuestionsOnlyPrompt(n, roleHints);
        const userPrompt = buildUserPrompt(combined, {
          taskLine: `根据笔记生成恰好 ${n} 道常见技术面试问题（不要答案、不要联网信息）。`,
          roleHints,
        });
        const llmResponse = await callLLM(
          workspace,
          systemPrompt,
          userPrompt,
          plan.outputTokens
        );
        const stems = materializeQuestionStems(
          parseJsonFromResponse(llmResponse, { preferArray: true }),
          { sourcePaths: paths, sourceNames: names },
          { count: n }
        );

        const sourceMeta = { sourcePaths: paths, sourceNames: names };
        const items = [];
        const prefetch = Math.min(PREFETCH_ANSWER_COUNT, stems.length);

        for (let i = 0; i < stems.length; i++) {
          const stem = stems[i];
          let back = "";
          let sources = [];
          let answerStatus = "pending";

          if (i < prefetch) {
            const ans = await answerInterviewQuestion({
              workspace,
              question: stem.front,
              user,
              selectedPaths: paths,
            });
            back = ans.text;
            sources = ans.sources;
            answerStatus = "ready";
          }

          const rawCard = {
            front: stem.front,
            back,
            tags: stem.tags,
            difficulty: stem.difficulty,
            role: stem.role || roleHints[0] || "",
            sources,
            answerMode: "rag",
            answerStatus,
            sourcePaths: paths,
            sourceNames: names,
          };

          if (save === true || save === "true") {
            const normalized = materializeFlashcards([rawCard], sourceMeta, {
              count: 1,
            })[0];
            const item = await LearningItem.create(workspace.id, {
              itemType: "flashcard",
              title: normalized.title,
              content: normalized.content,
              sourcePaths: paths,
            });
            items.push(item);
          } else {
            items.push({ content: rawCard });
          }
        }

        response.status(200).json({
          items,
          count: items.length,
          requested: n,
          truncated: items.length < n,
          prefetchedAnswers: prefetch,
          deferredAnswers: Math.max(0, items.length - prefetch),
        });
      } catch (error) {
        console.error("Flashcard generation error:", error);
        response.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/generate/:slug/quiz",
    routeGuards,
    async (request, response) => {
      try {
        const body = reqBody(request);
        const {
          count = DEFAULT_QUIZ_COUNT,
          type = "single",
          save = true,
        } = body;
        const workspace = response.locals.workspace;
        const library = await getLibrary(response);
        const n = clampCount(count, DEFAULT_QUIZ_COUNT, MAX_QUIZ_COUNT);
        const plan = resolveLearningBudget(workspace, {
          kind: "quiz",
          count: n,
        });
        const { combined, paths, names, roleHints } =
          await loadSelectedDocuments(library, body, workspace, plan.noteBudget);
        const isMulti = type === "multi" || type === "multiple";

        const systemPrompt = quizSystemPrompt(n, isMulti, roleHints);
        const userPrompt = buildUserPrompt(combined, {
          taskLine: `生成恰好 ${n} 道${isMulti ? "多选" : "单选"}测试题。只输出 JSON 数组。`,
          roleHints,
        });
        const llmResponse = await callLLM(
          workspace,
          systemPrompt,
          userPrompt,
          plan.outputTokens
        );
        const normalized = materializeQuiz(
          parseJsonFromResponse(llmResponse, { preferArray: true }),
          { sourcePaths: paths, sourceNames: names },
          { multi: isMulti, count: n }
        );

        const items = [];
        if (save === true || save === "true") {
          for (const q of normalized) {
            items.push(
              await LearningItem.create(workspace.id, {
                itemType: q.itemType,
                title: q.title,
                content: q.content,
                sourcePaths: paths,
              })
            );
          }
        }
        response.status(200).json({
          quiz: normalized.map((q) => q.content),
          items,
          requested: n,
          truncated: items.length < n,
          count: normalized.length,
        });
      } catch (error) {
        console.error("Quiz generation error:", error);
        response.status(500).json({ error: error.message });
      }
    }
  );
}

module.exports = { generateEndpoints, PREFETCH_ANSWER_COUNT };
