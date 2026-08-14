/**
 * 学习资产内容结构：校验 + 规范化（面试场景允许完整问答文本）
 */

const ITEM_TYPES = Object.freeze([
  "flashcard",
  "quiz_single",
  "quiz_multi",
  "mindmap",
]);

function asString(v, fallback = "") {
  if (v == null) return fallback;
  return String(v).trim();
}

/** 去掉嵌入切块附带的 <document_metadata>… 与章节前缀 */
function stripDocMetadata(text = "") {
  let t = String(text || "").replace(/\r\n/g, "\n");
  if (t.includes("<document_metadata>")) {
    if (t.includes("</document_metadata>")) {
      t = t
        .split("</document_metadata>")
        .slice(1)
        .join("</document_metadata>")
        .trim();
    } else {
      t = t.replace(/<document_metadata>[\s\S]*$/i, "").trim();
    }
  }
  t = t
    .replace(/<\/?document_metadata>/gi, "")
    .replace(/^sourceDocument:\s*[^\n]*\n?/gim, "")
    .replace(/^published:\s*[^\n]*\n?/gim, "")
    .replace(/^\[章节\][^\n]*\n+/u, "")
    .trim();
  return t;
}

function asStringArray(v, max = 8) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => asString(x))
    .filter(Boolean)
    .slice(0, max);
}

function hasSourceBinding(meta = {}) {
  if (meta.sourceFileId != null && meta.sourceFileId !== "") return { ok: true };
  if (meta.sourceChunkId != null && asString(meta.sourceChunkId))
    return { ok: true };
  if (Array.isArray(meta.sourcePaths) && meta.sourcePaths.some(Boolean))
    return { ok: true };
  if (
    Array.isArray(meta.content?.sourcePaths) &&
    meta.content.sourcePaths.some(Boolean)
  )
    return { ok: true };
  return {
    ok: false,
    error: "学习项需要绑定来源（笔记路径 / sourceFileId / sourceChunkId）。",
  };
}

function normalizeFlashcard(raw = {}, sourceMeta = {}) {
  const front = asString(raw.front || raw.question || raw.q);
  const back = asString(raw.back || raw.answer || raw.a);
  const tags = asStringArray(raw.tags, 6);
  const difficulty = asString(raw.difficulty || raw.level);
  const role = asString(raw.role || raw.job || raw.position);
  const company = asString(raw.company);
  const sourcePaths =
    Array.isArray(raw.sourcePaths) && raw.sourcePaths.length
      ? raw.sourcePaths.filter(Boolean)
      : sourceMeta.sourcePaths || [];
  const sourceNames =
    Array.isArray(raw.sourceNames) && raw.sourceNames.length
      ? raw.sourceNames.filter(Boolean)
      : sourceMeta.sourceNames || [];
  // RAG 来源（与问答模式 citations 对齐的精简结构）
  const sources = Array.isArray(raw.sources)
    ? raw.sources.slice(0, 8).map((s) => ({
        title: asString(
          s?.title || s?.docSource || s?.chunkSource || s?.metadata?.title,
          "来源"
        ),
        text: stripDocMetadata(
          asString(
            s?.text || s?.surroundingText || s?.pageContent || s?.metadata?.text
          )
        ).slice(0, 1200),
        chunkSource: s?.chunkSource || null,
        docSource: s?.docSource || null,
        url: s?.url || null,
        score: s?.score ?? null,
      }))
    : [];

  const content = {
    front,
    back,
    tags,
    sources,
    answerMode: raw.answerMode || (sources.length ? "rag" : "llm"),
    ...(difficulty ? { difficulty } : {}),
    ...(role ? { role } : {}),
    ...(company ? { company } : {}),
    ...(sourcePaths.length ? { sourcePaths } : {}),
    ...(sourceNames.length ? { sourceNames } : {}),
  };

  const answerStatus = asString(raw.answerStatus || content.answerStatus);
  const pending = answerStatus === "pending" || raw.pending === true;

  if (!front) {
    return {
      ok: false,
      error: "卡片需要面试问题。",
      content,
    };
  }
  if (front.length < 6) {
    return {
      ok: false,
      error: "问题过短，需接近真实面试官提问。",
      content,
    };
  }
  // 待生成答案：允许空 back
  if (!pending && !back) {
    return {
      ok: false,
      error: "卡片需要参考答案（或标记为 pending）。",
      content,
    };
  }
  if (!pending && back.length < 12 && !sources.length) {
    return {
      ok: false,
      error: "参考答案过短且无知识库来源。",
      content,
    };
  }
  if (pending) {
    content.answerStatus = "pending";
    content.back = back || "";
    content.answerMode = "rag";
  } else {
    content.answerStatus = "ready";
  }

  const binding = hasSourceBinding({
    sourceFileId: sourceMeta.sourceFileId,
    sourceChunkId: sourceMeta.sourceChunkId,
    sourcePaths,
    content,
  });
  if (!binding.ok) return { ok: false, error: binding.error, content };

  return {
    ok: true,
    itemType: "flashcard",
    title: front.slice(0, 200),
    content,
  };
}

function normalizeQuiz(raw = {}, mode = "single", sourceMeta = {}) {
  const isMulti =
    mode === "multi" || mode === "multiple" || mode === "quiz_multi";
  const question = asString(raw.question || raw.stem || raw.title);
  let options = Array.isArray(raw.options) ? raw.options : [];
  options = options
    .map((o) => asString(o).replace(/^[A-D][.\s、)）]+/i, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  let correctIndex = Number(raw.correctIndex);
  let correctIndices = Array.isArray(raw.correctIndices)
    ? raw.correctIndices.map(Number).filter((n) => !Number.isNaN(n))
    : null;

  if (isMulti) {
    if (!correctIndices || !correctIndices.length) {
      if (!Number.isNaN(correctIndex)) correctIndices = [correctIndex];
      else correctIndices = [];
    }
    correctIndices = [...new Set(correctIndices)].filter(
      (i) => i >= 0 && i < options.length
    );
  } else {
    if (Number.isNaN(correctIndex)) correctIndex = 0;
    if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
  }

  const explanation = asString(raw.explanation);
  const difficulty = asString(raw.difficulty || raw.level);
  const role = asString(raw.role || raw.job);
  const tags = asStringArray(raw.tags, 6);
  const sourcePaths =
    Array.isArray(raw.sourcePaths) && raw.sourcePaths.length
      ? raw.sourcePaths.filter(Boolean)
      : sourceMeta.sourcePaths || [];
  const sourceNames =
    Array.isArray(raw.sourceNames) && raw.sourceNames.length
      ? raw.sourceNames.filter(Boolean)
      : sourceMeta.sourceNames || [];

  const content = {
    question,
    options,
    multi: isMulti,
    explanation,
    ...(isMulti ? { correctIndices } : { correctIndex }),
    ...(difficulty ? { difficulty } : {}),
    ...(role ? { role } : {}),
    ...(tags.length ? { tags } : {}),
    ...(sourcePaths.length ? { sourcePaths } : {}),
    ...(sourceNames.length ? { sourceNames } : {}),
  };

  if (!question || question.length < 8) {
    return {
      ok: false,
      error: "题干过短或为空，需接近真实面试/笔试题表述。",
      content,
    };
  }
  if (options.length < 2) {
    return { ok: false, error: "至少需要 2 个选项。", content };
  }
  if (options.some((o) => o.length < 2)) {
    return {
      ok: false,
      error: "选项表述过短，请使用完整选项文字。",
      content,
    };
  }
  if (isMulti && (!correctIndices || correctIndices.length < 1)) {
    return { ok: false, error: "多选题需要 correctIndices。", content };
  }

  const binding = hasSourceBinding({
    sourceFileId: sourceMeta.sourceFileId,
    sourceChunkId: sourceMeta.sourceChunkId,
    sourcePaths,
    content,
  });
  if (!binding.ok) return { ok: false, error: binding.error, content };

  return {
    ok: true,
    itemType: isMulti ? "quiz_multi" : "quiz_single",
    title: question.slice(0, 200),
    content,
  };
}

function normalizeMindmapNode(n, fallbackId = "n") {
  if (!n || typeof n !== "object") {
    return {
      id: fallbackId,
      text: asString(n, "节点") || "节点",
      children: [],
    };
  }
  const id = n.id != null ? String(n.id) : fallbackId;
  let text =
    asString(
      n.text || n.label || n.name || n.title || n.topic || n.value,
      "节点"
    ) || "节点";
  if (text.length > 64) text = `${text.slice(0, 63)}…`;

  let kids = n.children ?? n.nodes ?? n.items ?? n.branches ?? [];
  if (kids && !Array.isArray(kids) && typeof kids === "object") {
    kids = Object.values(kids);
  }
  if (!Array.isArray(kids)) kids = [];

  const children = kids.map((c, i) =>
    normalizeMindmapNode(c, `${id}-${i + 1}`)
  );
  return { id, text, children };
}

/** 从各种常见 LLM 结构中取出节点数组 */
function extractRawMindmapNodes(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "object") return null;

  // 标准
  if (Array.isArray(raw.nodes) && raw.nodes.length) return raw.nodes;
  // 包装层
  for (const key of ["mindmap", "data", "tree", "root", "result", "map"]) {
    const v = raw[key];
    if (!v) continue;
    if (Array.isArray(v)) return v;
    if (Array.isArray(v.nodes) && v.nodes.length) return v.nodes;
    if (typeof v === "object" && (v.text || v.label || v.name || v.children || v.nodes)) {
      return [v];
    }
  }
  // 自身即根节点
  if (raw.text || raw.label || raw.name || raw.title || raw.topic || raw.children) {
    return [raw];
  }
  return null;
}

function normalizeMindmap(raw = {}, sourceMeta = {}) {
  // 有时模型把 JSON 再包一层字符串
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        error: "思维导图 JSON 无效。",
        content: { nodes: [] },
      };
    }
  }

  let rawNodes = extractRawMindmapNodes(raw);

  if (!Array.isArray(rawNodes) || !rawNodes.length) {
    return {
      ok: false,
      error: "思维导图结构无效：缺少 nodes。请重试。",
      content: { nodes: [] },
    };
  }

  const nodes = rawNodes.map((n, i) => normalizeMindmapNode(n, String(i + 1)));
  const sourcePaths = sourceMeta.sourcePaths || raw.sourcePaths || [];
  const sourceNames = sourceMeta.sourceNames || raw.sourceNames || [];
  const content = {
    nodes,
    ...(sourcePaths.length ? { sourcePaths } : {}),
    ...(sourceNames.length ? { sourceNames } : {}),
  };

  const binding = hasSourceBinding({
    sourceFileId: sourceMeta.sourceFileId,
    sourceChunkId: sourceMeta.sourceChunkId,
    sourcePaths,
    content,
  });
  if (!binding.ok) return { ok: false, error: binding.error, content };

  const rootLabel = nodes[0]?.text || "思维导图";
  return {
    ok: true,
    itemType: "mindmap",
    title: String(rootLabel).slice(0, 120),
    content,
  };
}

function normalizeLearningContent(itemType, raw, sourceMeta = {}) {
  switch (itemType) {
    case "flashcard":
      return normalizeFlashcard(raw, sourceMeta);
    case "quiz_single":
      return normalizeQuiz(raw, "single", sourceMeta);
    case "quiz_multi":
      return normalizeQuiz(raw, "multi", sourceMeta);
    case "mindmap":
      return normalizeMindmap(raw, sourceMeta);
    default:
      return { ok: false, error: `未知类型: ${itemType}` };
  }
}

module.exports = {
  ITEM_TYPES,
  hasSourceBinding,
  normalizeFlashcard,
  normalizeQuiz,
  normalizeMindmap,
  normalizeLearningContent,
};
