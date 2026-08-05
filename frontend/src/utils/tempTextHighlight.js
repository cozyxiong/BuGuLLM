/**
 * 引用来源定位滚动（不高亮）
 *
 * - quote = 悬停来源正文（同源）
 * - 优先用正文开头锚定，再滚动到对应 DOM 块
 */

function normalizeWs(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 数字点后补空格：2.Embedding → 2. Embedding */
function normalizeNumberDot(s) {
  return String(s || "").replace(/(\d+)\.(\S)/g, "$1. $2");
}

function stripMdLite(s) {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, (m) => m) // 保留 "2. " 编号，只去掉无编号列表时下面处理
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/---+/g, " ");
}

export function quoteToVisiblePlain(quote) {
  return normalizeWs(normalizeNumberDot(stripMdLite(quote)));
}

/** 悬停正文按行（保持顺序，用于锚定开头） */
function quoteLines(quote) {
  const plain = normalizeNumberDot(stripMdLite(quote));
  return plain
    .split(/\n+/)
    .map((l) => normalizeWs(l))
    .filter((l) => l.length >= 2);
}

/**
 * 开头锚定针：叶子节标题行（quote 已是叶子标题+正文，首行即叶子标题）
 * 避免用父级路径或过短通用词抢匹配
 */
function buildAnchorNeedles(quote) {
  const lines = quoteLines(quote);
  const plain = quoteToVisiblePlain(quote);
  const out = [];
  const push = (s) => {
    const n = normalizeWs(normalizeNumberDot(s));
    // 过短（如仅「模型」）不锚
    if (n.length >= 6 && !out.includes(n)) out.push(n);
  };

  if (lines[0]) {
    push(lines[0]);
    push(lines[0].replace(/[:：]\s*$/, ""));
    // 去掉 markdown 加粗残留
    push(lines[0].replace(/\*+/g, ""));
  }
  // 叶子标题 + 首段正文前缀
  if (lines[0] && lines[1]) push(`${lines[0]} ${lines[1]}`);

  for (const len of [100, 64, 40, 24]) {
    if (plain.length >= len) push(plain.slice(0, len));
  }

  out.sort((a, b) => b.length - a.length);
  return out;
}

export function buildExactNeedles(quote) {
  const raw = String(quote || "").trim();
  if (!raw) return [];
  const candidates = [
    quoteToVisiblePlain(raw),
    normalizeWs(normalizeNumberDot(raw)),
    quoteToVisiblePlain(raw.replace(/^#{1,6}\s+.+\n+/, "")),
  ];
  const out = [];
  for (const c of candidates) {
    if (c.length >= 6 && !out.includes(c)) out.push(c);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

export function buildSearchNeedles(quote) {
  return buildExactNeedles(quote);
}

function buildDomNormMap(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue) nodes.push(node);
  }

  let full = "";
  const map = [];
  for (const n of nodes) {
    const raw = n.nodeValue;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (/\s/.test(ch) || ch === "\u00a0" || /[\u200b\u200c\u200d\ufeff]/.test(ch)) {
        if (!full.length || full[full.length - 1] === " ") continue;
        full += " ";
        map.push({ node: n, offset: i });
      } else {
        full += ch;
        map.push({ node: n, offset: i });
      }
    }
  }
  // 再归一化一次数字点，方便 "2.Embedding" / "2. Embedding"
  // 注意：改 full 会破坏 map 对齐，故匹配时对 needle 和 full 都做 number-dot 归一
  return { full: normalizeNumberDot(full).replace(/\s+/g, " "), map, rawFull: full };
}

/**
 * full 与 needle 都按 normalizeNumberDot + 空白处理后再找
 * map 索引：用 rawFull 构建时与 full 长度可能略有差异，故重新用统一算法
 */
function buildDomNormMapV2(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue) nodes.push(node);
  }

  // 先拼出原始字符流 + 映射
  let raw = "";
  const rawMap = [];
  for (const n of nodes) {
    const v = n.nodeValue;
    for (let i = 0; i < v.length; i++) {
      raw += v[i];
      rawMap.push({ node: n, offset: i });
    }
  }

  // 归一化：空白压成单空格，2.X → 2. X，零宽去掉；记录 norm[i] → rawMap 下标
  let full = "";
  const map = [];
  for (let i = 0; i < raw.length; i++) {
    let ch = raw[i];
    if (/[\u200b\u200c\u200d\ufeff]/.test(ch)) continue;
    if (ch === "\u00a0" || /\s/.test(ch)) {
      if (!full.length || full[full.length - 1] === " ") continue;
      full += " ";
      map.push(rawMap[i]);
      continue;
    }
    // 数字.非空白 → 插入空格
    if (
      full.length >= 1 &&
      /\d/.test(full[full.length - 1]) &&
      ch === "." &&
      i + 1 < raw.length &&
      raw[i + 1] &&
      !/\s/.test(raw[i + 1]) &&
      /[A-Za-z\u4e00-\u9fff]/.test(raw[i + 1])
    ) {
      full += ". ";
      map.push(rawMap[i]);
      // 空格映射到同一位置
      map.push(rawMap[i]);
      continue;
    }
    full += ch;
    map.push(rawMap[i]);
  }
  full = full.trim();
  // trim 可能导致 map 与 full 略不齐：简单处理 leading spaces already skipped
  return { full, map };
}

function scrollToEl(el) {
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    return true;
  } catch {
    try {
      el.scrollIntoView(true);
      return true;
    } catch {
      return false;
    }
  }
}

function findBlock(node, root) {
  let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (el && el !== root) {
    const tag = el.tagName;
    if (/^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|PRE|TD|TH)$/i.test(tag)) {
      const t = (el.innerText || "").trim();
      if (t.length > 0 && t.length < 8000) return el;
    }
    if (
      tag === "DIV" &&
      el.getAttribute("contenteditable") !== "true" &&
      !el.classList?.contains("vditor-reset") &&
      !el.classList?.contains("vditor-wysiwyg")
    ) {
      const t = (el.innerText || "").trim();
      if (t.length > 0 && t.length < 2000) return el;
    }
    el = el.parentElement;
  }
  return node?.parentElement || null;
}

function findInNormMap(full, map, needles, fromIndex = 0) {
  for (const n of needles) {
    if (!n || n.length < 4) continue;
    const idx = full.indexOf(n, fromIndex);
    if (idx >= 0 && map[idx]) {
      return { start: idx, length: n.length, needle: n };
    }
  }
  return null;
}

/** 在 DOM 中定位 quote 并滚动到对应块（不高亮） */
export function scrollToQuoteInDom(root, quote) {
  if (!root || !quote) return false;
  const { full, map } = buildDomNormMapV2(root);
  if (!full || !map.length) return false;
  const hit =
    findInNormMap(full, map, buildAnchorNeedles(quote)) ||
    findInNormMap(full, map, buildExactNeedles(quote)) ||
    findInNormMap(full, map, buildScrollNeedlesLoose(quote));
  if (!hit) return false;
  const el =
    findBlock(map[hit.start].node, root) || map[hit.start].node.parentElement;
  return scrollToEl(el);
}

/** @deprecated 仅滚动，保留函数名避免外部误用高亮 API */
export function applyTempTextHighlight(root, quote) {
  const scrolled = scrollToQuoteInDom(root, quote);
  return {
    highlighted: false,
    scrolled,
    mode: scrolled ? "scroll-only" : "miss",
  };
}

function buildScrollNeedlesLoose(quote) {
  const plain = quoteToVisiblePlain(quote);
  const out = [];
  const push = (s) => {
    const n = normalizeWs(s);
    if (n.length >= 8 && !out.includes(n)) out.push(n);
  };
  push(plain);
  quoteLines(quote).forEach(push);
  for (const len of [80, 48, 28, 16]) {
    if (plain.length >= len) push(plain.slice(0, len));
  }
  return out;
}

export function findQuoteInMarkdown(md, quote) {
  const text = String(md || "");
  if (!text || !quote) return null;

  const needles = [
    ...buildAnchorNeedles(quote),
    ...buildExactNeedles(quote),
    ...buildScrollNeedlesLoose(quote),
  ];

  for (const n of needles) {
    // 原文
    let idx = text.indexOf(n);
    if (idx < 0) {
      const t2 = normalizeNumberDot(text);
      idx = t2.indexOf(n);
      if (idx >= 0) {
        // 近似
        const pref = n.slice(0, Math.min(12, n.length));
        const raw = text.indexOf(pref) >= 0 ? text.indexOf(pref) : idx;
        return { start: raw, length: n.length };
      }
    } else {
      return { start: idx, length: n.length };
    }
  }

  // 归一化全文
  let norm = "";
  const map = [];
  const normalizedText = normalizeNumberDot(text);
  for (let i = 0; i < normalizedText.length; i++) {
    const ch = normalizedText[i];
    if (/\s/.test(ch)) {
      if (!norm.length || norm[norm.length - 1] === " ") continue;
      norm += " ";
      map.push(i);
    } else {
      norm += ch;
      map.push(i);
    }
  }
  for (const n of needles) {
    const nn = normalizeWs(n);
    const idx = norm.indexOf(nn);
    if (idx >= 0 && map[idx] != null) {
      return { start: map[idx], length: n.length };
    }
  }
  return null;
}

export function scrollByMarkdownOffset(scrollRoot, md, offset) {
  if (!scrollRoot || !md || offset == null || offset < 0) return false;
  const len = Math.max(1, String(md).length);
  const ratio = Math.min(1, Math.max(0, offset / len));
  const chain = [];
  let el = scrollRoot;
  for (let i = 0; i < 8 && el; i++) {
    chain.push(el);
    el = el.parentElement;
  }
  let target = scrollRoot;
  for (const c of chain) {
    if (c.scrollHeight > c.clientHeight + 20) {
      target = c;
      break;
    }
  }
  const maxScroll = target.scrollHeight - target.clientHeight;
  if (maxScroll <= 0) return false;
  target.scrollTo({
    top: Math.max(0, ratio * maxScroll - target.clientHeight * 0.25),
    behavior: "smooth",
  });
  return true;
}

export function getVditorScrollRoot(container) {
  if (!container) return null;
  const candidates = [
    container.querySelector(".vditor-wysiwyg"),
    container.querySelector(".vditor-content"),
    container.querySelector(".vditor-ir"),
    container.closest?.(".flex-1"),
    container.parentElement,
    container,
  ].filter(Boolean);
  for (const el of candidates) {
    if (el.scrollHeight > el.clientHeight + 8) return el;
  }
  return candidates[0] || null;
}

export function getVditorContentRoot(container) {
  if (!container) return null;
  return (
    container.querySelector(".vditor-wysiwyg .vditor-reset") ||
    container.querySelector(".vditor-wysiwyg") ||
    container.querySelector(".vditor-ir .vditor-reset") ||
    container.querySelector(".vditor-reset") ||
    container
  );
}
