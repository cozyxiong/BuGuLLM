const { v4: uuidv4 } = require("uuid");
const { DocumentManager } = require("../DocumentManager");
const { WorkspaceChats } = require("../../models/workspaceChats");
const { WorkspaceParsedFiles } = require("../../models/workspaceParsedFiles");
const { getVectorDbClass, resolveProviderConnector } = require("../helpers");
const { writeResponseChunk } = require("../helpers/chat/responses");
const { grepAgents } = require("./agents");
const {
  alignCitationsInAnswer,
  sourcesPendingLite,
} = require("./citationAlign");
const { buildGroundedSystemPrompt } = require("./groundedRag");
const {
  grepCommand,
  VALID_COMMANDS,
  chatPrompt,
  recentChatHistory,
  sourceIdentifier,
} = require("./index");

/**
 * Parses a raw LLM response text to extract structured fields.
 * Expected format: the response may contain a JSON block delimited by
 * ```json ... ``` at the end, or the entire response may be a JSON object.
 * Fields:
 *   - answer: the main RAG answer text
 *   - supplement: standard interview answer (collapsible)
 *   - relatedTopics: array of { title, query }
 *   - citations: array of chunk IDs
 * Falls back to treating the entire rawText as the plain answer.
 * @param {string} rawText
 * @returns {{ text: string, supplement: string|null, relatedTopics: Array|null, citations: Array|null }}
 */
/**
 * 去掉回答中的结构化 JSON（```json 代码块、纯 JSON 对象、文末残留半截 JSON），
 * 仅保留给用户看的正文。
 */
function parseStructuredResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { text: rawText || "", supplement: null, relatedTopics: null, citations: null };
  }

  let supplement = null;
  let relatedTopics = null;
  let citations = null;
  let text = rawText;

  // 1) 整段就是 JSON 对象
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      if (parsed && (parsed.answer || parsed.supplement || parsed.relatedTopics)) {
        return {
          text: typeof parsed.answer === "string" ? parsed.answer : "",
          supplement: parsed.supplement || null,
          relatedTopics: Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics : null,
          citations: Array.isArray(parsed.citations) ? parsed.citations : null,
        };
      }
    }
  } catch (_) { /* not pure JSON */ }

  // 2) ```json ... ``` 代码块（完整闭合）
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/gi;
  const matches = [...text.matchAll(jsonBlockRegex)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    try {
      const parsed = JSON.parse(lastMatch[1]);
      if (parsed && (parsed.answer || parsed.supplement || parsed.relatedTopics || parsed.citations)) {
        supplement = parsed.supplement || null;
        relatedTopics = Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics : null;
        citations = Array.isArray(parsed.citations) ? parsed.citations : null;
        if (typeof parsed.answer === "string" && parsed.answer.trim()) {
          text = parsed.answer;
        }
      }
    } catch (_) { /* ignore invalid block payload */ }
    // 无论能否解析，都从展示文案中删掉 json 代码块
    text = text.replace(jsonBlockRegex, "").trim();
  }

  // 3) 流式中断时未闭合的 ```json 尾巴
  const openFence = text.search(/```json\b/i);
  if (openFence !== -1) {
    text = text.slice(0, openFence).trim();
  }

  // 4) 文末裸露的 { "supplement" | "relatedTopics" | "citations" ... } 对象
  const bareJsonTail = text.match(
    /\n\s*\{[\s\S]*"(?:supplement|relatedTopics|citations|answer)"[\s\S]*\}\s*$/
  );
  if (bareJsonTail) {
    const candidate = bareJsonTail[0].trim();
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && (parsed.supplement || parsed.relatedTopics || parsed.citations || parsed.answer)) {
        if (!supplement) supplement = parsed.supplement || null;
        if (!relatedTopics && Array.isArray(parsed.relatedTopics)) relatedTopics = parsed.relatedTopics;
        if (!citations && Array.isArray(parsed.citations)) citations = parsed.citations;
        if (typeof parsed.answer === "string" && parsed.answer.trim()) {
          text = parsed.answer;
        } else {
          text = text.slice(0, bareJsonTail.index).trim();
        }
      }
    } catch (_) {
      // 半截 JSON：直接截掉从最后一个像结构字段开始的 {
      const cut = text.lastIndexOf("\n{");
      if (cut !== -1 && /"(?:supplement|relatedTopics|citations)"/.test(text.slice(cut))) {
        text = text.slice(0, cut).trim();
      }
    }
  }

  return { text: text.trim(), supplement, relatedTopics, citations };
}

/**
 * Enhances a source object with citation metadata: stable chunkId,
 * full surroundingText, and empty highlights array.
 * @param {Object} source - the original source object
 * @param {number} idx - index of this source in the results array
 * @returns {Object} enhanced source
 */
function enhanceSource(source, idx) {
  const docId = source.docId || source.id || source.title || `src_${idx}`;
  const chunkId = `${String(docId)}_chunk_${idx}`;
  const fullText = source.text || source.pageContent || "";
  return {
    ...source,
    chunkId,
    surroundingText: fullText,
    highlights: [],
  };
}

const VALID_CHAT_MODE = ["assistant", "query", "automatic", "chat"]; // automatic/chat 兼容旧值

async function streamChatWithWorkspace(
  response,
  workspace,
  message,
  chatMode = "query",
  user = null,
  thread = null,
  attachments = []
) {
  // 规范化模式：旧 chat→query，旧 automatic→assistant
  if (chatMode === "chat") chatMode = "query";
  if (chatMode === "automatic") chatMode = "assistant";
  if (!VALID_CHAT_MODE.includes(chatMode)) chatMode = "query";
  // 助手模式在 grepAgents 内接管；此处保证后续 RAG 逻辑用 query 语义不跑助手
  if (workspace && typeof workspace === "object") {
    workspace = { ...workspace, chatMode };
  }

  const uuid = uuidv4();
  const updatedMessage = await grepCommand(message, user);

  if (Object.keys(VALID_COMMANDS).includes(updatedMessage)) {
    const data = await VALID_COMMANDS[updatedMessage](
      workspace,
      message,
      uuid,
      user,
      thread
    );
    writeResponseChunk(response, data);
    return;
  }

  // If is agent enabled chat we will exit this flow early.
  const isAgentChat = await grepAgents({
    uuid,
    response,
    message: updatedMessage,
    user,
    workspace,
    thread,
    attachments,
  });
  if (isAgentChat) return;

  const {
    connector: LLMConnector,
    routingMetadata,
    prefetchedContext,
    error: routerError,
  } = await resolveLLMConnector({
    workspace,
    message: updatedMessage,
    user,
    thread,
    attachments,
  });

  if (routerError) {
    return writeResponseChunk(response, {
      id: uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: routerError,
    });
  }

  if (routingMetadata?.routedTo?.shouldNotify) {
    writeResponseChunk(response, {
      uuid: `${uuid}:route`,
      type: "modelRouteNotification",
      routedTo: routingMetadata.routedTo,
    });
  }

  const VectorDb = getVectorDbClass();

  const messageLimit = workspace?.openAiHistory || 20;
  const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
  const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);

  // User is trying to query-mode chat a workspace that has no data in it - so
  // we should exit early as no information can be found under these conditions.
  if ((!hasVectorizedSpace || embeddingsCount === 0) && chatMode === "query") {
    const textResponse =
      workspace?.queryRefusalResponse ??
      "There is no relevant information in this workspace to answer your query.";
    writeResponseChunk(response, {
      id: uuid,
      type: "textResponse",
      textResponse,
      sources: [],
      attachments,
      close: true,
      error: null,
    });
    await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: textResponse,
        sources: [],
        type: chatMode,
        attachments,
      },
      threadId: thread?.id || null,
      include: false,
      user,
    });
    return;
  }

  // If we are here we know that we are in a workspace that is:
  // 1. Chatting in "chat" mode and may or may _not_ have embeddings
  // 2. Chatting in "query" mode and has at least 1 embedding
  let completeText;
  let metrics = {};
  let contextTexts = [];
  let sources = [];
  let pinnedDocIdentifiers = [];

  // If the router pre-fetched context we can reuse it; otherwise fetch fresh.
  const {
    rawHistory,
    chatHistory,
    pinnedDocs: prefetchedPinnedDocs,
    parsedFiles: prefetchedParsedFiles,
  } = prefetchedContext ??
  (await recentChatHistory({ user, workspace, thread, messageLimit }));

  // Pinned docs — reuse pre-fetched if available, otherwise fetch with token cap.
  const pinnedDocs =
    prefetchedPinnedDocs ??
    (await new DocumentManager({
      workspace,
      maxTokens: LLMConnector.promptWindowLimit(),
    }).pinnedDocs());
  pinnedDocs.forEach((doc, idx) => {
    const { pageContent, ...metadata } = doc;
    pinnedDocIdentifiers.push(sourceIdentifier(doc));
    contextTexts.push(doc.pageContent);
    sources.push(
      enhanceSource(
        {
          // 悬停/侧栏展示用完整片段；列表摘要可截断
          text: pageContent,
          surroundingText: pageContent,
          ...metadata,
        },
        idx
      )
    );
  });

  // Parsed files — reuse pre-fetched if available, otherwise fetch fresh.
  const parsedFiles =
    prefetchedParsedFiles ??
    (await WorkspaceParsedFiles.getContextFiles(
      workspace,
      thread || null,
      user || null
    ));
  parsedFiles.forEach((doc, idx) => {
    const { pageContent, ...metadata } = doc;
    contextTexts.push(doc.pageContent);
    sources.push(
      enhanceSource(
        {
          text: pageContent,
          surroundingText: pageContent,
          ...metadata,
        },
        pinnedDocs.length + idx
      )
    );
  });

  const vectorSearchResults =
    embeddingsCount !== 0
      ? await VectorDb.performSimilaritySearch({
          namespace: workspace.slug,
          input: updatedMessage,
          LLMConnector,
          similarityThreshold: workspace?.similarityThreshold,
          topN: workspace?.topN,
          filterIdentifiers: pinnedDocIdentifiers,
          rerank: workspace?.vectorSearchMode === "rerank",
        })
      : {
          contextTexts: [],
          sources: [],
          message: null,
        };

  // Failed similarity search if it was run at all and failed.
  if (!!vectorSearchResults.message) {
    writeResponseChunk(response, {
      id: uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: vectorSearchResults.message,
    });
    return;
  }

  const { fillSourceWindow } = require("../helpers/chat");
  const filledSources = fillSourceWindow({
    nDocs: workspace?.topN || 4,
    searchResults: vectorSearchResults.sources,
    history: rawHistory,
    filterIdentifiers: pinnedDocIdentifiers,
  });

  // Why does contextTexts get all the info, but sources only get current search?
  // This is to give the ability of the LLM to "comprehend" a contextual response without
  // populating the Citations under a response with documents the user "thinks" are irrelevant
  // due to how we manage backfilling of the context to keep chats with the LLM more correct in responses.
  // If a past citation was used to answer the question - that is visible in the history so it logically makes sense
  // and does not appear to the user that a new response used information that is otherwise irrelevant for a given prompt.
  // TLDR; reduces GitHub issues for "LLM citing document that has no answer in it" while keep answers highly accurate.
  contextTexts = [...contextTexts, ...filledSources.contextTexts];
  // Enhance vector search result sources with citation metadata
  const enhancedVectorSources = vectorSearchResults.sources.map((src, idx) =>
    enhanceSource(src, sources.length + idx)
  );
  sources = [...sources, ...enhancedVectorSources];

  // If in query mode and no context chunks are found from search, backfill, or pins -  do not
  // let the LLM try to hallucinate a response or use general knowledge and exit early
  if (chatMode === "query" && contextTexts.length === 0) {
    const textResponse =
      workspace?.queryRefusalResponse ??
      "There is no relevant information in this workspace to answer your query.";
    writeResponseChunk(response, {
      id: uuid,
      type: "textResponse",
      textResponse,
      sources: [],
      close: true,
      error: null,
    });

    await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: textResponse,
        sources: [],
        type: chatMode,
        attachments,
      },
      threadId: thread?.id || null,
      include: false,
      user,
    });
    return;
  }

  // Compress & Assemble message to ensure prompt passes token limit with room for response
  // and build system messages based on inputs and history.
  // Reuse the system prompt from routing pre-fetch when available.
  const baseSystemPrompt =
    prefetchedContext?.systemPrompt ??
    (await chatPrompt(workspace, user, {
      prompt: updatedMessage,
      rawHistory,
    }));

  // Closed-loop grounded：答案空间严格限定在检索 Context 内
  const systemPrompt = buildGroundedSystemPrompt(baseSystemPrompt, {
    hasContext: contextTexts.length > 0,
    contextCount: contextTexts.length,
    strict: chatMode === "query",
  });
  const groundedTemp =
    contextTexts.length > 0
      ? Math.min(
          workspace?.openAiTemp ?? LLMConnector.defaultTemp ?? 0.7,
          0.35
        )
      : workspace?.openAiTemp ?? LLMConnector.defaultTemp;

  const messages = await LLMConnector.compressMessages(
    {
      systemPrompt,
      userPrompt: updatedMessage,
      contextTexts,
      chatHistory,
      attachments,
    },
    rawHistory
  );

  // If streaming is not explicitly enabled for connector
  // we do regular waiting of a response and send a single chunk.
  if (LLMConnector.streamingEnabled() !== true) {
    console.log(
      `\x1b[31m[STREAMING DISABLED]\x1b[0m Streaming is not available for ${LLMConnector.constructor.name}. Will use regular chat method.`
    );
    const { textResponse, metrics: performanceMetrics } =
      await LLMConnector.getChatCompletion(messages, {
        temperature: groundedTemp,
        user: user,
      });

    completeText = textResponse;
    metrics = performanceMetrics;

    // For non-streaming, parse structured response now and send the clean answer
    const nonStreamStructured = parseStructuredResponse(completeText);
    const nonStreamDisplay = nonStreamStructured.text;
    const nonStreamSupplement = nonStreamStructured.supplement;
    const nonStreamRelated = nonStreamStructured.relatedTopics;

    try {
      sources = await alignCitationsInAnswer(nonStreamDisplay, sources);
    } catch (e) {
      console.warn("[stream] citationAlign failed:", e.message);
    }

    writeResponseChunk(response, {
      uuid,
      sources,
      type: "textResponseChunk",
      textResponse: nonStreamDisplay,
      close: true,
      error: false,
      metrics,
      ...(nonStreamSupplement ? { supplement: nonStreamSupplement } : {}),
      ...(nonStreamRelated ? { relatedTopics: nonStreamRelated } : {}),
    });

    // Save to DB and finalize
    if (nonStreamDisplay?.length > 0) {
      const { chat } = await WorkspaceChats.new({
        workspaceId: workspace.id,
        prompt: message,
        response: {
          text: nonStreamDisplay,
          sources,
          type: chatMode,
          attachments,
          metrics,
          ...(nonStreamSupplement ? { supplement: nonStreamSupplement } : {}),
          ...(nonStreamRelated ? { relatedTopics: nonStreamRelated } : {}),
        },
        threadId: thread?.id || null,
        user,
      });

      writeResponseChunk(response, {
        uuid,
        type: "finalizeResponseStream",
        textResponse: nonStreamDisplay,
        sources,
        close: true,
        error: false,
        chatId: chat.id,
        metrics,
      });
    } else {
      writeResponseChunk(response, {
        uuid,
        type: "finalizeResponseStream",
        close: true,
        error: false,
        metrics,
      });
    }
    return;
  } else {
    const stream = await LLMConnector.streamGetChatCompletion(messages, {
      temperature: groundedTemp,
      user: user,
    });
    // 流式过程中不推送全文 sources，避免先展示未对齐的错误正文
    completeText = await LLMConnector.handleStream(response, stream, {
      uuid,
      sources: sourcesPendingLite(sources),
    });
    metrics = stream.metrics;
  }

  // Parse structured response to extract supplement, relatedTopics, and citations
  const structured = parseStructuredResponse(completeText);
  const displayText = structured.text;
  const supplement = structured.supplement;
  const relatedTopics = structured.relatedTopics;

  // 答案生成完：n-gram 引用对齐
  try {
    sources = await alignCitationsInAnswer(displayText, sources);
  } catch (e) {
    console.warn("[stream] citationAlign failed:", e.message);
  }

  if (displayText?.length > 0) {
    const { chat } = await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: displayText,
        sources,
        type: chatMode,
        attachments,
        metrics,
        ...(supplement ? { supplement } : {}),
        ...(relatedTopics ? { relatedTopics } : {}),
      },
      threadId: thread?.id || null,
      user,
    });

    writeResponseChunk(response, {
      uuid,
      type: "finalizeResponseStream",
      // 用剥离 JSON 后的正文覆盖流式过程中已展示的全文；带回对齐后的 sources
      textResponse: displayText,
      sources,
      close: true,
      error: false,
      chatId: chat.id,
      metrics,
      ...(supplement ? { supplement } : {}),
      ...(relatedTopics ? { relatedTopics } : {}),
    });
    return;
  }

  writeResponseChunk(response, {
    uuid,
    type: "finalizeResponseStream",
    textResponse: displayText || "",
    sources,
    close: true,
    error: false,
    metrics,
    ...(supplement ? { supplement } : {}),
    ...(relatedTopics ? { relatedTopics } : {}),
  });
  return;
}

async function resolveLLMConnector({
  workspace,
  message,
  user,
  thread,
  attachments,
}) {
  try {
    const result = await resolveProviderConnector({
      workspace,
      prompt: message,
      user,
      thread,
      attachments,
    });
    return { ...result, error: null };
  } catch (routerError) {
    return {
      connector: null,
      routingMetadata: null,
      prefetchedContext: null,
      error: `Model router error: ${routerError.message}`,
    };
  }
}

module.exports = {
  VALID_CHAT_MODE,
  streamChatWithWorkspace,
};
