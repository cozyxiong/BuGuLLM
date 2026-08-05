/**
 * Helpers for assistant (filesystem) citations:
 * - vault-relative paths for UI open/locate
 * - refine long file bodies to the section/lines mentioned in the final answer
 * - only attach sources for concrete Q&A prompts (not summarize/edit/create ops)
 */

/**
 * Whether this user turn should show sources in the UI.
 * Concrete questions → yes; summarize / rewrite / create / move / organize → no.
 * @param {string} userPrompt
 * @returns {boolean}
 */
function shouldAttachAgentSources(userPrompt = "") {
  const p = String(userPrompt || "").trim();
  if (!p) return false;

  // Write / organize / summarize style tasks — never attach sources
  const operationRe =
    /(总结|摘要|概括|通读|整理|归纳|改写|润色|修改|编辑|重写|扩写|缩写|创建|新建|生成|写一[个份篇]|写个|写入|写到|放到|移到|移动|挪到|复制|删除|重命名|拆分|合并|翻译|排版|格式化|补全|完善|起草|起个名|新建文件夹|创建文件夹|批量)/i;
  if (operationRe.test(p)) return false;

  // Explicit question marks
  if (/[?？]/.test(p)) return true;

  // Chinese / English question patterns (concrete Q&A)
  if (
    /(是什么|什么是|有哪些|有什么|哪些|哪个|如何|怎样|怎么|为什么|为何|吗$|呢$|多少|几个|区别|对比|相比|介绍一下|解释一下|讲一下|说说|列举|列出|定义)/.test(
      p
    )
  )
    return true;
  if (/^(what|how|why|which|where|who|when|list|explain|compare|define)\b/i.test(p))
    return true;

  // Default: treat as non-Q&A (e.g. vague "继续", "好的") — no sources
  return false;
}

/**
 * @param {string} absOrRel
 * @param {string[]} allowedDirs absolute allowed roots
 * @returns {string} vault-relative path with /
 */
function toVaultRelativePath(absOrRel, allowedDirs = []) {
  const path = require("path");
  let p = String(absOrRel || "")
    .trim()
    .replace(/\\/g, "/");
  if (!p) return "";

  for (const dir of allowedDirs) {
    const root = String(dir || "")
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
    if (!root) continue;
    const abs = path.resolve(absOrRel).replace(/\\/g, "/");
    const rootAbs = path.resolve(dir).replace(/\\/g, "/");
    if (abs === rootAbs) return ".";
    if (abs.startsWith(rootAbs + "/")) {
      return abs.slice(rootAbs.length + 1);
    }
  }

  // strip common vault/<slug>/ prefix if present
  const m = p.match(/(?:^|\/)vault\/[^/]+\/(.+)$/i);
  if (m) return m[1];
  // windows drive absolute left as basename path attempt
  if (/^[a-zA-Z]:\//.test(p)) {
    const parts = p.split("/");
    const ai = parts.findIndex((x) => x === "AI" || x.endsWith(".md"));
    if (ai >= 0) return parts.slice(ai).join("/");
  }
  return p.replace(/^\/+/, "");
}

/**
 * Build a stable filesystem citation object.
 */
function buildFsCitation({
  absPath,
  content,
  allowedDirs = [],
  score = null,
}) {
  const rel = toVaultRelativePath(absPath, allowedDirs) || String(absPath || "");
  const path = require("path");
  const base = path.basename(rel);
  return {
    id: `fs:${rel}`,
    title: rel.includes("/") ? rel : base,
    text: String(content || ""),
    chunkSource: `vault://${rel.replace(/^vault:\/\//i, "")}`,
    parent_document: rel,
    docSource: `vault://${rel}`,
    score,
    pending: false,
  };
}

/**
 * Dedupe citations by parent_document / chunkSource / id; keep longest text.
 * @param {object[]} citations
 */
function dedupeCitations(citations = []) {
  const map = new Map();
  for (const c of citations || []) {
    if (!c) continue;
    const key =
      c.parent_document ||
      String(c.chunkSource || "")
        .replace(/^vault:\/\//i, "")
        .replace(/\\/g, "/") ||
      c.id ||
      c.title;
    if (!key) continue;
    const prev = map.get(key);
    const text = String(c.text || "");
    if (!prev || text.length >= String(prev.text || "").length) {
      map.set(key, { ...c, text });
    }
  }
  return [...map.values()];
}

function extractSectionHints(answerText = "") {
  const raw = String(answerText || "");
  const hints = {
    lineStart: null,
    lineEnd: null,
    headings: [],
    paths: [],
  };

  // 第 452–510 行 / 第452-510行
  const lineRe =
    /第\s*(\d{1,6})\s*[-–—~～至到]\s*(\d{1,6})\s*行/g;
  let m;
  while ((m = lineRe.exec(raw)) !== null) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      hints.lineStart = Math.min(a, b);
      hints.lineEnd = Math.max(a, b);
    }
  }

  // 「索引」小节 / 「3. Embedding 算法」章节
  const quoteRe = /[「『"“]([^」』"”]{1,40})[」』"”]/g;
  while ((m = quoteRe.exec(raw)) !== null) {
    const t = m[1].trim();
    if (t && !/^\d+$/.test(t)) hints.headings.push(t);
  }

  // `AI/RAG.md` or AI/RAG.md
  const pathRe =
    /`?((?:[\w\u4e00-\u9fff.-]+\/)+[\w\u4e00-\u9fff.-]+\.(?:md|markdown|txt|mdx))`?/gi;
  while ((m = pathRe.exec(raw)) !== null) {
    hints.paths.push(m[1].replace(/\\/g, "/"));
  }

  return hints;
}

/**
 * Extract markdown section whose heading matches hint (substring, loose).
 * @param {string} doc
 * @param {string} headingHint
 */
function sliceByHeading(doc, headingHint) {
  const text = String(doc || "").replace(/\r\n/g, "\n");
  const hint = String(headingHint || "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!hint || text.length < 20) return null;

  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let m;
  while ((m = headingRe.exec(text)) !== null) {
    headings.push({
      level: m[1].length,
      title: m[2].replace(/\*+/g, "").trim(),
      index: m.index,
      endLine: m.index + m[0].length,
    });
  }
  if (!headings.length) return null;

  let best = null;
  let bestScore = 0;
  for (const h of headings) {
    const norm = h.title.replace(/\s+/g, "").toLowerCase();
    let score = 0;
    if (norm === hint) score = 100;
    else if (norm.includes(hint) || hint.includes(norm)) score = 80;
    else {
      // digit-prefix titles: "3. Embedding算法" vs "Embedding算法"
      const stripped = norm.replace(/^\d+[\.、．\s]*/, "");
      if (stripped && (stripped.includes(hint) || hint.includes(stripped)))
        score = 70;
    }
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  if (!best || bestScore < 70) return null;

  const start = best.index;
  let end = text.length;
  for (const h of headings) {
    if (h.index > start && h.level <= best.level) {
      end = h.index;
      break;
    }
  }
  const slice = text.slice(start, end).trim();
  return slice.length >= 20 ? slice : null;
}

/**
 * @param {string} doc
 * @param {number} lineStart 1-based
 * @param {number} lineEnd 1-based inclusive
 */
function sliceByLines(doc, lineStart, lineEnd) {
  const lines = String(doc || "").replace(/\r\n/g, "\n").split("\n");
  if (!lines.length) return null;
  const s = Math.max(1, lineStart) - 1;
  const e = Math.min(lines.length, Math.max(lineStart, lineEnd));
  if (s >= lines.length) return null;
  const slice = lines.slice(s, e).join("\n").trim();
  return slice.length >= 12 ? slice : null;
}

/**
 * Refine citations using the final answer text (paths / headings / line ranges).
 * @param {string} answerText
 * @param {object[]} citations
 * @returns {object[]}
 */
function refineCitationsWithAnswer(answerText, citations = []) {
  const list = dedupeCitations(citations);
  if (!list.length) return list;
  const hints = extractSectionHints(answerText);

  return list.map((c) => {
    const full = String(c.text || "");
    if (full.length < 40) return c;

    let focused = null;
    let method = null;

    // Prefer section title from the answer (「索引」), then line ranges
    if (hints.headings.length) {
      for (const h of hints.headings) {
        focused = sliceByHeading(full, h);
        if (focused) {
          method = "agent-heading";
          break;
        }
      }
    }

    if (!focused && hints.lineStart && hints.lineEnd) {
      focused = sliceByLines(full, hints.lineStart, hints.lineEnd);
      if (focused) method = "agent-line-range";
    }

    // Prefer citation matching a path mentioned in the answer
    const rel = String(c.parent_document || c.title || "").replace(/\\/g, "/");
    const pathMentioned =
      !hints.paths.length ||
      hints.paths.some(
        (p) =>
          rel.endsWith(p) ||
          rel.includes(p) ||
          p.endsWith(rel) ||
          rel.endsWith(p.split("/").pop())
      );

    if (!focused) {
      // Still fix display: if long multi-heading doc and no hint, keep opening section only up to ~2500 chars of first real section after title
      if (full.length > 4000) {
        const first = sliceByHeading(full, hints.headings[0] || "") || null;
        if (first) {
          focused = first;
          method = "agent-heading";
        } else {
          // first 2 headings block: from start to 3rd heading or 3500 chars
          const headingRe = /^#{1,6}\s+.+$/gm;
          const ms = [...full.matchAll(headingRe)];
          if (ms.length >= 2) {
            const end = ms[Math.min(2, ms.length - 1)].index;
            focused = full.slice(0, Math.max(end, 800)).trim();
            method = "agent-prefix";
          }
        }
      }
    }

    if (!focused) return { ...c, pathMentioned };

    return {
      ...c,
      text: focused,
      surroundingText: focused,
      alignedPassage: focused,
      alignmentMethod: method,
      pending: false,
      pathMentioned,
    };
  }).sort((a, b) => {
    // Mentioned paths first
    if (a.pathMentioned && !b.pathMentioned) return -1;
    if (!a.pathMentioned && b.pathMentioned) return 1;
    return 0;
  });
}

module.exports = {
  shouldAttachAgentSources,
  toVaultRelativePath,
  buildFsCitation,
  dedupeCitations,
  refineCitationsWithAnswer,
  extractSectionHints,
  sliceByHeading,
  sliceByLines,
};
