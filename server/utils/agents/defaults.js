const AgentPlugins = require("./aibitat/plugins");
const { SystemSettings } = require("../../models/systemSettings");
const { safeJsonParse } = require("../http");
const Provider = require("./aibitat/providers/ai-provider");
const ImportedPlugin = require("./imported");
const { AgentFlows } = require("../agentFlows");
const MCPCompatibilityLayer = require("../MCP");

// Default-enabled skills (toggle off via disabled_agent_skills).
// rag-memory is NOT here — opt-in via default_agent_skills only.
// document-summarizer removed (use filesystem read + model summary).
const DEFAULT_SKILLS = [AgentPlugins.webScraping.name];

/**
 * Soft harness SOP for assistant mode (structure-first navigation, deep work when scoped).
 * Appended to workspace system prompt for the agent role only.
 */
const ASSISTANT_AGENT_SOP = `
你是知识库写作与整理助手。工作区是树形文件夹 + Markdown vault（以磁盘最新内容为准）。
「问答模式」负责稳定笔记上的检索问答；你负责正在修改、创作、整理时的深度协助。

【工具优先级 — 软引导，非逐步强制】
1. 探索范围：filesystem-list-directory 看文件夹树
2. 按名/路径：filesystem-search-files mode=glob，或已知路径直接 read
3. 按原文/术语：filesystem-search-files mode=content（默认只要路径与匹配行）
4. 整篇理解/改写前：filesystem-read-text-file（长文可先 head 看标题再按需读）；总结由你在对话中完成，无需专门 summarize 工具
5. 改写/新建/整理：edit / write / move / copy / create-directory（改前先 read 目标）
6. rag-memory（仅当该 skill 已启用时可见）：仅在用文件树/文件名/内容搜索仍找不到，或问题明显是同义/转述、关键词对不上时，作语义兜底；命中后仍应用文件工具读取正文再改写，勿只拿检索碎片当终稿
7. bash（filesystem-run-command）：仅辅助（统计、检查等），不作主检索/主阅读

【工具协议 — 所有模型通用】
- 调用工具时必须使用 API 原生 tool/function calling，禁止在正文中输出 XML/JSON/伪标签形式的 tool 调用
- 文件路径一律使用相对 vault 根的路径（如 AI/RAG.md 或 .），禁止操作系统绝对路径
- 多步任务（总结并写入、新建文件夹等）应连续调用工具直至完成，不要只输出计划就结束

【原则】
- 导航阶段（尚不知读哪）：优先 list/glob/content，search 不要默认带多篇全文
- 作业阶段（已锁定目标）：任务需要通篇理解、多跳、改写、新建、批量整理时，应充分 read 并可按需再读；内容不够就再调工具
- 不要无目标地灌入大量无关全文；也不要因节省而拒绝完成通篇理解/改写/整理
- 写入 vault 后向量索引可能未更新；勿声称问答模式已立刻可检索到新内容
`.trim();

/**
 * Configuration for agent skills that require availability checks and disabled sub-skill lists.
 * Each entry maps a skill name to its availability checker and disabled skills list key.
 */
const SKILL_FILTER_CONFIG = {
  "filesystem-agent": {
    getAvailability: () =>
      require("./aibitat/plugins/filesystem/lib").isToolAvailable(),
    disabledSettingKey: "disabled_filesystem_skills",
  },
  "create-files-agent": {
    getAvailability: () =>
      require("./aibitat/plugins/create-files/lib").isToolAvailable(),
    disabledSettingKey: "disabled_create_files_skills",
  },
  "gmail-agent": {
    getAvailability: async () =>
      require("./aibitat/plugins/gmail/lib").GmailBridge.isToolAvailable(),
    disabledSettingKey: "disabled_gmail_skills",
  },
  "outlook-agent": {
    getAvailability: async () =>
      require("./aibitat/plugins/outlook/lib").OutlookBridge.isToolAvailable(),
    disabledSettingKey: "disabled_outlook_skills",
  },
};

const USER_AGENT = {
  name: "USER",
  getDefinition: () => {
    return {
      interrupt: "ALWAYS",
      role: "I am the human monitor and oversee this chat. Any questions on action or decision making should be directed to me.",
    };
  },
};

const WORKSPACE_AGENT = {
  name: "@agent",
  /**
   * Get the definition for the workspace agent with its role (prompt) and functions in Aibitat format
   * @param {string} provider
   * @param {import("@prisma/client").workspaces | null} workspace
   * @param {import("@prisma/client").users | null} user
   * @param {string} [prompt] - Current user message for memory reranking
   * @returns {Promise<{ role: string, functions: object[] }>}
   */
  getDefinition: async (
    provider = null,
    workspace = null,
    user = null,
    prompt = ""
  ) => {
    let [role, clarifyingQuestionsSkills] = await Promise.all([
      Provider.systemPrompt({
        provider,
        workspace,
        user,
        prompt,
      }),
      clarifyingQuestionsSkillIfEnabled(),
    ]);

    // Assistant soft harness (navigation priority + deep work when scoped)
    role = `${role}\n\n${ASSISTANT_AGENT_SOP}`;

    // If clarifying questions tools are enabled, add a note to the role that the user must use the request-user-input tool to ask questions.
    if (!!clarifyingQuestionsSkills?.length)
      role +=
        "\n\nWhen you need information from the user (URLs, file paths, preferences, choices, etc.), you MUST use the request-user-input tool. Do not ask questions in your text response - the user cannot reply to text. Only the tool can collect user input.";

    return {
      role,
      functions: [
        ...(await agentSkillsFromSystemSettings()),
        ...clarifyingQuestionsSkills,
        ...ImportedPlugin.activeImportedPlugins(),
        ...AgentFlows.activeFlowPlugins(),
        ...(await new MCPCompatibilityLayer().activeMCPServers()),
      ],
    };
  },
};

/**
 * Conditionally include the request-user-input sub-tools in the workspace agent's
 * function list when the admin has enabled clarifying questions.
 * Returns an empty array when disabled so the tools aren't visible to the LLM.
 * Names use the parent#child convention so #attachPlugins loads each sub-tool.
 * @returns {Promise<string[]>}
 */
async function clarifyingQuestionsSkillIfEnabled() {
  const enabled =
    (await SystemSettings.getValueOrFallback(
      { label: "agent_clarifying_questions_enabled" },
      "false"
    )) === "true";
  if (!enabled) return [];

  const parentName = AgentPlugins.requestUserInput.name;
  const subPlugins = AgentPlugins.requestUserInput.plugin;
  if (!Array.isArray(subPlugins)) return [];
  return subPlugins.map((sub) => `${parentName}#${sub.name}`);
}

/**
 * Fetches and preloads the names/identifiers for plugins that will be dynamically
 * loaded later
 * @returns {Promise<string[]>}
 */
async function agentSkillsFromSystemSettings() {
  const systemFunctions = [];

  // Load non-imported built-in skills that are configurable, but are default enabled.
  const _disabledDefaultSkills = safeJsonParse(
    await SystemSettings.getValueOrFallback(
      { label: "disabled_agent_skills" },
      "[]"
    ),
    []
  );
  DEFAULT_SKILLS.forEach((skill) => {
    if (!_disabledDefaultSkills.includes(skill))
      systemFunctions.push(AgentPlugins[skill].name);
  });

  // Load non-imported built-in skills that are configurable.
  const _setting = safeJsonParse(
    await SystemSettings.getValueOrFallback(
      { label: "default_agent_skills" },
      "[]"
    ),
    []
  );

  // 助手核心：默认启用 filesystem-agent（read/write/search/bash），除非用户在设置中关闭
  // 关闭方式：写入 disabled_agent_skills 含 "filesystem-agent"
  if (
    !_setting.includes("filesystem-agent") &&
    !_disabledDefaultSkills.includes("filesystem-agent")
  ) {
    _setting.push("filesystem-agent");
  }

  // Pre-load disabled sub-skills and availability for configured skills
  const skillFilterState = {};
  for (const skillName of Object.keys(SKILL_FILTER_CONFIG)) {
    if (!_setting.includes(skillName)) continue;
    const config = SKILL_FILTER_CONFIG[skillName];
    skillFilterState[skillName] = {
      available: await config.getAvailability(),
      disabledSubSkills: safeJsonParse(
        await SystemSettings.getValueOrFallback(
          { label: config.disabledSettingKey },
          "[]"
        ),
        []
      ),
    };
  }

  for (const skillName of _setting) {
    if (!AgentPlugins.hasOwnProperty(skillName)) continue;

    // This is a plugin module with many sub-children plugins who
    // need to be named via `${parent}#${child}` naming convention
    if (Array.isArray(AgentPlugins[skillName].plugin)) {
      for (const subPlugin of AgentPlugins[skillName].plugin) {
        // Check if this skill has filter configuration
        const filterState = skillFilterState[skillName];
        if (filterState) {
          if (!filterState.available) continue;
          if (filterState.disabledSubSkills.includes(subPlugin.name)) continue;
        }

        systemFunctions.push(
          `${AgentPlugins[skillName].name}#${subPlugin.name}`
        );
      }
      continue;
    }

    // This is normal single-stage plugin
    systemFunctions.push(AgentPlugins[skillName].name);
  }
  return systemFunctions;
}

module.exports = {
  USER_AGENT,
  WORKSPACE_AGENT,
  agentSkillsFromSystemSettings,
};
