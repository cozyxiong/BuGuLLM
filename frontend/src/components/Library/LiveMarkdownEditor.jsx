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

const Vditor = VditorImport?.default || VditorImport;

const VDITOR_CDN = "https://cdn.jsdelivr.net/npm/vditor@3.10.9";

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
export default function LiveMarkdownEditor({
  value,
  onChange,
  slug,
  filePath,
  readOnly = false,
  className = "",
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

    const emitIfChanged = (md) => {
      if (!readyRef.current) return;
      const { slug: s, filePath: p } = metaRef.current;
      const stored = fromEditorMarkdown(md, s, p);
      lastPushed.current = md;
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
      placeholder: "开始书写… 支持 Markdown 快捷语法，所见即所得",
      toolbarConfig: {
        pin: true,
      },
      counter: {
        enable: true,
        type: "text",
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
            "headings",
            "bold",
            "italic",
            "strike",
            "|",
            "list",
            "ordered-list",
            "check",
            "outdent",
            "indent",
            "|",
            "quote",
            "line",
            "code",
            "inline-code",
            "|",
            "link",
            "table",
            "|",
            "undo",
            "redo",
            "|",
            "fullscreen",
            "outline",
            "edit-mode",
            {
              name: "more",
              toolbar: ["both", "preview", "export"],
            },
          ],
      typewriterMode: true,
      outline: {
        enable: false,
        position: "right",
      },
      after: () => {
        if (destroyed) return;
        try {
          lastPushed.current = vditor.getValue();
        } catch {
          /* ignore */
        }
        // 延后就绪，避免初始化 setValue 误触发 input 导致「未保存」
        requestAnimationFrame(() => {
          if (!destroyed) readyRef.current = true;
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

    return () => {
      destroyed = true;
      readyRef.current = false;
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
