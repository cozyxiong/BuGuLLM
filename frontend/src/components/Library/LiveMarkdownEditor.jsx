import React, { useEffect, useRef } from "react";
import VditorImport from "vditor";
import "vditor/dist/index.css";
import { API_BASE } from "@/utils/constants";
import { useTheme } from "@/hooks/useTheme";
import {
  scrollToQuoteInDom,
  findQuoteInMarkdown,
  scrollByMarkdownOffset,
  getVditorScrollRoot,
  getVditorContentRoot,
} from "@/utils/tempTextHighlight";
import BlockHandleLayer from "./BlockHandleLayer";

const Vditor = VditorImport?.default || VditorImport;

const VDITOR_CDN = "https://cdn.jsdelivr.net/npm/vditor@3.10.9";

function nearestScroller(node) {
  let current = node?.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const canScroll =
      /(auto|scroll|overlay)/.test(style.overflowY) ||
      /(auto|scroll|overlay)/.test(style.overflow);
    if (canScroll && current.scrollHeight > current.clientHeight + 4) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function headingElements(contentRoot) {
  if (!contentRoot) return [];
  return Array.from(contentRoot.children).filter((el) =>
    /^H[1-6]$/.test(el.tagName)
  );
}

function syncOutlineActive(container) {
  const outline = container?.querySelector(".vditor-outline");
  if (!outline || outline.style.display === "none") return;
  const contentRoot = getVditorContentRoot(container);
  const scrollRoot = getVditorScrollRoot(container);
  if (!contentRoot || !scrollRoot) return;
  const headings = headingElements(contentRoot);
  if (!headings.length) return;

  const probe =
    scrollRoot.getBoundingClientRect().top +
    Math.min(120, Math.max(48, scrollRoot.clientHeight * 0.18));
  let current = headings[0];
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= probe) current = heading;
    else break;
  }
  const id = current.id;
  if (!id) return;

  let active = null;
  outline.querySelectorAll("span[data-target-id]").forEach((node) => {
    const on = node.getAttribute("data-target-id") === id;
    node.classList.toggle("bagu-toc-active", on);
    if (on) active = node;
  });
  active?.scrollIntoView({ block: "nearest" });
}

/** 文档相对图片 → 可读的 API 绝对地址（编辑器内预览） */
function toEditorMarkdown(content, slug, filePath) {
  if (!slug || !filePath || !content) return content || "";
  const normalizedPath = filePath.replace(/\\/g, "/");
  const sepIdx = normalizedPath.lastIndexOf("/");
  const dir = sepIdx >= 0 ? normalizedPath.slice(0, sepIdx) : "";

  return content.replace(
    /!\[([^\]]*)\]\((?!https?:|data:|#|\/\/)([^)]+)\)/g,
    (_m, alt, src) => {
      const [cleanSrc] = src.split(/[?#]/);
      const segments = dir
        ? dir.split("/").concat(cleanSrc.split("/"))
        : cleanSrc.split("/");
      const resolved = segments
        .reduce((acc, seg) => {
          if (seg === "..") {
            acc.pop();
            return acc;
          }
          if (seg === "." || seg === "") return acc;
          acc.push(seg);
          return acc;
        }, [])
        .join("/");
      const url = `${API_BASE}/libraries/${slug}/file/${resolved
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      return `![${alt}](${url})`;
    }
  );
}

/**
 * 保存时把本库 API 图片地址还原为相对路径，避免污染 vault 源文件。
 */
function fromEditorMarkdown(content, slug, filePath) {
  if (!slug || !filePath || !content) return content || "";
  const normalizedPath = filePath.replace(/\\/g, "/");
  const sepIdx = normalizedPath.lastIndexOf("/");
  const dir = sepIdx >= 0 ? normalizedPath.slice(0, sepIdx) : "";
  const prefix = `${API_BASE}/libraries/${slug}/file/`;

  return content.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (full, alt, src) => {
      if (!src.startsWith(prefix) && !src.includes(`/libraries/${slug}/file/`)) {
        return full;
      }
      let abs;
      try {
        const idx = src.indexOf(`/libraries/${slug}/file/`);
        abs = decodeURIComponent(src.slice(idx + `/libraries/${slug}/file/`.length));
      } catch {
        return full;
      }
      if (!dir) return `![${alt}](${abs})`;
      const dirParts = dir.split("/").filter(Boolean);
      const absParts = abs.split("/").filter(Boolean);
      let i = 0;
      while (
        i < dirParts.length &&
        i < absParts.length &&
        dirParts[i] === absParts[i]
      ) {
        i += 1;
      }
      const ups = dirParts.length - i;
      const rel = `${"../".repeat(ups)}${absParts.slice(i).join("/")}` || abs;
      return `![${alt}](${rel})`;
    }
  );
}

/**
 * 整篇字符级所见即所得（Vditor WYSIWYG / IR）
 * 底层仍读写 Markdown，适合作为知识库核心编辑器。
 */
function mountEditorToolbar(vditorRoot, outlineSlot, restSlot, onOutlineToggle) {
  const toolbar = vditorRoot.querySelector(".vditor-toolbar");
  if (!toolbar || !outlineSlot || !restSlot) return;
  const outlineBtn = toolbar.querySelector('[data-type="outline"]');
  const outlineItem = outlineBtn?.closest(".vditor-toolbar__item");
  if (outlineItem) {
    outlineSlot.replaceChildren(outlineItem);
    if (onOutlineToggle) {
      outlineItem.addEventListener("click", onOutlineToggle);
    }
  }
  const first = toolbar.firstElementChild;
  if (first?.classList.contains("vditor-toolbar__divider")) first.remove();
  restSlot.replaceChildren(toolbar);
}

export default function LiveMarkdownEditor({
  value,
  onChange,
  slug,
  filePath,
  readOnly = false,
  className = "",
  outlineSlotRef = null,
  restSlotRef = null,
  /** 临时来源高亮（不写回 Markdown） */
  highlightQuote = null,
  highlightToken = null,
}) {
  const containerRef = useRef(null);
  const vditorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const readyRef = useRef(false);
  const lastPushed = useRef(null);
  const lastStored = useRef(value || "");
  const { isLight } = useTheme();
  const metaRef = useRef({ slug, filePath });

  onChangeRef.current = onChange;
  metaRef.current = { slug, filePath };

  const getEditorRoot = () => getVditorContentRoot(containerRef.current);

  // 初始化 / 只读切换时重建
  useEffect(() => {
    if (!containerRef.current) return undefined;

    readyRef.current = false;
    let destroyed = false;
    const el = containerRef.current;
    el.innerHTML = "";

    const initial = toEditorMarkdown(value || "", slug, filePath);
    lastPushed.current = initial;
    lastStored.current = value || "";

    let syncFrame = 0;
    const scheduleOutlineSync = () => {
      if (syncFrame) return;
      syncFrame = window.requestAnimationFrame(() => {
        syncFrame = 0;
        if (!destroyed) syncOutlineActive(el);
      });
    };

    const emitIfChanged = (md) => {
      if (!readyRef.current) return;
      const { slug: s, filePath: p } = metaRef.current;
      const stored = fromEditorMarkdown(md, s, p);
      lastPushed.current = md;
      scheduleOutlineSync();
      if (stored === lastStored.current) return;
      lastStored.current = stored;
      onChangeRef.current?.(stored);
    };

    const vditor = new Vditor(el, {
      cdn: VDITOR_CDN,
      height: "100%",
      minHeight: 420,
      mode: "wysiwyg",
      lang: "zh_CN",
      theme: isLight ? "classic" : "dark",
      icon: "material",
      value: initial,
      cache: { enable: false },
      placeholder: "开始记笔记...",
      toolbarConfig: {
        pin: true,
      },
      counter: {
        enable: false,
      },
      preview: {
        theme: {
          current: isLight ? "light" : "dark",
        },
        hljs: {
          style: isLight ? "github" : "native",
          lineNumber: false,
        },
        math: {
          engine: "KaTeX",
        },
      },
      toolbar: readOnly
        ? []
        : [
            { name: "outline", tip: "目录" },
            "|",
            "ordered-list",
            "list",
            "check",
            "|",
            "table",
            "code",
            "inline-code",
            "line",
            "quote",
            "link",
            "|",
            "fullscreen",
            "preview",
            "export",
          ],
      typewriterMode: true,
      outline: {
        enable: false,
        position: "left",
      },
      after: () => {
        if (destroyed) return;
        try {
          lastPushed.current = vditor.getValue();
        } catch {
          /* ignore */
        }
        const title = el.querySelector(".vditor-outline__title");
        if (title) title.textContent = "目录";
        const outlineBtn = el.querySelector('[data-type="outline"]');
        if (outlineBtn) outlineBtn.setAttribute("aria-label", "目录");
        mountEditorToolbar(
          el,
          outlineSlotRef?.current,
          restSlotRef?.current,
          () => window.setTimeout(scheduleOutlineSync, 80)
        );
        // 延后就绪，避免初始化 setValue 误触发 input 导致「未保存」
        requestAnimationFrame(() => {
          if (!destroyed) readyRef.current = true;
          scheduleOutlineSync();
        });
        if (readOnly) {
          try {
            vditor.disabled();
          } catch {
            /* ignore */
          }
        }
      },
      input: (md) => emitIfChanged(md),
      blur: (md) => emitIfChanged(md),
    });

    vditorRef.current = vditor;

    let tipEl = null;
    const hideOutlineTip = () => {
      if (tipEl) tipEl.style.display = "none";
    };
    const showOutlineTip = (hit) => {
      const label =
        hit.querySelector(":scope > span") || hit;
      if (label.scrollWidth <= label.clientWidth + 1) {
        hideOutlineTip();
        return;
      }
      if (!tipEl) {
        tipEl = document.createElement("div");
        tipEl.className = "bagu-toc-tip";
        document.body.appendChild(tipEl);
      }
      tipEl.textContent = (label.textContent || "").replace(/\s+/g, " ").trim();
      tipEl.style.display = "block";
      const rect = hit.getBoundingClientRect();
      const tipW = tipEl.offsetWidth;
      const tipH = tipEl.offsetHeight;
      let left = rect.right + 10;
      if (left + tipW > window.innerWidth - 8) {
        left = Math.max(8, rect.left - tipW - 10);
      }
      let top = rect.top + rect.height / 2 - tipH / 2;
      top = Math.min(window.innerHeight - tipH - 8, Math.max(8, top));
      tipEl.style.left = `${left}px`;
      tipEl.style.top = `${top}px`;
    };

    const onOutlineOver = (e) => {
      const outline = el.querySelector(".vditor-outline");
      if (!outline || !outline.contains(e.target)) return;
      const hit = e.target.closest?.("span[data-target-id]");
      outline.querySelectorAll(".bagu-toc-hot").forEach((n) => {
        if (n !== hit) n.classList.remove("bagu-toc-hot");
      });
      if (hit && outline.contains(hit)) {
        hit.classList.add("bagu-toc-hot");
        showOutlineTip(hit);
      } else {
        hideOutlineTip();
      }
    };
    const onOutlineOut = (e) => {
      const outline = el.querySelector(".vditor-outline");
      if (!outline) return;
      if (e.relatedTarget && outline.contains(e.relatedTarget)) return;
      outline.querySelectorAll(".bagu-toc-hot").forEach((n) =>
        n.classList.remove("bagu-toc-hot")
      );
      hideOutlineTip();
    };
    const onOutlineClick = (e) => {
      if (e.target?.closest?.(".vditor-outline__action")) {
        window.setTimeout(scheduleOutlineSync, 80);
        return;
      }
      const outline = el.querySelector(".vditor-outline");
      const hit = e.target?.closest?.("span[data-target-id]");
      if (!hit || !outline?.contains(hit)) {
        if (e.target?.closest?.('[data-type="outline"]')) {
          window.setTimeout(scheduleOutlineSync, 80);
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const heading = document.getElementById(hit.getAttribute("data-target-id"));
      if (!heading) return;
      const scroller =
        nearestScroller(heading) ||
        getVditorScrollRoot(el) ||
        el.querySelector(".vditor-wysiwyg");
      if (!scroller) return;
      const gap = 80;
      const nextTop =
        heading.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        gap;
      scroller.scrollTo({ top: Math.max(0, nextTop) });
      scheduleOutlineSync();
    };
    el.addEventListener("pointerover", onOutlineOver);
    el.addEventListener("pointerout", onOutlineOut);
    el.addEventListener("scroll", scheduleOutlineSync, true);
    el.addEventListener("click", onOutlineClick, true);

    return () => {
      destroyed = true;
      readyRef.current = false;
      if (syncFrame) window.cancelAnimationFrame(syncFrame);
      el.removeEventListener("pointerover", onOutlineOver);
      el.removeEventListener("pointerout", onOutlineOut);
      el.removeEventListener("scroll", scheduleOutlineSync, true);
      el.removeEventListener("click", onOutlineClick, true);
      hideOutlineTip();
      tipEl?.remove();
      tipEl = null;
      try {
        vditor.destroy();
      } catch {
        /* ignore */
      }
      vditorRef.current = null;
    };
    // 仅在路径/只读变化时重建；主题另 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, filePath, readOnly]);

  // 外部 value 变更（换文件已由重建覆盖；同文件外部重置时同步）
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    if ((value || "") === lastStored.current) return;
    const next = toEditorMarkdown(value || "", slug, filePath);
    try {
      lastPushed.current = next;
      lastStored.current = value || "";
      vditor.setValue(next);
    } catch {
      /* not ready */
    }
  }, [value, slug, filePath]);

  // 主题切换
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    try {
      vditor.setTheme(
        isLight ? "classic" : "dark",
        isLight ? "light" : "dark",
        isLight ? "github" : "native"
      );
    } catch {
      /* ignore */
    }
  }, [isLight]);

  // 仅滚动到引用来源位置（不高亮）
  useEffect(() => {
    if (!highlightQuote || !filePath) return undefined;

    let cancelled = false;
    let tries = 0;
    let doneScroll = false;
    const maxTries = 35;
    const timers = [];

    const attempt = () => {
      if (cancelled || doneScroll) return;
      tries += 1;

      if (!readyRef.current || !vditorRef.current) {
        if (tries < maxTries) timers.push(window.setTimeout(attempt, 100));
        return;
      }

      const contentRoot = getEditorRoot();
      const scrollRoot = getVditorScrollRoot(containerRef.current);
      if (!contentRoot) {
        if (tries < maxTries) timers.push(window.setTimeout(attempt, 100));
        return;
      }

      const visible = (contentRoot.innerText || "").trim();
      if (visible.length < 8) {
        if (tries < maxTries) timers.push(window.setTimeout(attempt, 120));
        return;
      }

      if (scrollToQuoteInDom(contentRoot, highlightQuote)) {
        doneScroll = true;
        return;
      }

      const hit = findQuoteInMarkdown(value || "", highlightQuote);
      if (hit) {
        const scrolled = scrollByMarkdownOffset(
          scrollRoot || contentRoot,
          value || "",
          hit.start
        );
        if (scrolled) {
          doneScroll = true;
          return;
        }
      }

      if (tries < maxTries) {
        timers.push(window.setTimeout(attempt, 150));
      }
    };

    timers.push(window.setTimeout(attempt, 200));
    timers.push(window.setTimeout(attempt, 500));
    timers.push(window.setTimeout(attempt, 1000));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [highlightQuote, highlightToken, filePath, value]);

  return (
    <div className={`bagu-vditor-wrap ${className}`}>
      <div ref={containerRef} className="bagu-vditor" />
      <BlockHandleLayer
        containerRef={containerRef}
        vditorRef={vditorRef}
        enabled={!readOnly}
      />
    </div>
  );
}

// 兼容旧导出名（若有引用）
export function splitMarkdownBlocks(text) {
  return text == null || text === "" ? [""] : [String(text)];
}
export function joinMarkdownBlocks(blocks) {
  return (blocks || []).join("\n\n");
}
