/** 去掉 .env 里可能残留的引号/空白，避免 fullApiUrl 拼错 */
export const API_BASE = String(
  import.meta.env.VITE_API_BASE || "/api"
).trim().replace(/^['"]|['"]$/g, "");
export const ONBOARDING_SURVEY_URL = "https://onboarding.anythingllm.com";

export const AUTH_USER = "anythingllm_user";
export const AUTH_TOKEN = "anythingllm_authToken";
export const AUTH_TIMESTAMP = "anythingllm_authTimestamp";
export const COMPLETE_QUESTIONNAIRE = "anythingllm_completed_questionnaire";
export const SEEN_DOC_PIN_ALERT = "anythingllm_pinned_document_alert";
export const SEEN_WATCH_ALERT = "anythingllm_watched_document_alert";
export const LAST_VISITED_WORKSPACE = "anythingllm_last_visited_workspace";
export const USER_PROMPT_INPUT_MAP = "anythingllm_user_prompt_input_map";
export const PENDING_HOME_MESSAGE = "anythingllm_pending_home_message";
/** 每个工作区最近一次对话 thread slug，收起再进全屏时恢复历史 */
export const LAST_WORKSPACE_THREAD_PREFIX = "bagu_last_thread:";
export function lastThreadStorageKey(workspaceSlug) {
  return `${LAST_WORKSPACE_THREAD_PREFIX}${workspaceSlug || ""}`;
}
export function getLastWorkspaceThread(workspaceSlug) {
  if (!workspaceSlug) return null;
  try {
    return sessionStorage.getItem(lastThreadStorageKey(workspaceSlug)) || null;
  } catch {
    return null;
  }
}
export function setLastWorkspaceThread(workspaceSlug, threadSlug) {
  if (!workspaceSlug || !threadSlug) return;
  try {
    sessionStorage.setItem(lastThreadStorageKey(workspaceSlug), threadSlug);
  } catch {
    /* ignore */
  }
}
export function clearLastWorkspaceThread(workspaceSlug) {
  if (!workspaceSlug) return;
  try {
    sessionStorage.removeItem(lastThreadStorageKey(workspaceSlug));
  } catch {
    /* ignore */
  }
}

export const APPEARANCE_SETTINGS = "anythingllm_appearance_settings";

export const OLLAMA_COMMON_URLS = [
  "http://127.0.0.1:11434",
  "http://host.docker.internal:11434",
  "http://172.17.0.1:11434",
];

export const LMSTUDIO_COMMON_URLS = [
  "http://localhost:1234/v1",
  "http://127.0.0.1:1234/v1",
  "http://host.docker.internal:1234/v1",
  "http://172.17.0.1:1234/v1",
];

export const KOBOLDCPP_COMMON_URLS = [
  "http://127.0.0.1:5000/v1",
  "http://localhost:5000/v1",
  "http://host.docker.internal:5000/v1",
  "http://172.17.0.1:5000/v1",
];

export const LOCALAI_COMMON_URLS = [
  "http://127.0.0.1:8080/v1",
  "http://localhost:8080/v1",
  "http://host.docker.internal:8080/v1",
  "http://172.17.0.1:8080/v1",
];

export const NVIDIA_NIM_COMMON_URLS = [
  "http://127.0.0.1:8000/v1/version",
  "http://localhost:8000/v1/version",
  "http://host.docker.internal:8000/v1/version",
  "http://172.17.0.1:8000/v1/version",
];

export const DOCKER_MODEL_RUNNER_COMMON_URLS = [
  "http://localhost:12434/engines/llama.cpp/v1",
  "http://127.0.0.1:12434/engines/llama.cpp/v1",
  "http://model-runner.docker.internal/engines/llama.cpp/v1",
  "http://host.docker.internal:12434/engines/llama.cpp/v1",
  "http://172.17.0.1:12434/engines/llama.cpp/v1",
];

export const LEMONADE_COMMON_URLS = [
  "http://localhost:8000/live",
  "http://127.0.0.1:8000/live",
  "http://host.docker.internal:8000/live",
  "http://172.17.0.1:8000/live",

  // In Lemonade 10.1.0 the base port is 13305
  "http://localhost:13305/live",
  "http://127.0.0.1:13305/live",
  "http://host.docker.internal:13305/live",
  "http://172.17.0.1:13305/live",
];

export function fullApiUrl() {
  if (API_BASE !== "/api") return API_BASE;
  return `${window.location.origin}/api`;
}

export const POPUP_BROWSER_EXTENSION_EVENT = "NEW_BROWSER_EXTENSION_CONNECTION";
