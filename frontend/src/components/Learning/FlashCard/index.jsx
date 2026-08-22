import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import Learning from "@/models/learning";
import showToast from "@/utils/toast";
import { ArrowLeft, ArrowRight, X, Check, CircleNotch } from "@phosphor-icons/react";
import { normalizeLearningItem } from "../utils";
import renderMarkdown from "@/utils/chat/markdown";
import DOMPurify from "@/utils/chat/purify";

/** 与问答模式 nl-cite 同风格的角标 / 悬浮预览 */
const CITE_CSS = `
.lc-cite-badge {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-width: 1.15em;
  height: 1.15em;
  padding: 0 0.3em;
  margin: 0 0.14em;
  border: none !important;
  border-radius: 999px;
  font-size: 0.72em;
  font-weight: 600;
  line-height: 1;
  vertical-align: super;
  cursor: pointer;
  color: #3b82f6 !important;
  background: color-mix(in srgb, #3b82f6 16%, transparent) !important;
  transition: background 0.15s ease, transform 0.12s ease;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}
.lc-cite-badge:hover {
  background: color-mix(in srgb, #3b82f6 30%, transparent) !important;
  transform: translateY(-1px);
}
.light .lc-cite-badge {
  color: #2563eb !important;
  background: color-mix(in srgb, #2563eb 12%, #fff) !important;
}
.lc-cite-popover {
  position: fixed;
  z-index: 10050;
  max-height: min(380px, 50vh);
  width: min(380px, calc(100vw - 16px));
  display: flex;
  flex-direction: column;
  background: var(--theme-bg-secondary, #18181b);
  border: 1px solid color-mix(in srgb, var(--theme-modal-border, #3f3f46) 80%, transparent);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.35);
  overflow: hidden;
  pointer-events: auto;
}
.light .lc-cite-popover {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}
.lc-cite-popover-title {
  padding: 10px 12px 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--theme-text-primary, #f4f4f5);
  border-bottom: 1px solid color-mix(in srgb, var(--theme-modal-border, #3f3f46) 50%, transparent);
  word-break: break-word;
}
.light .lc-cite-popover-title { color: #0f172a; border-bottom-color: #e2e8f0; }
.lc-cite-popover-body {
  padding: 10px 12px;
  font-size: 12.5px;
  line-height: 1.6;
  overflow-y: auto;
  flex: 1;
  color: color-mix(in srgb, var(--theme-text-primary, #e4e4e7) 92%, transparent);
  word-break: break-word;
}
.light .lc-cite-popover-body { color: #334155; }
.lc-cite-popover-body p { margin: 0.4em 0; }
.lc-cite-popover-body ul, .lc-cite-popover-body ol { margin: 0.4em 0; padding-left: 1.2em; }
.lc-cite-popover-body.muted { opacity: 0.55; font-style: italic; }
`;

function stripThinkingClient(text = "") {
  return String(text)
    .replace(
      /<(thinking|think|thought|thought_chain|reasoning)[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    .replace(/```(?:thinking|reasoning)[\s\S]*?```/gi, "")
    .replace(
      /<(thinking|think|thought|thought_chain|reasoning)[^>]*>[\s\S]*$/gi,
      ""
    )
    .trim();
}

function stripDocMetadata(text = "") {
  let t = String(text || "").replace(/\r\n/g, "\n");
  if (t.includes("<document_metadata>")) {
    if (t.includes("</document_metadata>")) {
      t = t
        .split("</document_metadata>")
        .slice(1)
        .join("</document_metadata>")
        .trim();
    } else {
      t = t.replace(/<document_metadata>[\s\S]*$/i, "").trim();
    }
  }
  return t
    .replace(/<\/?document_metadata>/gi, "")
    .replace(/^sourceDocument:\s*[^\n]*\n?/gim, "")
    .replace(/^published:\s*[^\n]*\n?/gim, "")
    .replace(/^\[章节\][^\n]*\n+/u, "")
    .trim();
}

function toSafeHtml(mdSource) {
  if (!mdSource?.trim()) return "";
  try {
    return DOMPurify.sanitize(renderMarkdown(mdSource));
  } catch {
    return "";
  }
}

function sourceTitle(s, i) {
  const t = s?.title || s?.docSource || s?.chunkSource || "";
  const cleaned = String(t)
    .replace(/^vault:\/\//i, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop();
  return cleaned || `来源 ${i + 1}`;
}

function extractSources(card) {
  if (!card) return [];
  if (Array.isArray(card.sources) && card.sources.length) return card.sources;
  const c =
    card.content && typeof card.content === "object" ? card.content : null;
  if (Array.isArray(c?.sources) && c.sources.length) return c.sources;
  return [];
}

function injectCiteBadges(html, sources) {
  if (!html || !sources?.length) return html;
  return html
    .replace(/\[(\d{1,3})\](?!\()/g, (match, nStr) => {
      const num = parseInt(nStr, 10);
      const idx = num - 1;
      if (!Number.isFinite(num) || idx < 0 || idx >= sources.length) return match;
      return `<button type="button" class="lc-cite-badge" data-cite-idx="${idx}" data-cite-num="${num}" aria-label="来源 ${num}">${num}</button>`;
    })
    .replace(/［(\d{1,3})］/g, (match, nStr) => {
      const num = parseInt(nStr, 10);
      const idx = num - 1;
      if (!Number.isFinite(num) || idx < 0 || idx >= sources.length) return match;
      return `<button type="button" class="lc-cite-badge" data-cite-idx="${idx}" data-cite-num="${num}" aria-label="来源 ${num}">${num}</button>`;
    })
    .replace(/【(\d{1,3})】/g, (match, nStr) => {
      const num = parseInt(nStr, 10);
      const idx = num - 1;
      if (!Number.isFinite(num) || idx < 0 || idx >= sources.length) return match;
      return `<button type="button" class="lc-cite-badge" data-cite-idx="${idx}" data-cite-num="${num}" aria-label="来源 ${num}">${num}</button>`;
    });
}

/**
 * 与问答模式一致：正文内 [n] 角标 + 悬停片段预览
 */
function CitedAnswer({ text, sources = [], className = "" }) {
  const rootRef = useRef(null);
  const hideTimer = useRef(null);
  const [hover, setHover] = useState(null);

  const html = useMemo(() => {
    const clean = stripThinkingClient(text || "");
    let raw = toSafeHtml(clean);
    if (!raw) {
      const esc = String(clean)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      raw = `<p>${esc.replace(/\n/g, "<br/>")}</p>`;
    }
    return injectCiteBadges(raw, sources);
  }, [text, sources]);

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

  const showFor = useCallback(
    (el) => {
      if (!el) return;
      const idx = parseInt(el.getAttribute("data-cite-idx") || "", 10);
      const num = parseInt(el.getAttribute("data-cite-num") || "", 10);
      if (!Number.isFinite(idx) || idx < 0 || idx >= sources.length) return;
      clearHide();
      setHover({ idx, num, rect: el.getBoundingClientRect() });
    },
    [sources.length]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onOver = (e) => {
      const badge = e.target?.closest?.(".lc-cite-badge");
      if (badge && root.contains(badge)) showFor(badge);
    };
    const onOut = (e) => {
      const badge = e.target?.closest?.(".lc-cite-badge");
      if (!badge) return;
      const related = e.relatedTarget;
      if (
        related?.closest?.(".lc-cite-popover") ||
        related?.closest?.(".lc-cite-badge")
      )
        return;
      scheduleHide();
    };
    const onClick = (e) => {
      const badge = e.target?.closest?.(".lc-cite-badge");
      if (!badge || !root.contains(badge)) return;
      e.preventDefault();
      e.stopPropagation();
      showFor(badge);
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
  }, [showFor, html]);

  const source = hover ? sources[hover.idx] : null;
  const previewHtml = source
    ? toSafeHtml(
        stripDocMetadata(
          source.text || source.surroundingText || source.pageContent || ""
        )
      )
    : "";

  const popStyle = useMemo(() => {
    if (!hover?.rect) return {};
    const pad = 8;
    const width = Math.min(380, window.innerWidth - 16);
    let left = hover.rect.left + hover.rect.width / 2 - width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    const above = hover.rect.top > 280;
    return {
      left,
      top: above ? hover.rect.top - pad : hover.rect.bottom + pad,
      width,
      transform: above ? "translateY(-100%)" : "none",
    };
  }, [hover]);

  return (
    <>
      <style>{CITE_CSS}</style>
      <div
        ref={rootRef}
        className={`lc-cited-answer markdown prose-chat break-words text-theme-text-primary ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hover &&
        source &&
        createPortal(
          <div
            className="lc-cite-popover"
            style={popStyle}
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lc-cite-popover-title">
              [{hover.num}] {sourceTitle(source, hover.idx)}
            </div>
            {previewHtml ? (
              <div
                className="lc-cite-popover-body"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="lc-cite-popover-body muted">暂无片段预览</div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

const navBtnClass =
  "flex items-center justify-center w-11 h-11 rounded-full border border-theme-button-primary/45 text-theme-button-primary bg-transparent hover:bg-theme-button-primary/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:border-theme-modal-border disabled:text-theme-text-secondary";

const pillBase =
  "inline-flex items-center justify-center gap-1.5 min-w-[4.5rem] h-11 px-4 rounded-full border bg-theme-bg-primary text-sm font-semibold tabular-nums tracking-tight transition-all active:scale-95 disabled:opacity-35 disabled:pointer-events-none";

/**
 * 底部操作条：← | ✕ n | n ✓ | →（由外层 shrink-0 固定，不随答案高度移动）
 */
function ReviewControls({
  failCount = 0,
  passCount = 0,
  canPrev,
  canNext,
  canRate,
  reviewing,
  onPrev,
  onNext,
  onFail,
  onPass,
}) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 select-none">
      <button
        type="button"
        className={navBtnClass}
        disabled={!canPrev || reviewing}
        onClick={onPrev}
        aria-label="上一张"
        title="上一张"
      >
        <ArrowLeft className="w-5 h-5" weight="bold" />
      </button>

      <button
        type="button"
        className={`${pillBase} border-red-400/50 text-red-400 hover:bg-red-500/10 hover:border-red-400 light:border-red-400/60 light:text-red-500 light:hover:bg-red-50`}
        disabled={!canRate || reviewing}
        onClick={onFail}
        aria-label="不记得"
        title="不记得"
      >
        <X className="w-4 h-4" weight="bold" />
        <span>{failCount}</span>
      </button>

      <button
        type="button"
        className={`${pillBase} border-emerald-400/50 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 light:border-emerald-500/50 light:text-emerald-600 light:hover:bg-emerald-50`}
        disabled={!canRate || reviewing}
        onClick={onPass}
        aria-label="记得"
        title="记得"
      >
        <span>{passCount}</span>
        <Check className="w-4 h-4" weight="bold" />
      </button>

      <button
        type="button"
        className={navBtnClass}
        disabled={!canNext || reviewing}
        onClick={onNext}
        aria-label="下一张"
        title="下一张"
      >
        <ArrowRight className="w-5 h-5" weight="bold" />
      </button>
    </div>
  );
}

export default function FlashCard({
  item,
  slug,
  onReviewed,
  onPrev,
  onNext,
  canPrev = false,
  canNext = false,
  failCount = 0,
  passCount = 0,
  answer = null,
}) {
  const [card, setCard] = useState(() => normalizeLearningItem(item));
  const [flipped, setFlipped] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const fetchRef = useRef(false);

  useEffect(() => {
    setCard(normalizeLearningItem(item));
    setFlipped(false);
    fetchRef.current = false;
  }, [item?.id]);

  const ensureAnswer = useCallback(async () => {
    if (!card?.id || !slug) return;
    const sources = extractSources(card);
    const hasAnswer = String(card.back || "").trim().length > 0;
    const ready =
      (card.answerStatus === "ready" || hasAnswer) &&
      hasAnswer &&
      sources.length > 0;
    if (ready || fetchRef.current) return;
    fetchRef.current = true;
    setLoadingAnswer(true);
    try {
      const result = await Learning.ensureAnswer(slug, card.id);
      if (result.error) {
        showToast(result.error, "error");
        fetchRef.current = false;
        return;
      }
      if (result.item) setCard(normalizeLearningItem(result.item));
    } finally {
      setLoadingAnswer(false);
    }
  }, [card, slug]);

  useEffect(() => {
    if (!card) return;
    const sources = extractSources(card);
    const need =
      card.answerStatus === "pending" ||
      !String(card.back || "").trim() ||
      sources.length === 0;
    if (need) ensureAnswer();
  }, [card?.id, card?.answerStatus, card?.back, ensureAnswer]);

  if (!card) return null;

  const handleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    if (next) ensureAnswer();
  };

  const handleReview = (rating) => {
    if (reviewing || !flipped) return;
    setReviewing(true);
    onReviewed?.(rating, card.id);
    if (card.id && slug) {
      Learning.review(slug, card.id, rating).then((result) => {
        if (result.error) showToast(`复习失败: ${result.error}`, "error");
      });
    }
    setReviewing(false);
    setFlipped(false);
  };

  const answerText = stripThinkingClient(card.back || "");
  const sources = extractSources(card);
  const canRate = flipped && !loadingAnswer && !!answerText;
  const ratingKind =
    answer?.kind ||
    (answer?.submitted ? (answer.correct ? "pass" : "fail") : null);
  const cardBorder =
    ratingKind === "pass"
      ? "border-emerald-400/65 light:border-emerald-400/80 shadow-[0_4px_14px_rgba(16,185,129,0.12)] light:shadow-[0_4px_12px_rgba(16,185,129,0.08)]"
      : ratingKind === "fail"
        ? "border-red-400/65 light:border-red-400/80 shadow-[0_4px_14px_rgba(239,68,68,0.12)] light:shadow-[0_4px_12px_rgba(239,68,68,0.08)]"
        : "border-theme-modal-border shadow-sm hover:border-theme-button-primary/40";

  return (
    <div className="h-full min-h-0 flex flex-col bg-theme-bg-secondary">
      {/* 卡片区：可滚动，不挤压底部按钮 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3 flex justify-center">
        <div
          onClick={handleFlip}
          className={`w-full max-w-2xl min-h-[min(100%,280px)] h-fit max-h-full overflow-y-auto bg-theme-bg-primary border rounded-xl cursor-pointer select-none
            transition-all duration-300 flex flex-col p-6 sm:p-8 my-auto ${cardBorder}`}
        >
          {flipped ? (
            loadingAnswer && !answerText ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <span className="inline-flex items-center gap-2 text-theme-text-secondary text-sm font-normal">
                  <CircleNotch className="w-4 h-4 animate-spin" />
                  正在根据知识库生成答案…
                </span>
              </div>
            ) : answerText ? (
              <div className="min-w-0 text-left">
                <CitedAnswer
                  text={answerText}
                  sources={sources}
                  className="text-[15px] leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
                />
              </div>
            ) : (
              <div className="text-theme-text-secondary text-sm py-8">
                暂无答案
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[200px] text-lg sm:text-xl font-semibold text-center text-theme-text-primary leading-relaxed whitespace-pre-wrap">
              {card.front}
            </div>
          )}
        </div>
      </div>

      {/* 操作条：固定在底部 */}
      <div className="shrink-0 px-4 pt-2 pb-5 sm:pb-6 border-t border-theme-modal-border/60 bg-theme-bg-secondary">
        <ReviewControls
          failCount={failCount}
          passCount={passCount}
          canPrev={canPrev}
          canNext={canNext}
          canRate={canRate}
          reviewing={reviewing}
          onPrev={onPrev}
          onNext={onNext}
          onFail={() => handleReview("again")}
          onPass={() => handleReview("good")}
        />
      </div>
    </div>
  );
}
