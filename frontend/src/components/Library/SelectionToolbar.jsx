import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChatCircleDots,
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  Link,
  Code,
  CaretDown,
} from "@phosphor-icons/react";
import { persistVditor } from "./blockConvert";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";

const FONT_COLORS = [
  { id: "default", value: "" },
  { value: "#ef4444" },
  { value: "#f97316" },
  { value: "#eab308" },
  { value: "#22c55e" },
  { value: "#06b6d4" },
  { value: "#3b82f6" },
  { value: "#a855f7" },
];

const BG_COLORS = [
  { id: "none", value: "" },
  { value: "#e4e4e7" },
  { value: "#fecaca" },
  { value: "#fed7aa" },
  { value: "#fef08a" },
  { value: "#bbf7d0" },
  { value: "#bfdbfe" },
  { value: "#e9d5ff" },
];

function nodeEl(node) {
  return node?.nodeType === 1 ? node : node?.parentElement;
}

function closestInline(range, selector) {
  if (!range) return null;
  const start = nodeEl(range.startContainer);
  const end = nodeEl(range.endContainer);
  return start?.closest?.(selector) || end?.closest?.(selector) || null;
}

function unwrapEl(el) {
  if (!el?.parentNode) return;
  const parent = el.parentNode;
  const first = el.firstChild;
  const last = el.lastChild;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
  if (!first || !last) return;
  const r = document.createRange();
  r.setStartBefore(first);
  r.setEndAfter(last);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

function wrapRange(range, tag, attrs = {}) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  try {
    range.surroundContents(el);
  } catch {
    el.appendChild(range.extractContents());
    range.insertNode(el);
  }
  const r = document.createRange();
  r.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  return el;
}

function toggleInline(range, { tag, selector, attrs }) {
  if (!range) return;
  const existing = closestInline(range, selector);
  if (existing) unwrapEl(existing);
  else wrapRange(range, tag, attrs);
}

function inFenceBlock(el) {
  return !!el?.closest?.(".vditor-wysiwyg__block[data-type='code-block']");
}

function makeInlineCode() {
  const el = document.createElement("code");
  el.setAttribute("data-marker", "`");
  return el;
}

function selectRange(range) {
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/** 选区起点和终点都在同一个行内 code 里才算「正好在代码里」 */
function codeContainingRange(range) {
  if (!range) return null;
  const start = nodeEl(range.startContainer)?.closest?.("code");
  const end = nodeEl(range.endContainer)?.closest?.("code");
  if (!start || start !== end || inFenceBlock(start)) return null;
  if (!start.contains(range.startContainer) || !start.contains(range.endContainer)) {
    return null;
  }
  return start;
}

function isWholeCodeSelected(range, codeEl) {
  const all = document.createRange();
  all.selectNodeContents(codeEl);
  const a = (range.toString() || "").replace(/\u200b/g, "");
  const b = (all.toString() || "").replace(/\u200b/g, "");
  return a === b;
}

function splitInlineCode(codeEl, range) {
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(codeEl);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const afterRange = document.createRange();
  afterRange.selectNodeContents(codeEl);
  afterRange.setStart(range.endContainer, range.endOffset);

  const beforeText = beforeRange.toString();
  const midText = range.toString();
  const afterText = afterRange.toString();

  const frag = document.createDocumentFragment();
  if (beforeText.replace(/\u200b/g, "")) {
    const left = makeInlineCode();
    left.textContent = beforeText;
    frag.appendChild(left);
  }
  const midNode = document.createTextNode(midText);
  frag.appendChild(midNode);
  if (afterText.replace(/\u200b/g, "")) {
    const right = makeInlineCode();
    right.textContent = afterText;
    frag.appendChild(right);
  }
  codeEl.parentNode.replaceChild(frag, codeEl);
  const next = document.createRange();
  next.selectNode(midNode);
  selectRange(next);
}

function joinAsInlineCode(range) {
  const contents = range.extractContents();
  contents.querySelectorAll("code").forEach((node) => {
    if (inFenceBlock(node)) return;
    const parent = node.parentNode;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    node.remove();
  });
  let code = makeInlineCode();
  code.appendChild(contents);
  range.insertNode(code);
  const prev = code.previousSibling;
  if (prev?.nodeName === "CODE" && !inFenceBlock(prev)) {
    while (code.firstChild) prev.appendChild(code.firstChild);
    code.remove();
    code = prev;
  }
  const next = code.nextSibling;
  if (next?.nodeName === "CODE" && !inFenceBlock(next)) {
    while (next.firstChild) code.appendChild(next.firstChild);
    next.remove();
  }
  const nextRange = document.createRange();
  nextRange.selectNodeContents(code);
  selectRange(nextRange);
}

function readActive(range) {
  const el = nodeEl(range?.startContainer);
  return {
    bold: cmdState("bold") || !!el?.closest?.("strong, b"),
    italic: cmdState("italic") || !!el?.closest?.("em, i"),
    underline: !!el?.closest?.("u, [style*='underline']"),
    strike: cmdState("strikeThrough") || !!el?.closest?.("s, strike, del"),
    code: !!codeContainingRange(range),
  };
}

function editorSelection(wrap) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().replace(/\u200b/g, "").trim();
  if (!text) return null;
  const node = sel.anchorNode;
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  if (!el || !wrap?.contains(el)) return null;
  if (el.closest(".bagu-sel-toolbar, .bagu-block-menu, .bagu-block-handle")) {
    return null;
  }
  return { text, range: sel.getRangeAt(0).cloneRange() };
}

function headingLevel(node) {
  const m = /^H([1-6])$/.exec(node?.tagName || "");
  return m ? Number(m[1]) : 0;
}

function topChildOf(el, root) {
  let n = el;
  while (n && n.parentElement && n.parentElement !== root) n = n.parentElement;
  return n && n !== root && root.contains(n) ? n : null;
}

function extractPinContext(range, wrap) {
  const el = nodeEl(range?.commonAncestorContainer);
  const root = wrap?.querySelector?.(".vditor-reset") || wrap;
  if (!el || !root?.contains(el)) return "";
  const startBlock = topChildOf(el, root);
  if (!startBlock) {
    return (root.innerText || "").replace(/\u200b/g, "").trim();
  }
  let heading = headingLevel(startBlock) ? startBlock : null;
  if (!heading) {
    let prev = startBlock.previousElementSibling;
    while (prev) {
      if (headingLevel(prev)) {
        heading = prev;
        break;
      }
      prev = prev.previousElementSibling;
    }
  }
  const from = heading || root.firstElementChild;
  if (!from) return "";
  const level = headingLevel(from) || 99;
  const parts = [];
  for (let n = from; n; n = n.nextElementSibling) {
    if (n !== from && headingLevel(n) && headingLevel(n) <= level) break;
    const t = (n.innerText || "").replace(/\u200b/g, "").trim();
    if (t) parts.push(t);
  }
  return parts.join("\n\n");
}

function cmdState(name) {
  try {
    return document.queryCommandState(name);
  } catch {
    return false;
  }
}

export default function SelectionToolbar({
  containerRef,
  vditorRef,
  enabled = true,
}) {
  const { chatMode, setChatMode, pinSelection, clearSelectionPin } =
    useWorkspaceUI();
  const barRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [active, setActive] = useState({});
  const [colorOpen, setColorOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("https://");
  const savedRange = useRef(null);
  const interactingRef = useRef(false);
  const hideBarRef = useRef(false);

  const placeBar = useCallback((range) => {
    if (!range) return;
    const rects = range.getClientRects();
    const r = rects.length ? rects[0] : range.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) return;
    const bar = barRef.current;
    const bw = bar?.offsetWidth || 360;
    const bh = bar?.offsetHeight || 40;
    let side = "above";
    let top = r.top - bh - 8;
    if (top < 8) {
      top = r.bottom + 8;
      side = "below";
    }
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.min(window.innerWidth - bw - 8, Math.max(8, left));
    setPos({ top, left, side });
  }, []);

  const refresh = useCallback(() => {
    if (!enabled) {
      setPos(null);
      return null;
    }
    const wrap = containerRef.current;
    const hit = editorSelection(wrap);
    if (!hit) {
      if (!interactingRef.current) {
        setColorOpen(false);
        setLinkOpen(false);
        setPos(null);
      }
      return null;
    }
    savedRange.current = hit.range;
    setActive(readActive(hit.range));
    if (!interactingRef.current && !hideBarRef.current) placeBar(hit.range);
    return hit;
  }, [containerRef, enabled, colorOpen, linkOpen, placeBar]);

  useEffect(() => {
    if (!enabled) return undefined;
    const wrap = containerRef.current;
    if (!wrap) return undefined;

    const hideToolbar = () => {
      setColorOpen(false);
      setLinkOpen(false);
      setPos(null);
    };

    const onMouseUp = (e) => {
      if (e.target?.closest?.(".bagu-sel-toolbar")) return;
      interactingRef.current = false;
      hideBarRef.current = false;
      window.setTimeout(() => {
        const hit = refresh();
        const docked = chatMode === "compose" || chatMode === "full";
        if (hit && docked) {
          pinSelection(hit.text, {
            context: extractPinContext(hit.range, wrap),
          });
        } else if (!hit && docked) clearSelectionPin();
      }, 0);
    };
    const onSel = () => {
      if (interactingRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) hideToolbar();
    };
    const onDocDown = (e) => {
      if (e.target?.closest?.(".bagu-sel-toolbar")) return;
      interactingRef.current = false;
      hideToolbar();
    };

    wrap.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSel);
    document.addEventListener("mousedown", onDocDown, true);
    wrap.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      wrap.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSel);
      document.removeEventListener("mousedown", onDocDown, true);
      wrap.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [
    containerRef,
    enabled,
    refresh,
    chatMode,
    pinSelection,
    clearSelectionPin,
  ]);

  const restoreSel = () => {
    const range = savedRange.current;
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const afterFormat = () => {
    persistVditor(vditorRef.current);
    window.setTimeout(() => {
      interactingRef.current = false;
      const wrap = containerRef.current;
      const hit = editorSelection(wrap);
      if (hit) savedRange.current = hit.range;
      const range = hit?.range || savedRange.current;
      setActive(readActive(range));
    }, 0);
  };

  const beginInteract = () => {
    interactingRef.current = true;
  };

  const run = (cmd, value) => {
    beginInteract();
    restoreSel();
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(cmd, false, value);
    } catch {
      /* ignore */
    }
    afterFormat();
  };

  const toggleUnderline = () => {
    beginInteract();
    restoreSel();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    toggleInline(sel.getRangeAt(0), {
      tag: "u",
      selector: "u, [style*='underline']",
    });
    afterFormat();
  };

  const toggleCode = () => {
    beginInteract();
    restoreSel();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const host = nodeEl(range.startContainer);
    if (inFenceBlock(host)) {
      interactingRef.current = false;
      return;
    }
    const inside = codeContainingRange(range);
    if (inside) {
      if (isWholeCodeSelected(range, inside)) unwrapEl(inside);
      else splitInlineCode(inside, range);
    } else {
      joinAsInlineCode(range);
    }
    afterFormat();
  };

  const applyLink = (e) => {
    e?.preventDefault();
    const href = String(linkValue || "").trim();
    if (!href) return;
    beginInteract();
    restoreSel();
    document.execCommand("createLink", false, href);
    setLinkOpen(false);
    afterFormat();
  };

  const applyColor = (kind, value) => {
    beginInteract();
    restoreSel();
    try {
      document.execCommand("styleWithCSS", false, true);
      if (kind === "fore") {
        document.execCommand("foreColor", false, value || "inherit");
      } else if (!value) {
        document.execCommand("hiliteColor", false, "transparent");
        document.execCommand("backColor", false, "transparent");
      } else {
        document.execCommand("hiliteColor", false, value);
      }
    } catch {
      /* ignore */
    }
    afterFormat();
  };

  const onAsk = () => {
    interactingRef.current = true;
    hideBarRef.current = true;
    setPos(null);
    setColorOpen(false);
    setLinkOpen(false);
    restoreSel();
    const wrap = containerRef.current;
    const hit = editorSelection(wrap) || {
      text: savedRange.current?.toString() || "",
    };
    if (hit?.text) {
      pinSelection(hit.text, {
        context: extractPinContext(
          hit.range || savedRange.current,
          wrap
        ),
      });
    }
    if (chatMode !== "compose" && chatMode !== "full") {
      setChatMode("compose");
    }
    window.setTimeout(() => {
      restoreSel();
      interactingRef.current = false;
    }, 280);
  };

  if (!enabled || !pos) return null;

  const barH = barRef.current?.offsetHeight || 40;
  const need = 120;
  const spaceUp = pos.top;
  const spaceDown = window.innerHeight - pos.top - barH;
  const preferUp = pos.side === "above";
  const popDir =
    preferUp
      ? spaceUp >= need || spaceUp >= spaceDown
        ? "up"
        : "down"
      : spaceDown >= need || spaceDown >= spaceUp
        ? "down"
        : "up";

  return createPortal(
    <div
      ref={barRef}
      className={`bagu-sel-toolbar bagu-sel-toolbar--${pos.side || "above"} bagu-sel-toolbar--pop-${popDir}`}
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => {
        e.preventDefault();
        beginInteract();
      }}
    >
      <button type="button" className="bagu-sel-ask" onClick={onAsk}>
        <ChatCircleDots size={15} weight="fill" />
        问问
      </button>
      <span className="bagu-sel-sep" />
      <button
        type="button"
        className={`bagu-sel-btn${active.bold ? " is-on" : ""}`}
        title="粗体"
        onClick={() => run("bold")}
      >
        <TextB size={15} weight="bold" />
      </button>
      <button
        type="button"
        className={`bagu-sel-btn${active.italic ? " is-on" : ""}`}
        title="斜体"
        onClick={() => run("italic")}
      >
        <TextItalic size={15} />
      </button>
      <button
        type="button"
        className={`bagu-sel-btn${active.underline ? " is-on" : ""}`}
        title="下划线"
        onClick={toggleUnderline}
      >
        <TextUnderline size={15} />
      </button>
      <button
        type="button"
        className={`bagu-sel-btn${active.strike ? " is-on" : ""}`}
        title="中划线"
        onClick={() => run("strikeThrough")}
      >
        <TextStrikethrough size={15} />
      </button>
      <button
        type="button"
        className={`bagu-sel-btn${linkOpen ? " is-on" : ""}`}
        title="链接"
        onClick={() => {
          setColorOpen(false);
          setLinkOpen((v) => !v);
        }}
      >
        <Link size={15} />
      </button>
      <button
        type="button"
        className={`bagu-sel-btn${active.code ? " is-on" : ""}`}
        title="行内代码"
        onClick={toggleCode}
      >
        <Code size={15} />
      </button>
      <button
        type="button"
        className={`bagu-sel-btn bagu-sel-color-btn${colorOpen ? " is-on" : ""}`}
        title="颜色"
        onClick={() => {
          setLinkOpen(false);
          setColorOpen((v) => !v);
        }}
      >
        <span className="bagu-sel-letter">A</span>
        <CaretDown size={10} />
      </button>

      {linkOpen && (
        <form className="bagu-sel-link" onSubmit={applyLink}>
          <input
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="https://"
            autoFocus
          />
          <button type="submit">确定</button>
        </form>
      )}

      {colorOpen && (
        <div className="bagu-sel-palette">
          <div className="bagu-sel-palette-line">
            <span>文字</span>
            <div className="bagu-sel-dots">
              {FONT_COLORS.map((c) => (
                <button
                  key={c.id || c.value}
                  type="button"
                  className={`bagu-sel-dot bagu-sel-dot-letter${c.id === "default" ? " is-default" : ""}`}
                  style={c.value ? { color: c.value } : undefined}
                  onClick={() => applyColor("fore", c.value)}
                  title={c.id === "default" ? "默认" : "文字颜色"}
                >
                  <span className="bagu-sel-dot-glyph">A</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bagu-sel-palette-line">
            <span>背景</span>
            <div className="bagu-sel-dots">
              {BG_COLORS.map((c) => (
                <button
                  key={c.id || c.value}
                  type="button"
                  className={`bagu-sel-dot${c.id === "none" ? " is-none" : ""}`}
                  style={c.value ? { background: c.value } : undefined}
                  onClick={() => applyColor("back", c.value)}
                  title={c.id === "none" ? "无背景" : "背景颜色"}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
