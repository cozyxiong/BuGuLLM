/**
 * Parse agent status / tool-call messages into Grok-style short activity steps.
 * Returns { label, kind, target } for timeline icons.
 */

const NOISE_PATTERNS = [
  /^tool use completed\.?$/i,
  /^the tool call has direct output/i,
  /^maximum tool call limit/i,
  /^\[debug\]/i,
  /^error encountered while running/i,
  /^user stopped/i,
  /^content split into/i,
  /^captured \d+/i,
  /^skill .+ is /i,
  // Terminal / lifecycle chatter — never show as tool-chain steps
  /^agent session complete\.?$/i,
  /^助手模式[：:]/i,
  /^助手会话/i,
  /^agent session (start|started|end|ended)/i,
  /^detected leaked tool/i,
  /^检测到未通过原生工具/i,
];

/** Map tool name → kind used for icon + Chinese phrasing */
const TOOL_KIND = {
  "filesystem-read-text-file": "read",
  "filesystem-read-multiple-files": "read",
  "filesystem-write-text-file": "write",
  "filesystem-edit-file": "edit",
  "filesystem-search-files": "search",
  "filesystem-list-directory": "list",
  "filesystem-run-command": "run",
  "filesystem-get-file-info": "info",
  "filesystem-create-directory": "mkdir",
  "filesystem-create-dir": "mkdir",
  "filesystem-move-file": "move",
  "filesystem-copy-file": "copy",
  "rag-memory": "search",
  "web-browsing": "browse",
  "web-scraping": "browse",
  memory: "memory",
  "chat-history": "history",
  "create-text-file": "write",
  "create-docx-file": "write",
  "create-pdf-file": "write",
  "create-excel-file": "write",
  "create-presentation": "write",
};

const KIND_VERB = {
  read: "已读取",
  write: "已写入",
  edit: "已编辑",
  search: "已搜索",
  list: "已列出",
  run: "已执行",
  info: "已查看",
  mkdir: "已创建目录",
  move: "已移动",
  copy: "已复制",
  browse: "已浏览",
  memory: "已回忆",
  history: "已查阅历史",
  tool: "已调用",
};

function basename(pathLike = "") {
  const s = String(pathLike).replace(/\\/g, "/").trim();
  if (!s) return "";
  const parts = s.split("/").filter(Boolean);
  return parts[parts.length - 1] || s;
}

function shortTarget(value, max = 48) {
  const s = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function kindFromSkillName(name = "") {
  if (TOOL_KIND[name]) return TOOL_KIND[name];
  if (/search|rag|retriev/i.test(name)) return "search";
  if (/read|get|fetch/i.test(name)) return "read";
  if (/write|create|save|mkdir|directory/i.test(name)) {
    if (/directory|mkdir/i.test(name)) return "mkdir";
    return "write";
  }
  if (/edit|update|patch/i.test(name)) return "edit";
  if (/list|dir/i.test(name)) return "list";
  if (/run|bash|shell|command/i.test(name)) return "run";
  if (/web|browse|scrape/i.test(name)) return "browse";
  return "tool";
}

function kindForTool(name = "") {
  return kindFromSkillName(name);
}

function targetFromArgs(args = {}) {
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
      ? `${shortTarget(first)} 等 ${args.paths.length} 项`
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
 * English-style short: "Read notes.md"
 */
export function formatToolStep(name, args = {}) {
  const kind = kindForTool(name);
  const verb =
    {
      read: "Read",
      write: "Write",
      edit: "Edit",
      search: "Search",
      list: "List",
      run: "Run",
      info: "Info",
      mkdir: "Mkdir",
      move: "Move",
      copy: "Copy",
      browse: "Browse",
      memory: "Memory",
      history: "History",
      tool: "Tool",
    }[kind] || "Tool";
  const target = targetFromArgs(args);
  return target ? `${verb} ${target}` : verb;
}

/**
 * Grok Chinese-style: "已读取 notes.md" / "已搜索 微服务"
 */
export function formatToolStepZh(name, args = {}) {
  const kind = kindForTool(name);
  const verb = KIND_VERB[kind] || "已调用";
  const target = targetFromArgs(args);
  if (!target) return `${verb} ${name}`;
  // Search phrasing closer to Grok: "已搜索 为 xxx" feels odd; use "已搜索 xxx"
  return `${verb} ${target}`;
}

function parseToolFromContent(content = "") {
  const text = String(content).trim();

  // Preferred: ▸ Read notes.md  or  ▸ 已读取 notes.md
  const structured = text.match(/^▸\s+(.+)$/);
  if (structured) {
    const body = structured[1].trim();
    // Try recover kind from English verb prefix
    const eng = body.match(
      /^(Read|Write|Edit|Search|List|Run|Info|Mkdir|Move|Copy|Browse|Memory|History|Tool)\s*(.*)$/i
    );
    if (eng) {
      const kind = eng[1].toLowerCase();
      const target = eng[2]?.trim() || "";
      return {
        kind,
        label: target
          ? `${KIND_VERB[kind] || eng[1]} ${target}`
          : KIND_VERB[kind] || eng[1],
        target,
        raw: body,
      };
    }
    return { kind: "tool", label: body, target: "", raw: body };
  }

  // Assembling Tool Call: name({...})
  const assembling = text.match(
    /Assembling Tool Call:\s*([a-zA-Z0-9_.-]+)\s*\(([\s\S]*)\)\s*$/i
  );
  if (assembling) {
    const name = assembling[1];
    let args = {};
    try {
      args = JSON.parse(assembling[2] || "{}");
    } catch {
      const pathHint = assembling[2]?.match(
        /"(?:path|file_path|filename|query|pattern|command|url)"\s*:\s*"([^"]+)"/
      );
      if (pathHint) args = { path: pathHint[1], query: pathHint[1] };
    }
    return {
      kind: kindForTool(name),
      label: formatToolStepZh(name, args),
      target: targetFromArgs(args),
      raw: name,
    };
  }

  // executing `name` tool {...}
  const executing = text.match(
    /executing\s+`([a-zA-Z0-9_.-]+)`\s+tool\s*([\s\S]*)/i
  );
  if (executing) {
    const name = executing[1];
    let args = {};
    try {
      args = JSON.parse(executing[2] || "{}");
    } catch {
      const pathHint = executing[2]?.match(
        /"(?:path|file_path|filename|query|pattern|command|url)"\s*:\s*"([^"]+)"/
      );
      if (pathHint) args = { path: pathHint[1], query: pathHint[1] };
    }
    return {
      kind: kindForTool(name),
      label: formatToolStepZh(name, args),
      target: targetFromArgs(args),
      raw: name,
    };
  }

  const bare = text.match(
    /\b((?:filesystem|rag|web|sql|gmail|outlook|gcal)[-a-z0-9]+)\b/i
  );
  if (bare && text.length < 120) {
    return {
      kind: kindForTool(bare[1]),
      label: formatToolStepZh(bare[1], {}),
      target: "",
      raw: bare[1],
    };
  }

  return null;
}

function isNoise(content = "") {
  const t = String(content).trim();
  if (!t) return true;
  if (t.length > 280) return true;
  return NOISE_PATTERNS.some((re) => re.test(t));
}

function stepKey(step) {
  return `${step.kind}|${step.label}`;
}

function upsertStep(steps, step) {
  if (!step?.label) return;
  for (let i = 0; i < steps.length; i++) {
    const existing = steps[i];
    if (stepKey(existing) === stepKey(step)) return;
    // Same kind refining target (Read → Read notes.md)
    if (
      existing.kind === step.kind &&
      (step.label.startsWith(existing.label) ||
        existing.label.startsWith(step.label) ||
        i === steps.length - 1)
    ) {
      if (step.label.length >= existing.label.length) steps[i] = step;
      return;
    }
  }
  steps.push(step);
}

/**
 * @param {Array<{content?: string, type?: string}>} messages
 * @returns {Array<{kind: string, label: string, target: string}>}
 */
export function extractActivitySteps(messages = []) {
  const steps = [];

  for (const msg of messages) {
    const content = msg?.content;
    if (content == null) continue;
    if (isNoise(content)) continue;

    const parsed = parseToolFromContent(content);
    if (parsed) {
      upsertStep(steps, parsed);
      continue;
    }

    const t = String(content).trim();
    if (t.length <= 56) {
      upsertStep(steps, { kind: "think", label: t, target: "", raw: t });
    }
  }

  return steps;
}

/**
 * Summarize for collapsed header (legacy string form)
 */
export function summarizeSteps(steps = [], maxVisible = 3) {
  const labels = steps.map((s) => (typeof s === "string" ? s : s.label));
  if (!labels.length) return "";
  if (labels.length <= maxVisible) return labels.join(" · ");
  return `${labels.slice(0, maxVisible).join(" · ")} · +${labels.length - maxVisible}`;
}

export function formatElapsed(ms) {
  if (ms == null || ms < 0) return null;
  // Sub-second / flash activity shouldn't render as "思考了 0s"
  if (ms < 500) return null;
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
