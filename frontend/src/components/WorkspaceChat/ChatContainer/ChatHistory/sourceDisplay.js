/**
 * 来源展示：优先消费服务端 citationAlign 的结果（闭包对齐后的段落）。
 *
 * 服务端字段（见 server/utils/chats/citationAlign.js）：
 * - alignedPassage / text / surroundingText：裁剪后的展示正文
 * - alignedHeading：所属标题
 * - alignmentMethod: "ngram-claim-union" | ...
 */
import { decode as HTMLDecode } from "he";
import renderMarkdown from "@/utils/chat/markdown";
import DOMPurify from "@/utils/chat/purify";
import { omitChunkHeader } from "./Citation";

function stripThinkClient(s = "") {
  return String(s)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
}

function looksLikeReasoningJunk(text = "") {
  const t = String(text || "");
  if (/<think>|<\/think>/i.test(t)) return true;
  if (
    /\b(we need to parse|compare them to the document|entailment|claimIndex|decide for each claim)\b/i.test(
      t
    )
  )
    return true;
  if (/(我们需要|逐条判断|是否被文档支撑|逻辑蕴含)/.test(t)) return true;
  return false;
}

/**
 * 只保留「叶子节标题 + 正文」：
 * - 去掉 document_metadata
 * - 去掉检索用 [章节] 祖先路径行
 * - 若有多个 Markdown 标题，从最后一个标题起截（叶子节）
 */
function toLeafSectionText(s) {
  let t = String(s || "").replace(/\r\n/g, "\n");

  // 嵌入管线 / 切块可能带的元数据
  if (t.includes("<document_metadata>") && t.includes("</document_metadata>")) {
    t = t
      .split("</document_metadata>")
      .slice(1)
      .join("</document_metadata>")
      .trim();
  }

  // 旧版嵌入写入的祖先路径前缀
  t = t.replace(/^\[章节\][^\n]*\n+/u, "").trim();

  // 多个 # 标题时，只保留最后一个标题及其后正文（叶子节）
  const headingRe = /^#{1,6}\s+.+$/gm;
  const matches = [...t.matchAll(headingRe)];
  if (matches.length >= 2) {
    const last = matches[matches.length - 1];
    t = t.slice(last.index).trim();
  }

  return t;
}

function cleanText(s, { preserveStructure = false } = {}) {
  let t = HTMLDecode(omitChunkHeader(String(s || "")))
    .replace(/\r\n/g, "\n")
    .trim();
  t = stripThinkClient(t);
  if (looksLikeReasoningJunk(t)) return "";
  // 助手已按小节/行号裁好的正文不要再截成「最后一个标题」
  if (!preserveStructure) t = toLeafSectionText(t);
  return t.trim();
}

function md(htmlSource) {
  if (!htmlSource?.trim()) return "";
  try {
    return DOMPurify.sanitize(renderMarkdown(htmlSource));
  } catch {
    const esc = String(htmlSource)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre class="nl-src-plain">${esc}</pre>`;
  }
}

/** 仍导出：前端角标旁可取 claim 做展示，但不用于关键字猜库 */
export function extractClaimNearCitation(answerText = "", citeNum = 1) {
  if (!answerText) return "";
  const raw = String(answerText)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
  const marker = `[${citeNum}]`;
  const idx = raw.indexOf(marker);
  if (idx < 0) return "";
  const lineStart = raw.lastIndexOf("\n", idx - 1) + 1;
  let lineEnd = raw.indexOf("\n", idx);
  if (lineEnd < 0) lineEnd = raw.length;
  return raw
    .slice(lineStart, lineEnd)
    .replace(marker, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

/** 来源正文 HTML（不打高亮 mark） */
function renderPassageHtml(passage) {
  const text = cleanText(passage);
  if (!text) return "";
  return `<div class="nl-src-body">${md(text)}</div>`;
}

/**
 * 统一解析来源展示数据：服务端对齐优先
 */
export function resolveSourceFocus(source = {}, _claim = "") {
  // 对齐尚未完成：不展示可能错误的全文
  if (source?.pending) {
    return {
      sectionText: "",
      previewText: "",
      claim: _claim || "",
      matched: false,
      pending: true,
      heading: null,
      matchScore: 0,
      alignmentMethod: null,
    };
  }

  // 服务端已对齐/助手按小节裁剪的内容：保留结构，勿再截叶子节
  const preserveStructure = Boolean(source.alignmentMethod);
  const passage = cleanText(
    source.alignedPassage ||
      source.surroundingText ||
      source.text ||
      "",
    { preserveStructure }
  );
  const heading = source.alignedHeading || null;
  const matched = Boolean(source.alignmentMethod || source.alignedPassage || passage);

  return {
    sectionText: passage,
    previewText: passage,
    claim: _claim || "",
    matched,
    pending: false,
    heading,
    matchScore: source.alignmentScore || 0,
    alignmentMethod: source.alignmentMethod || null,
  };
}

/** 侧栏阅读区：整段展示，不高亮 */
export function renderSourceReaderHtml(source, claim = "") {
  const focus = resolveSourceFocus(source, claim);
  if (focus.pending) {
    return `<div class="nl-src-body muted">来源定位中，请稍候…</div>`;
  }
  if (!focus.sectionText) return "";
  return renderPassageHtml(focus.sectionText);
}

/** 与悬停预览同一段纯文本（点击后编辑器滚动定位用） */
export const SOURCE_PREVIEW_MAX_CHARS = 2200;

/**
 * 悬停预览正文；claim 参数仅兼容旧调用。
 * @returns {{ text: string, pending: boolean, empty: boolean }}
 */
export function getSourcePreviewPlainText(source = {}, claim = "", maxChars = SOURCE_PREVIEW_MAX_CHARS) {
  const focus = resolveSourceFocus(source, claim);
  if (focus.pending) return { text: "", pending: true, empty: true };
  // cleanText 已做 toLeafSectionText；再保险剥一层
  let text = toLeafSectionText(
    String(focus.previewText || focus.sectionText || "").trim()
  );
  if (!text) return { text: "", pending: false, empty: true };
  if (text.length > maxChars) {
    if (/^\s*```/.test(text) && !/```[\s]*$/.test(text.slice(-12))) {
      text = `${text.slice(0, maxChars).trim()}\n\`\`\``;
    } else {
      text = text.slice(0, maxChars).trim();
    }
  }
  return { text, pending: false, empty: false };
}

/** 悬停预览 */
export function renderSourcePreviewHtml(source, claim = "", maxChars = SOURCE_PREVIEW_MAX_CHARS) {
  const focus = resolveSourceFocus(source, claim);
  if (focus.pending) {
    return `<div class="nl-src-body muted">来源定位中…</div>`;
  }
  const { text, empty } = getSourcePreviewPlainText(source, claim, maxChars);
  if (empty || !text) {
    return `<div class="nl-src-body muted">暂无对齐片段</div>`;
  }
  const rawLen = (focus.previewText || focus.sectionText || "").length;
  const display =
    rawLen > maxChars && !/```[\s]*$/.test(text) ? `${text}…` : text;
  return `<div class="nl-src-body nl-src-preview">${md(display)}</div>`;
}

export function sourceDisplayTitle(source) {
  if (!source) return "来源文档";
  // 优先叶子节标题
  if (source.section_heading) {
    const base =
      String(source.parent_document || source.docSource || "")
        .replace(/^vault:\/\//i, "")
        .split("/")
        .pop() || "";
    const leaf = String(source.section_heading).replace(/\*+/g, "").trim();
    return base ? `${base} · ${leaf}` : leaf;
  }
  if (Array.isArray(source.section_path) && source.section_path.length) {
    const leaf = String(source.section_path[source.section_path.length - 1])
      .replace(/\*+/g, "")
      .trim();
    const file =
      String(source.parent_document || "")
        .replace(/^vault:\/\//i, "")
        .split("/")
        .pop() || "";
    return file ? `${file} · ${leaf}` : leaf;
  }
  const raw =
    source.title ||
    source.docSource ||
    source.chunkSource ||
    source.url ||
    "来源文档";
  // title 可能是「RAG.md · a > b > leaf」→ 只留文件名 · 最后一段
  let t = String(raw)
    .replace(/^vault:\/\//i, "")
    .replace(/^file:\/\//i, "")
    .trim();
  if (t.includes(" · ")) {
    const [file, rest] = t.split(/\s*·\s*/);
    if (rest && rest.includes(" > ")) {
      const leaf = rest.split(/\s*>\s*/).pop();
      return `${file} · ${leaf}`.trim();
    }
  }
  return t;
}

function normalizeVaultPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^vault:\/\//i, "")
    .replace(/^file:\/\//i, "")
    .replace(/#.*$/, "")
    .replace(/^\/+/, "")
    .trim();
}

/**
 * 从 citation source 解析 Vault 相对路径（用于打开编辑器）
 */
export function resolveVaultRelativePath(source = {}) {
  if (!source || source.pending) return null;

  if (source.parent_document) {
    const p = normalizeVaultPath(source.parent_document);
    if (p && !p.includes("embed-cache/")) return p;
  }

  for (const key of ["docSource", "chunkSource", "url", "id"]) {
    const raw = source[key];
    if (!raw || typeof raw !== "string") continue;
    if (/^vault:\/\//i.test(raw)) {
      const p = normalizeVaultPath(raw);
      if (p) return p;
    }
  }

  // title: "name.md · heading" 或纯文件名（弱回退）
  const title = String(source.title || "");
  const titled = title.split(/\s*[·•|]\s*/)[0]?.trim();
  if (titled && /\.(md|markdown|txt|mdx)$/i.test(titled) && !titled.includes("://")) {
    return normalizeVaultPath(titled);
  }

  return null;
}

/**
 * 点击跳转编辑器用的定位文案：与悬停预览正文一致
 */
export function getSourceHighlightQuote(source = {}, claim = "") {
  const { text, empty, pending } = getSourcePreviewPlainText(source, claim);
  if (pending || empty) return "";
  return text;
}

/** 构造侧栏树兼容的 file 节点 */
export function vaultPathToFileNode(relPath) {
  const path = normalizeVaultPath(relPath);
  if (!path) return null;
  const name = path.split("/").pop() || path;
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot).toLowerCase() : ".md";
  return {
    path,
    name,
    type: "file",
    extension,
  };
}
