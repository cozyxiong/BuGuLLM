const {
  WorkspaceAgentInvocation,
} = require("../../models/workspaceAgentInvocation");
const { writeResponseChunk } = require("../helpers/chat/responses");

/**
 * In-memory cache for attachments associated with agent invocations.
 * Attachments are stored here when grepAgents creates an invocation,
 * then retrieved by AgentHandler when the websocket connects.
 * @type {Map<string, Array>}
 */
const invocationAttachmentsCache = new Map();

/**
 * Store attachments for an invocation UUID
 * @param {string} uuid - The invocation UUID
 * @param {Array} attachments - The attachments array
 */
function cacheInvocationAttachments(uuid, attachments = []) {
  if (attachments.length > 0) {
    invocationAttachmentsCache.set(uuid, attachments);
  }
}

/**
 * Retrieve and remove attachments for an invocation UUID
 * @param {string} uuid - The invocation UUID
 * @returns {Array} The attachments array (empty if none cached)
 */
function getAndClearInvocationAttachments(uuid) {
  const attachments = invocationAttachmentsCache.get(uuid) || [];
  invocationAttachmentsCache.delete(uuid);
  return attachments;
}

async function grepAgents({
  uuid,
  response,
  message,
  workspace,
  user = null,
  thread = null,
  attachments = [],
}) {
  // 问答模式：纯 RAG，不进 Agent，忽略 @agent
  const mode = workspace?.chatMode;
  if (mode !== "assistant" && mode !== "automatic") return false;

  // 助手模式：每条消息都进内置 Agent（不依赖 Claude Code / 外部 CLI）
  const { invocation: newInvocation } = await WorkspaceAgentInvocation.new({
    prompt: message,
    workspace: workspace,
    user: user,
    thread: thread,
  });

  if (!newInvocation) {
    writeResponseChunk(response, {
      id: uuid,
      type: "statusResponse",
      textResponse:
        "助手会话启动失败，请稍后重试或切换回问答模式。",
      sources: [],
      close: true,
      animate: false,
      error: null,
    });
    return false;
  }

  cacheInvocationAttachments(newInvocation.uuid, attachments);

  writeResponseChunk(response, {
    id: uuid,
    type: "agentInitWebsocketConnection",
    textResponse: null,
    sources: [],
    close: false,
    error: null,
    websocketUUID: newInvocation.uuid,
  });

  writeResponseChunk(response, {
    id: uuid,
    type: "statusResponse",
    textResponse:
      "助手模式：已切换到可使用技能与文件工具的会话。输入 /exit 可提前结束。",
    sources: [],
    close: true,
    error: null,
    animate: true,
  });
  return true;
}

module.exports = { grepAgents, getAndClearInvocationAttachments };
