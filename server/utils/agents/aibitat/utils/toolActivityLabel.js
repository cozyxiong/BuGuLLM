/**
 * Short Grok-style labels for agent tool steps shown in the chat UI.
 * Prefixed with "▸ " so the frontend can prefer these over verbose dumps.
 */

const TOOL_LABELS = {
  "filesystem-read-text-file": "Read",
  "filesystem-read-multiple-files": "Read",
  "filesystem-write-text-file": "Write",
  "filesystem-edit-file": "Edit",
  "filesystem-search-files": "Search",
  "filesystem-list-directory": "List",
  "filesystem-run-command": "Run",
  "filesystem-get-file-info": "Info",
  "filesystem-create-directory": "Mkdir",
  "filesystem-move-file": "Move",
  "filesystem-copy-file": "Copy",
  "rag-memory": "检索",
  "web-browsing": "Browse",
  "web-scraping": "Scrape",
  memory: "记忆",
  "chat-history": "历史",
};

function basename(pathLike = "") {
  const s = String(pathLike).replace(/\\/g, "/").trim();
  if (!s) return "";
  const parts = s.split("/").filter(Boolean);
  return parts[parts.length - 1] || s;
}

function shortTarget(value, max = 40) {
  const s = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function labelForTool(name = "") {
  if (!name) return "Tool";
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  const bare = String(name).replace(/^filesystem-/, "").replace(/[-_]/g, " ");
  const first = bare.split(" ")[0] || name;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function targetFromArgs(name, args = {}) {
  if (!args || typeof args !== "object") return "";
  const path =
    args.path ||
    args.file_path ||
    args.filepath ||
    args.filename ||
    args.file ||
    args.target ||
    null;
  if (path) return shortTarget(basename(path) || path);

  if (Array.isArray(args.paths) && args.paths.length) {
    const first = basename(args.paths[0]);
    return args.paths.length > 1
      ? `${shortTarget(first)} +${args.paths.length - 1}`
      : shortTarget(first);
  }

  const query =
    args.query ||
    args.pattern ||
    args.keyword ||
    args.q ||
    args.search ||
    args.glob ||
    args.command ||
    args.cmd ||
    args.url ||
    args.prompt ||
    null;
  if (query) return shortTarget(query);
  return "";
}

/**
 * @param {string} name
 * @param {object} args
 * @returns {string} e.g. "▸ Read notes.md"
 */
function formatToolActivityLabel(name, args = {}) {
  const label = labelForTool(name);
  const target = targetFromArgs(name, args);
  const body = target ? `${label} ${target}` : label;
  return `▸ ${body}`;
}

module.exports = {
  formatToolActivityLabel,
  labelForTool,
  targetFromArgs,
};
