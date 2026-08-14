/**
 * 面试卡片答案：与问答模式同构的 RAG（检索 + 有据生成 + 来源）。
 * 不写聊天历史；剥离思考链后再返回。
 */

const {
  getVectorDbClass,
  getLLMProvider,
  stripThinkingFromText,
} = require("../helpers");
const { chatPrompt } = require("../chats");
const {
  buildGroundedSystemPrompt,
  packageGroundedContexts,
  joinLabeledContexts,
} = require("../chats/groundedRag");


function preferSelectedSources(sources = [], selectedPaths = []) {
  if (!selectedPaths?.length || !sources?.length) return sources;
  const needles = selectedPaths.map((p) =>
    String(p).replace(/\\/g, "/").toLowerCase()
  );
  const basenames = needles.map((p) => p.split("/").filter(Boolean).pop());
  const matched = sources.filter((s) => {
    const blob = [s.title, s.docSource, s.chunkSource, s.url]
      .filter(Boolean)
      .join(" ")
      .replace(/\\/g, "/")
      .toLowerCase();
    return (
      needles.some((n) => n && blob.includes(n)) ||
      basenames.some((n) => n && blob.includes(n))
    );
  });
  return matched.length ? matched : sources;
}

/** 去掉嵌入切块时附带的 document_metadata / 章节前缀，只保留正文 */
function cleanSourcePassage(text = "") {
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
  // 残缺/转义残留
  t = t
    .replace(/<\/?document_metadata>/gi, "")
    .replace(/^sourceDocument:\s*[^\n]*\n?/gim, "")
    .replace(/^published:\s*[^\n]*\n?/gim, "")
    .replace(/^\[章节\][^\n]*\n+/u, "")
    .trim();
  return t;
}

function compactSourcesForCard(sources = [], max = 6) {
  return (sources || []).slice(0, max).map((s) => {
    const title =
      s.title ||
      s.docSource ||
      s.chunkSource ||
      s?.metadata?.title ||
      "来源";
    const text = cleanSourcePassage(
      s.text || s.surroundingText || s.pageContent || s?.metadata?.text || ""
    ).slice(0, 1200);
    return {
      title,
      text,
      // 保留打开文档用的字段
      docSource: s.docSource || null,
      chunkSource: s.chunkSource || null,
      url: s.url || null,
      score: s.score ?? s.distance ?? null,
    };
  });
}

/** 去掉思考链、未闭合标签、常见 reasoning 块 */
function cleanAnswerText(text = "") {
  let s = String(text || "");
  // 成对 thinking / think 等
  s = stripThinkingFromText(s);
  s = s.replace(
    /<(thinking|think|thought|thought_chain|reasoning)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  // 未闭合 thinking：只丢掉标签到文末的「推理草稿」，尽量保留后面已写出的答案
  // 若整段都以 think 开头且有闭合，上面已处理；否则截到最后一个 </think> 之后
  const closeIdx = Math.max(
    s.toLowerCase().lastIndexOf("</think>"),
    s.toLowerCase().lastIndexOf("</thinking>")
  );
  if (closeIdx >= 0) {
    const after = s.slice(closeIdx).replace(/<\/(?:think|thinking)>/i, "");
    // 若闭合后还有实质正文，优先用闭合后
    if (after.trim().length > 40) s = after;
  }
  s = s.replace(
    /<(thinking|think|thought|thought_chain|reasoning)[^>]*>[\s\S]*$/gi,
    ""
  );
  s = s.replace(
    /<\/?(thinking|think|thought|thought_chain|reasoning)[^>]*>/gi,
    ""
  );
  s = s.replace(/```(?:thinking|reasoning)[\s\S]*?```/gi, "");
  return s.trim();
}

/**
 * @returns {Promise<{ text: string, sources: object[] }>}
 */
async function answerInterviewQuestion({
  workspace,
  question,
  user = null,
  selectedPaths = [],
} = {}) {
  const q = String(question || "").trim();
  if (!q) return { text: "题目为空。", sources: [] };
  if (!workspace?.slug) {
    return { text: "工作区无效，无法检索知识库。", sources: [] };
  }

  const LLMConnector = getLLMProvider({
    provider: workspace?.chatProvider,
    model: workspace?.chatModel,
  });
  const VectorDb = getVectorDbClass();
  const hasSpace = await VectorDb.hasNamespace(workspace.slug);
  const embeddingsCount = hasSpace
    ? await VectorDb.namespaceCount(workspace.slug)
    : 0;

  if (!hasSpace || embeddingsCount === 0) {
    return {
      text:
        workspace?.queryRefusalResponse ||
        "知识库尚未索引文档，无法生成有据答案。请先将笔记导入并向量化。",
      sources: [],
    };
  }

  const vectorSearchResults = await VectorDb.performSimilaritySearch({
    namespace: workspace.slug,
    input: q,
    LLMConnector,
    similarityThreshold: workspace?.similarityThreshold,
    topN: Math.min(Number(workspace?.topN) || 4, 4),
    filterIdentifiers: [],
    rerank: workspace?.vectorSearchMode === "rerank",
  });

  if (vectorSearchResults?.message) {
    return { text: `检索失败：${vectorSearchResults.message}`, sources: [] };
  }

  let contextTexts = [...(vectorSearchResults.contextTexts || [])];
  let sources = preferSelectedSources(
    vectorSearchResults.sources || [],
    selectedPaths
  );

  if (
    sources.length &&
    sources.length !== contextTexts.length &&
    sources.every((s) => s.text || s.pageContent)
  ) {
    contextTexts = sources.map((s) => s.text || s.pageContent || "");
  }

  if (!contextTexts.length) {
    return {
      text:
        workspace?.queryRefusalResponse ||
        "知识库未检索到与该面试题相关的段落，无法给出有据答案。",
      sources: [],
    };
  }

  const packages = packageGroundedContexts(contextTexts, sources);
  const basePrompt = await chatPrompt(workspace, user, { prompt: q });
  const systemPrompt =
    buildGroundedSystemPrompt(basePrompt, {
      hasContext: true,
      contextCount: packages.length,
      strict: true,
    }) +
    joinLabeledContexts(packages) +
    `\n\n## 答题场景\n为面试卡片写参考答案。答案语言与题目/笔记一致。直接输出答案正文，不要输出思考过程、reasoning、thinking 标签。结构清晰可口述；只依据 Context；事实后标注 [n]。`;

  const messages = await LLMConnector.compressMessages(
    {
      systemPrompt,
      userPrompt: q,
      contextTexts: packages.map((p) => p.text),
      chatHistory: [],
      attachments: [],
    },
    []
  );

  const { textResponse } = await LLMConnector.getChatCompletion(messages, {
    temperature: workspace?.openAiTemp ?? LLMConnector.defaultTemp ?? 0.2,
    user,
  });

  return {
    text: cleanAnswerText(textResponse) || "模型未返回内容。请检查 LLM 配置后重试。",
    sources: compactSourcesForCard(sources),
  };
}

module.exports = {
  answerInterviewQuestion,
  preferSelectedSources,
  compactSourcesForCard,
  cleanAnswerText,
};
