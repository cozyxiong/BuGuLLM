import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import renderMarkdown from "@/utils/chat/markdown";
import DOMPurify from "@/utils/chat/purify";
import { useSourcesSidebar } from "../../ChatSidebar";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";
import showToast from "@/utils/toast";
import {
  extractClaimNearCitation,
  renderSourcePreviewHtml,
  sourceDisplayTitle,
  resolveVaultRelativePath,
  getSourceHighlightQuote,
  vaultPathToFileNode,
} from "../sourceDisplay";

/**
 * 将回答中的 [1] / [2] 转为可交互的内联来源角标（NotebookLM 风格）。
 * 悬停：片段预览（现状）
 * 点击：打开 Vault 文档编辑器，并临时黄高亮悬停那段内容
 */
export default function InlineCitedContent({
  content = "",
  sources = [],
  className = "",
}) {
  const containerRef = useRef(null);
  const hideTimer = useRef(null);
  const { openSidebar, closeSidebar } = useSourcesSidebar();
  const { setSelectedFile } = useWorkspaceUI();
  const [hover, setHover] = useState(null); // { idx, num, rect, claim }

  const html = useMemo(() => {
    const raw = DOMPurify.sanitize(renderMarkdown(content || ""));
    if (!sources?.length) return raw;
    return raw.replace(/\[(\d{1,3})\](?!\()/g, (match, nStr) => {
      const num = parseInt(nStr, 10);
      const idx = num - 1;
      if (!Number.isFinite(num) || idx < 0 || idx >= sources.length) return match;
      return `<button type="button" class="nl-cite-badge" data-cite-idx="${idx}" data-cite-num="${num}" aria-label="来源 ${num}">${num}</button>`;
    });
  }, [content, sources]);

  const claimFor = useCallback(
    (num) => extractClaimNearCitation(content, num),
    [content]
  );

  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const scheduleHide = () => {
    clearHide();
    hideTimer.current = setTimeout(() => setHover(null), 180);
  };

  const showForTarget = useCallback(
    (el) => {
      if (!el) return;
      const idx = parseInt(el.getAttribute("data-cite-idx") || "", 10);
      const num = parseInt(el.getAttribute("data-cite-num") || "", 10);
      if (!Number.isFinite(idx) || idx < 0 || idx >= sources.length) return;
      const rect = el.getBoundingClientRect();
      clearHide();
      setHover({ idx, num, rect, claim: claimFor(num) });
    },
    [sources.length, claimFor]
  );

  const openSource = useCallback(
    (idx, num) => {
      if (!Number.isFinite(idx)) return;
      const src = sources[idx];
      if (!src) return;
      setHover(null);

      // pending：对齐中，暂用侧栏
      if (src.pending) {
        openSidebar({
          sources,
          focusIndex: idx,
          claim: claimFor(num ?? idx + 1),
        });
        return;
      }

      const relPath = resolveVaultRelativePath(src);
      // 与悬停预览同一 claim、同一段正文
      const claim = claimFor(num ?? idx + 1);
      const quote = getSourceHighlightQuote(src, claim);
      const fileNode = vaultPathToFileNode(relPath);

      if (fileNode && quote) {
        try {
          closeSidebar?.();
        } catch {
          /* ignore */
        }
        setSelectedFile(fileNode, {
          quote,
          token: Date.now(),
        });
        return;
      }

      if (fileNode) {
        setSelectedFile(fileNode);
        return;
      }

      // 无法解析路径：回退侧栏
      showToast("无法定位到知识库文档，已在侧栏打开来源", "info");
      openSidebar({
        sources,
        focusIndex: idx,
        claim: claimFor(num ?? idx + 1),
      });
    },
    [sources, claimFor, openSidebar, closeSidebar, setSelectedFile]
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onOver = (e) => {
      const badge = e.target?.closest?.(".nl-cite-badge");
      if (badge && root.contains(badge)) showForTarget(badge);
    };
    const onOut = (e) => {
      const badge = e.target?.closest?.(".nl-cite-badge");
      if (!badge) return;
      const related = e.relatedTarget;
      if (
        related?.closest?.(".nl-cite-popover") ||
        related?.closest?.(".nl-cite-badge")
      )
        return;
      scheduleHide();
    };
    const onClick = (e) => {
      const badge = e.target?.closest?.(".nl-cite-badge");
      if (!badge || !root.contains(badge)) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(badge.getAttribute("data-cite-idx") || "", 10);
      const num = parseInt(badge.getAttribute("data-cite-num") || "", 10);
      openSource(idx, num);
    };

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      root.removeEventListener("click", onClick);
      clearHide();
    };
  }, [showForTarget, openSource, sources]);

  const source = hover ? sources[hover.idx] : null;
  const title = sourceDisplayTitle(source);
  const previewHtml = source
    ? renderSourcePreviewHtml(source, hover.claim || "")
    : "";

  const popStyle = useMemo(() => {
    if (!hover?.rect) return {};
    const pad = 8;
    const width = 380;
    let left = hover.rect.left + hover.rect.width / 2 - width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    const above = hover.rect.top > 300;
    const top = above ? hover.rect.top - pad : hover.rect.bottom + pad;
    return {
      left,
      top,
      width,
      transform: above ? "translateY(-100%)" : "none",
    };
  }, [hover]);

  const hasInlineMarks = /nl-cite-badge/.test(html);
  const showFallbackRow =
    Array.isArray(sources) && sources.length > 0 && !hasInlineMarks && !!content;

  return (
    <>
      <style>{NL_CITE_CSS}</style>
      <div
        ref={containerRef}
        className={`nl-cited-content markdown prose-chat break-words text-white/90 light:text-slate-800 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {showFallbackRow && (
        <div className="nl-cite-fallback mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-white/45 light:text-slate-500">
            来源
          </span>
          {sources.map((_, idx) => (
            <button
              key={`fb-cite-${idx}`}
              type="button"
              className="nl-cite-badge"
              data-cite-idx={idx}
              data-cite-num={idx + 1}
              onMouseEnter={(e) => showForTarget(e.currentTarget)}
              onMouseLeave={scheduleHide}
              onClick={() => openSource(idx, idx + 1)}
              aria-label={`来源 ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      )}
      {hover &&
        source &&
        createPortal(
          <div
            className="nl-cite-popover"
            style={popStyle}
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
          >
            <div className="nl-cite-popover-title" title={title}>
              {title}
            </div>
            {previewHtml ? (
              <div
                className="nl-cite-popover-body nl-src-reader"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="nl-cite-popover-body muted">暂无片段预览</div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

const NL_CITE_CSS = `
.nl-cite-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1em;
  height: 1.1em;
  padding: 0 0.28em;
  margin: 0 0.12em;
  border: none;
  border-radius: 999px;
  font-size: 0.68em;
  font-weight: 600;
  line-height: 1;
  vertical-align: super;
  cursor: pointer;
  color: #3b82f6;
  background: color-mix(in srgb, #3b82f6 14%, transparent);
  transition: background 0.15s ease, transform 0.12s ease;
}
.nl-cite-badge:hover {
  background: color-mix(in srgb, #3b82f6 28%, transparent);
  transform: translateY(-1px);
}
.light .nl-cite-badge {
  color: #2563eb;
  background: color-mix(in srgb, #2563eb 12%, #fff);
}
.nl-cite-popover {
  position: fixed;
  z-index: 9999;
  max-height: min(420px, 55vh);
  display: flex;
  flex-direction: column;
  background: var(--theme-bg-secondary, #18181b);
  border: 1px solid color-mix(in srgb, var(--theme-modal-border, #3f3f46) 80%, transparent);
  border-radius: 12px;
  box-shadow:
    0 4px 6px -1px rgba(0,0,0,0.12),
    0 18px 40px -12px rgba(0,0,0,0.35);
  overflow: hidden;
  pointer-events: auto;
}
.light .nl-cite-popover {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}
.nl-cite-popover-title {
  padding: 12px 14px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--theme-text-primary, #f4f4f5);
  white-space: normal;
  word-break: break-word;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-modal-border, #3f3f46) 50%, transparent);
}
.light .nl-cite-popover-title { color: #0f172a; border-bottom-color: #e2e8f0; }
.nl-cite-popover-body {
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--theme-text-primary, #e4e4e7) 92%, transparent);
  overflow-y: auto;
  flex: 1;
  word-break: break-word;
}
.nl-cite-popover-body.muted { opacity: 0.55; font-style: italic; }
.light .nl-cite-popover-body { color: #334155; }

.nl-src-reader h1,
.nl-src-reader h2,
.nl-src-reader h3,
.nl-src-reader h4 {
  font-weight: 650;
  line-height: 1.35;
  margin: 0.75em 0 0.35em;
  color: inherit;
}
.nl-src-reader h1 { font-size: 1.15em; }
.nl-src-reader h2 { font-size: 1.05em; }
.nl-src-reader h3 { font-size: 1em; }
.nl-src-reader p { margin: 0.4em 0; }
.nl-src-reader ul, .nl-src-reader ol {
  margin: 0.35em 0 0.5em;
  padding-left: 1.25em;
}
.nl-src-reader li { margin: 0.15em 0; }
.nl-src-reader code {
  font-size: 0.9em;
  padding: 0.1em 0.3em;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.nl-src-reader pre {
  margin: 0.5em 0;
  padding: 0.6em 0.75em;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85em;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.nl-src-reader blockquote {
  margin: 0.5em 0;
  padding-left: 0.75em;
  border-left: 3px solid color-mix(in srgb, #3b82f6 55%, transparent);
  opacity: 0.9;
}
.nl-src-reader table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.92em;
}
.nl-src-reader th, .nl-src-reader td {
  border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  padding: 0.35em 0.5em;
  text-align: left;
}
.nl-src-preview pre,
.nl-cite-popover pre {
  margin: 0.4em 0;
  padding: 0.55em 0.7em;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85em;
  background: color-mix(in srgb, currentColor 8%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
}
.nl-src-plain {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85em;
}
`;
