/**
 * 面试学习生成核心
 * - 卡片：LLM 只出「题」；答案走 RAG（见 interviewRag）
 * - 测试题 / 导图：仍一次性结构化生成
 * - 框架负责读笔记、截断、解析、校验；数量按用户请求
 */

const {
  normalizeFlashcard,
  normalizeQuiz,
  normalizeMindmap,
} = require("./contentSchema");

const DEFAULT_FLASHCARD_COUNT = 15;
const MAX_FLASHCARD_COUNT = 50;
const DEFAULT_QUIZ_COUNT = 10;
const MAX_QUIZ_COUNT = 30;
const SYSTEM_RESERVE_TOKENS = 800;
const MIN_NOTE_TOKENS = 800;
const FALLBACK_MIN_OUTPUT = 2048;
const MAX_NOTE_WINDOW_RATIO = 0.6;

const LOCAL_LLM_PROVIDERS = new Set([
  "ollama",
  "lmstudio",
  "localai",
  "koboldcpp",
  "foundry",
  "docker-model-runner",
  "lemonade",
  "textgenwebui",
  "privatemode",
]);

const THINKING_CONSTRAINT =
  "Reason only as much as necessary to verify correctness. Do not use reasoning to draft the final questions or repeat source content.";

const NOTE_LANGUAGE_CONSTRAINT =
  "Follow the language of the notes. Write all user-facing text (questions, options, explanations, titles, labels, answers) in the same language as the source notes. Keep JSON keys in English.";

function isLocalOrSmallModel(workspace, windowSize) {
  const provider = String(
    workspace?.chatProvider || process.env.LLM_PROVIDER || ""
  ).toLowerCase();
  if (LOCAL_LLM_PROVIDERS.has(provider)) return true;
  return Number(windowSize) > 0 && Number(windowSize) <= 16384;
}

function readModelWindow(workspace) {
  let windowSize = 8192;
  try {
    const { getLLMProvider } = require("../helpers");
    const llm = getLLMProvider({
      provider: workspace?.chatProvider,
      model: workspace?.chatModel,
    });
    const limit = Number(llm?.promptWindowLimit?.());
    if (Number.isFinite(limit) && limit > 0) windowSize = limit;
  } catch (e) {
    console.warn(`[generate] 读取模型窗口失败，回落 ${windowSize}:`, e.message);
  }
  return windowSize;
}

/** 题目 JSON 本身需要的输出（不含思考）；上限由模型输出窗口再截 */
function taskOutputNeed(kind, count) {
  const n = Math.max(1, Number(count) || 1);
  if (kind === "quiz") return 1600 + n * 800;
  if (kind === "cards" || kind === "flashcards") return 600 + n * 160;
  return 5120;
}

/** 当前模型自己的输出上限；读不到返回 null */
function readModelOutputCap(workspace) {
  const provider = workspace?.chatProvider || process.env.LLM_PROVIDER;
  const model = workspace?.chatModel;
  try {
    const { getLLMProvider } = require("../helpers");
    const llm = getLLMProvider({ provider, model });
    if (typeof llm.maxOutputLimit === "function") {
      const n = Number(llm.maxOutputLimit());
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch (e) {
    console.warn("[generate] 读取模型输出上限失败:", e.message);
  }
  try {
    const { MODEL_MAP } = require("../AiProviders/modelMap");
    const mapped = MODEL_MAP.getOutput(provider, model);
    if (mapped) return mapped;
  } catch {
    /* ignore */
  }
  return null;
}

function thinkingReserve(windowSize, kind, workspace) {
  const compact = isLocalOrSmallModel(workspace, windowSize);
  if (compact) {
    const floor = kind === "mindmap" ? 512 : 768;
    return Math.min(2048, Math.max(floor, Math.floor(windowSize * 0.08)));
  }
  const floor = kind === "mindmap" ? 1536 : 2560;
  return Math.min(8192, Math.max(floor, Math.floor(windowSize * 0.15)));
}

function outputReserveForKind(kind, count) {
  return taskOutputNeed(kind, count);
}

/**
 * 先锁思考+出题输出，再用剩下的装笔记。
 * 传给接口的 max_tokens = 思考 + JSON，避免思考把题目截断。
 */
function resolveLearningBudget(workspace, { kind = "cards", count } = {}) {
  const windowTokens = readModelWindow(workspace);
  const modelOutCap = readModelOutputCap(workspace);
  const jsonNeed = taskOutputNeed(kind, count);
  let think = thinkingReserve(windowTokens, kind, workspace);

  const minInput = SYSTEM_RESERVE_TOKENS + MIN_NOTE_TOKENS;
  const remainInWindow = Math.max(1, windowTokens - minInput);
  const modelCeiling =
    Number.isFinite(modelOutCap) && modelOutCap > 0
      ? modelOutCap
      : remainInWindow;
  const maxCompletion = Math.max(1, Math.min(modelCeiling, remainInWindow));
  const outputFloor = Math.min(FALLBACK_MIN_OUTPUT, maxCompletion);

  let completionCap = jsonNeed + think;
  if (completionCap > maxCompletion) {
    const overflow = completionCap - maxCompletion;
    const thinkFloor = isLocalOrSmallModel(workspace, windowTokens)
      ? 512
      : 1024;
    think = Math.max(thinkFloor, think - overflow);
    completionCap = Math.min(maxCompletion, jsonNeed + think);
  }
  completionCap = Math.max(outputFloor, Math.min(completionCap, maxCompletion));

  const noteBudget = Math.max(
    MIN_NOTE_TOKENS,
    Math.min(
      Math.floor(windowTokens * MAX_NOTE_WINDOW_RATIO),
      windowTokens - SYSTEM_RESERVE_TOKENS - completionCap
    )
  );

  return {
    noteBudget,
    budget: noteBudget,
    outputTokens: completionCap,
    jsonNeed,
    thinkReserve: think,
    windowTokens,
    modelOutCap: Number.isFinite(modelOutCap) ? modelOutCap : null,
  };
}

/** @deprecated 请用 resolveLearningBudget */
function noteTokenBudget(workspace, outputReserveOrOpts = 4096) {
  if (outputReserveOrOpts && typeof outputReserveOrOpts === "object") {
    return resolveLearningBudget(workspace, outputReserveOrOpts);
  }
  const planned = resolveLearningBudget(workspace, { kind: "mindmap" });
  const extra = Math.max(0, Number(outputReserveOrOpts) || 0);
  return {
    budget: Math.max(
      MIN_NOTE_TOKENS,
      Math.min(planned.noteBudget, planned.windowTokens - extra - SYSTEM_RESERVE_TOKENS)
    ),
    windowTokens: planned.windowTokens,
  };
}

function inferRoleHints(paths = [], names = []) {
  const blob = [...paths, ...names].join(" ").toLowerCase();
  const hits = [];
  const rules = [
    [/java|jvm|spring|mybatis|gc/, "Java 后端"],
    [/go|golang|gin/, "Go 后端"],
    [/python|django|flask|fastapi/, "Python 后端"],
    [/前端|react|vue|typescript|javascript|css/, "前端"],
    [/android|kotlin/, "Android"],
    [/ios|swift/, "iOS"],
    [/算法|leetcode|数据结构/, "算法"],
    [/机器学习|深度学习|llm|大模型|nlp|cv/, "算法 / AI"],
    [/运维|k8s|docker|devops|sre/, "运维 / SRE"],
    [/测试|qa/, "测试"],
    [/数据库|mysql|redis|kafka/, "后端 / 中间件"],
    [/八股|面试/, "技术综合面试"],
  ];
  for (const [re, label] of rules) {
    if (re.test(blob) && !hits.includes(label)) hits.push(label);
  }
  return hits.slice(0, 3);
}

function sliceToTokens(text, tokenManager, maxTokens) {
  const raw = String(text || "");
  if (!tokenManager || maxTokens <= 0) return "";
  const tokens = tokenManager.tokensFromString(raw);
  if (tokens.length <= maxTokens) return raw;
  return tokenManager.bytesFromTokens(tokens.slice(0, maxTokens));
}

/** 均分预算，用不完的名额补给还没塞满的篇 */
function allocateTokens(sizes, budget) {
  const n = sizes.length;
  const alloc = new Array(n).fill(0);
  if (n === 0 || budget <= 0) return alloc;

  let left = budget;
  let pending = sizes.map((need, i) => ({ i, need: Math.max(0, need) }));

  while (left > 0 && pending.length) {
    const share = Math.max(1, Math.floor(left / pending.length));
    const next = [];
    for (const p of pending) {
      if (left <= 0) {
        next.push(p);
        continue;
      }
      const give = Math.min(share, p.need, left);
      alloc[p.i] += give;
      left -= give;
      if (p.need - give > 0) next.push({ i: p.i, need: p.need - give });
    }
    if (next.length === pending.length) {
      for (const p of next) {
        if (left <= 0) break;
        alloc[p.i] += 1;
        left -= 1;
      }
      break;
    }
    pending = next;
  }
  return alloc;
}

/**
 * 按 token 预算组装笔记。未超窗则全文；超窗则按篇均分抽样，避免只吃到前几篇。
 */
function assembleContext(docs = [], maxTokens, tokenManager) {
  const items = [];
  for (const doc of docs) {
    if (!doc) continue;
    const name = doc.name || doc.path || "doc";
    const path = doc.path || name;
    const body = String(doc.content || "");
    if (!body.trim()) continue;
    const header = `\n\n===== 笔记: ${name} | 路径: ${path} =====\n`;
    const headerTokens = tokenManager
      ? tokenManager.countFromString(header)
      : header.length;
    const bodyTokens = tokenManager
      ? tokenManager.countFromString(body)
      : body.length;
    items.push({
      name,
      path,
      header,
      body,
      headerTokens,
      bodyTokens,
      totalTokens: headerTokens + bodyTokens,
    });
  }

  const totalBefore = items.reduce((s, it) => s + it.totalTokens, 0);
  const budget = Math.max(0, Number(maxTokens) || 0);
  const needSample = budget > 0 && totalBefore > budget;
  const alloc = needSample
    ? allocateTokens(
        items.map((it) => it.totalTokens),
        budget
      )
    : items.map((it) => it.totalTokens);

  const parts = [];
  const paths = [];
  const names = [];
  let forwarded = 0;
  let truncated = false;

  items.forEach((it, i) => {
    const cap = alloc[i] || 0;
    if (cap <= it.headerTokens + 8) {
      truncated = true;
      return;
    }
    let body = it.body;
    const bodyCap = cap - it.headerTokens;
    if (it.bodyTokens > bodyCap) {
      body = sliceToTokens(it.body, tokenManager, bodyCap);
      if (!tokenManager) body = it.body.slice(0, bodyCap);
      body += "\n\n[该篇后续已截断，请优先覆盖已给出的考点]";
      truncated = true;
    }
    const chunk = it.header + body;
    parts.push(chunk);
    paths.push(it.path);
    names.push(it.name);
    forwarded += tokenManager
      ? tokenManager.countFromString(chunk)
      : chunk.length;
  });

  return {
    combined: parts.join(""),
    paths,
    names,
    truncated,
    sampled: needSample,
    totalCharsBeforeCap: totalBefore,
    forwardedChars: forwarded,
    roleHints: inferRoleHints(paths, names),
  };
}

/**
 * 截取从 start 起第一个括号平衡的 JSON 片段（忽略字符串内括号）。
 * 解决 "Unexpected non-whitespace character after JSON" —— 模型在 JSON 后追加说明。
 * 对 `{` / `[` 分别计栈，正确处理嵌套。
 */
function extractBalancedJsonSlice(s, start) {
  if (start < 0 || start >= s.length) return null;
  const open0 = s[start];
  if (open0 !== "{" && open0 !== "[") return null;
  const stack = [open0];
  let inString = false;
  let escape = false;

  for (let i = start + 1; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      const top = stack[stack.length - 1];
      if ((ch === "}" && top === "{") || (ch === "]" && top === "[")) {
        stack.pop();
        if (stack.length === 0) return s.slice(start, i + 1);
      }
      // 括号不匹配时继续扫，避免过早失败
    }
  }
  return null;
}

/**
 * 从被截断的 JSON 数组里捞出已经写完整的元素，丢掉最后半截。
 */
function extractCompleteArrayItems(s, start) {
  if (start < 0 || start >= s.length || s[start] !== "[") return null;
  const items = [];
  let i = start + 1;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length || s[i] === "]") break;
    if (s[i] !== "{" && s[i] !== "[") break;
    const slice = extractBalancedJsonSlice(s, i);
    if (!slice) break;
    const parsed = tryParseJson(slice);
    if (parsed == null) break;
    items.push(parsed);
    i += slice.length;
  }
  return items.length ? items : null;
}

function tryParseJson(candidate) {
  if (!candidate || typeof candidate !== "string") return null;
  const s = candidate.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    /* try repair */
  }
  try {
    const { jsonrepair } = require("jsonrepair");
    // jsonrepair 对 trailing text 通常能修好；仍可能抛 “after JSON”
    const repaired = jsonrepair(s);
    return JSON.parse(repaired);
  } catch {
    /* fall through */
  }
  // 再试：只取首个平衡片段后 repair
  try {
    const slice = extractBalancedJsonSlice(s, 0);
    if (!slice || slice === s) return null;
    const { jsonrepair } = require("jsonrepair");
    return JSON.parse(jsonrepair(slice));
  } catch {
    return null;
  }
}

/** 从对象包装中取出题目/节点数组 */
function unwrapJsonPayload(parsed) {
  if (parsed == null) return parsed;
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed !== "object") return parsed;

  const preferKeys = [
    "questions",
    "quiz",
    "items",
    "data",
    "list",
    "result",
    "cards",
    "flashcards",
    "nodes",
    "stems",
  ];
  for (const k of preferKeys) {
    if (Array.isArray(parsed[k]) && parsed[k].length) return parsed[k];
  }
  const arrVals = Object.values(parsed).filter(
    (v) => Array.isArray(v) && v.length > 0
  );
  if (arrVals.length === 1) return arrVals[0];
  return parsed;
}

/**
 * 收集正文中所有可解析的完整 JSON 值，优先返回「题目数组」。
 * 避免先命中短对象 `{"ok":true}` 而丢掉后面的真正数组。
 */
function collectAndPickJson(raw, { preferArray = true } = {}) {
  if (!raw) return null;
  const found = [];
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch !== "{" && ch !== "[") {
      i++;
      continue;
    }
    const slice = extractBalancedJsonSlice(raw, i);
    if (!slice) {
      if (ch === "[") {
        const partial = extractCompleteArrayItems(raw, i);
        if (partial) {
          found.push({
            parsed: partial,
            slice: raw.slice(i),
            start: i,
            len: raw.length - i,
          });
          break;
        }
      }
      i++;
      continue;
    }
    const parsed = tryParseJson(slice);
    if (parsed != null) {
      found.push({ parsed, slice, start: i, len: slice.length });
      i += slice.length;
      continue;
    }
    i++;
  }
  if (!found.length) {
    // 整段再试一次（含 trailing text / 未闭合数组的 repair）
    const repaired = tryParseJson(raw);
    if (repaired != null) return repaired;
    const startSq = raw.indexOf("[");
    const startObj = raw.indexOf("{");
    const start =
      startSq < 0 ? startObj : startObj < 0 ? startSq : Math.min(startSq, startObj);
    if (start >= 0) {
      if (raw[start] === "[") {
        const partial = extractCompleteArrayItems(raw, start);
        if (partial) return partial;
      }
      return tryParseJson(raw.slice(start));
    }
    return null;
  }

  if (preferArray) {
    // 1) 直接数组，取最长
    const arrays = found
      .filter((f) => Array.isArray(f.parsed) && f.parsed.length > 0)
      .sort((a, b) => b.parsed.length - a.parsed.length || b.len - a.len);
    if (arrays.length) return arrays[0].parsed;

    // 2) 对象包装里的数组
    for (const f of found.sort((a, b) => b.len - a.len)) {
      const u = unwrapJsonPayload(f.parsed);
      if (Array.isArray(u) && u.length) return u;
    }
  }

  // 3) 最大片段
  found.sort((a, b) => b.len - a.len);
  return unwrapJsonPayload(found[0].parsed);
}

function stripModelNoise(text) {
  let cleaned = String(text || "");
  // 成对 think / reasoning
  cleaned = cleaned
    .replace(
      /<(thinking|think|thought|thought_chain|reasoning)[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    .replace(/```(?:thinking|reasoning)[\s\S]*?```/gi, "");

  // 未闭合 think：只剥到下一个 JSON 起点，避免把 JSON 一并删掉
  cleaned = cleaned.replace(
    /<(thinking|think|thought|thought_chain|reasoning)[^>]*>[\s\S]*?(?=[[{])/gi,
    ""
  );
  // 仍残留的开标签
  cleaned = cleaned.replace(
    /<\/?(thinking|think|thought|thought_chain|reasoning)[^>]*>/gi,
    ""
  );

  return cleaned
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function parseJsonFromResponse(text, opts = {}) {
  if (!text || typeof text !== "string") throw new Error("LLM 返回为空。");
  const preferArray = opts.preferArray !== false;
  const cleaned = stripModelNoise(text);
  if (!cleaned) {
    throw new Error(
      "模型没有返回题目（思考过程占满了输出）。请重试，或换非思考模型。"
    );
  }

  // 优先 ```json ... ``` 代码块
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  const fenceBodies = [];
  let fm;
  while ((fm = fenceRe.exec(cleaned)) !== null) {
    if (fm[1]?.trim()) fenceBodies.push(fm[1].trim());
  }

  const bodies = [...fenceBodies, cleaned];
  let lastErr = null;

  for (const body of bodies) {
    try {
      const picked = collectAndPickJson(body, { preferArray });
      if (picked != null) return picked;
    } catch (e) {
      lastErr = e;
    }
  }

  const hint = lastErr?.message ? `（${lastErr.message}）` : "";
  const preview = cleaned.slice(0, 280).replace(/\s+/g, " ");
  console.error(
    "[generate] JSON parse failed. chars=",
    cleaned.length,
    "preview=",
    cleaned.slice(0, 1500)
  );
  throw new Error(
    `无法解析模型返回的 JSON，多半是输出被截断或夹了思考过程。请重试。${hint} 片段：${preview}`
  );
}

function clampCount(n, def, max) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return def;
  return Math.min(Math.floor(v), max);
}

/**
 * 只出题：不生成答案（答案由 RAG 填充）—— 极省输出 token
 */
function interviewQuestionsOnlyPrompt(count, roleHints = []) {
  const roleLine = roleHints.length
    ? `笔记偏向：${roleHints.join("、")}。按该方向常见面试出题。`
    : `根据笔记主题判断岗位方向，按该方向常见面试出题。`;

  return `你是资深技术面试官。${roleLine}
${NOTE_LANGUAGE_CONSTRAINT}
只根据下方笔记生成常见面试问题，不要搜索外网，不要写答案。
${THINKING_CONSTRAINT}

只输出 JSON 数组：
[{"front":"完整面试官口吻问题","tags":["考点"],"difficulty":"junior|mid|senior","role":"岗位"}]

要求：恰好 ${count} 题；覆盖笔记高频考点；问题像真人口述（勿只写名词）；勿编造笔记未涉及的领域；禁止 back/answer；只输出 JSON。`;
}

function quizSystemPrompt(count, multi, roleHints = []) {
  const roleLine = roleHints.length
    ? `主题/岗位：${roleHints.join("、")}。`
    : `根据笔记主题出题。`;
  if (multi) {
    return `你是出题人，生成多选题自测。${roleLine}
${NOTE_LANGUAGE_CONSTRAINT}
${THINKING_CONSTRAINT}
严格只输出一个 JSON 数组（不要 markdown 代码块外的任何文字、不要思考过程）：
[{"question":"完整题干","options":["选项A完整表述","选项B","选项C","选项D"],"correctIndices":[0,2],"explanation":"简短解析","tags":["考点"],"difficulty":"mid"}]
要求：恰好 ${count} 题；每题 4 个选项；correctIndices 为 0-based；tags 为本题考查的 1～3 个知识点；内容依据笔记；禁止在 JSON 前后追加说明。`;
  }
  return `你是出题人，生成单选题自测。${roleLine}
${NOTE_LANGUAGE_CONSTRAINT}
${THINKING_CONSTRAINT}
严格只输出一个 JSON 数组（不要 markdown 代码块外的任何文字、不要思考过程）：
[{"question":"完整题干","options":["选项A完整表述","选项B","选项C","选项D"],"correctIndex":0,"explanation":"简短解析","tags":["考点"],"difficulty":"mid"}]
要求：恰好 ${count} 题；每题 4 个选项；correctIndex 为 0-based；tags 为本题考查的 1～3 个知识点；内容依据笔记；禁止在 JSON 前后追加说明。`;
}

function mindmapSystemPrompt(roleHints = []) {
  const hint = roleHints.length
    ? `笔记主题线索：${roleHints.join("、")}。`
    : "";
  return `你是知识整理助手。${hint}根据笔记生成思维导图。
${NOTE_LANGUAGE_CONSTRAINT}
${THINKING_CONSTRAINT}
只输出 JSON 对象（不要 markdown、不要思考过程）：
{"nodes":[{"id":"1","text":"中心主题","children":[{"id":"1-1","text":"分支","children":[{"id":"1-1-1","text":"要点","children":[]}]}]}]}

规则：
1. 必须有 nodes 数组，至少 1 个根节点
2. 每个节点含 id、text、children（数组，可为空）
3. 建议 2～4 层，覆盖笔记主要结构
4. text 用简短中文标题
5. 只依据笔记，勿编造
6. 只输出上述 JSON`;
}

function buildUserPrompt(combined, {
  taskLine = "",
  knowledgePoints = "",
  notes = "",
  roleHints = [],
  company = "",
  jd = "",
  realQuestionHints = "",
} = {}) {
  const parts = [];
  if (taskLine) parts.push(taskLine);
  if (roleHints.length)
    parts.push(`岗位线索：${roleHints.join("、")}（以正文为准）。`);
  if (company) parts.push(`目标公司：${String(company).slice(0, 80)}`);
  if (jd) parts.push(`JD 摘要：${String(jd).slice(0, 1200)}`);
  if (knowledgePoints)
    parts.push(`优先考点：${String(knowledgePoints).slice(0, 500)}`);
  if (notes) parts.push(`补充：${String(notes).slice(0, 600)}`);
  if (realQuestionHints) parts.push(realQuestionHints);
  parts.push("笔记正文（系统组装，可能截断）：");
  parts.push(combined);
  return parts.join("\n\n");
}

/** 将「仅问题」JSON 规范为带空 back 的卡胚，再由 RAG 填答案 */
function materializeQuestionStems(rawList, sourceMeta, { count } = {}) {
  let payload = unwrapJsonPayload(rawList);
  let list = Array.isArray(payload) ? payload : [payload];
  if (count) list = list.slice(0, count);
  const stems = [];
  for (const raw of list) {
    const front = String(
      raw?.front || raw?.question || raw?.q || raw || ""
    ).trim();
    if (front.length < 6) continue;
    stems.push({
      front,
      tags: Array.isArray(raw?.tags) ? raw.tags : [],
      difficulty: raw?.difficulty || "",
      role: raw?.role || raw?.job || "",
      sourcePaths: sourceMeta.sourcePaths || [],
      sourceNames: sourceMeta.sourceNames || [],
    });
  }
  if (!stems.length) {
    throw new Error("未生成有效面试问题，请检查笔记或重试。");
  }
  return stems;
}

function materializeFlashcards(rawList, sourceMeta, { count } = {}) {
  let payload = unwrapJsonPayload(rawList);
  let list = Array.isArray(payload) ? payload : [payload];
  if (count) list = list.slice(0, count);
  const items = [];
  const errors = [];
  for (const raw of list) {
    const r = normalizeFlashcard(raw, sourceMeta);
    if (r.ok) items.push(r);
    else errors.push(r.error);
  }
  if (!items.length) {
    throw new Error(errors[0] || "未生成有效面试卡片。");
  }
  return items;
}

function materializeQuiz(rawList, sourceMeta, { multi = false, count } = {}) {
  let payload = unwrapJsonPayload(rawList);
  let list = Array.isArray(payload) ? payload : [payload];
  // 过滤非对象噪声
  list = list.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (count) list = list.slice(0, count);
  const mode = multi ? "multi" : "single";
  const items = [];
  const errors = [];
  for (const raw of list) {
    const r = normalizeQuiz(raw, mode, sourceMeta);
    if (r.ok) items.push(r);
    else errors.push(r.error);
  }
  if (!items.length) throw new Error(errors[0] || "未生成有效题目。");
  return items;
}

function materializeMindmap(raw, sourceMeta) {
  const r = normalizeMindmap(raw, sourceMeta);
  if (!r.ok) throw new Error(r.error || "导图结构无效。");
  return r;
}

module.exports = {
  SYSTEM_RESERVE_TOKENS,
  MIN_NOTE_TOKENS,
  outputReserveForKind,
  taskOutputNeed,
  resolveLearningBudget,
  readModelOutputCap,
  noteTokenBudget,
  DEFAULT_FLASHCARD_COUNT,
  MAX_FLASHCARD_COUNT,
  DEFAULT_QUIZ_COUNT,
  MAX_QUIZ_COUNT,
  assembleContext,
  parseJsonFromResponse,
  unwrapJsonPayload,
  clampCount,
  inferRoleHints,
  interviewQuestionsOnlyPrompt,
  // alias for backward name used by endpoints historically
  flashcardSystemPrompt: interviewQuestionsOnlyPrompt,
  quizSystemPrompt,
  mindmapSystemPrompt,
  buildUserPrompt,
  materializeQuestionStems,
  materializeFlashcards,
  materializeQuiz,
  materializeMindmap,
};
