import { useEffect, useState, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ClockCounterClockwise, X, Trash } from "@phosphor-icons/react";
import PromptHistory from "@/models/promptHistory";
import PromptHistoryItem from "./PromptHistoryItem";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default forwardRef(function ChatPromptHistory(
  { show, workspaceSlug, onRestore, onClose, onPublishClick },
  ref
) {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadHistory() {
    if (!workspaceSlug) return;
    setLoading(true);
    PromptHistory.forWorkspace(workspaceSlug)
      .then((historyData) => {
        setHistory(historyData);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleClearAll() {
    if (!workspaceSlug) return;
    if (window.confirm(t("chat.prompt.history.clearAllConfirm"))) {
      PromptHistory.clearAll(workspaceSlug)
        .then(({ success }) => {
          if (success) setHistory([]);
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }

  useEffect(() => {
    if (show && workspaceSlug) loadHistory();
  }, [show, workspaceSlug]);

  // 关闭时用 Escape
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  return (
    <>
      {/* 背景遮罩：关闭时不渲染，避免残留 */}
      {show && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 light:bg-black/20 backdrop-blur-[2px] animate-[fadeIn_200ms_ease-out]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* 侧栏：关闭时 visibility+opacity 去掉阴影溢出 */}
      <div
        ref={ref}
        role="dialog"
        aria-modal={show}
        aria-hidden={!show}
        aria-label={t("chat.prompt.history.title")}
        className={[
          "fixed top-0 right-0 bottom-0 z-[100] w-full max-w-[380px]",
          "flex flex-col",
          "bg-[#161618]/98 light:bg-theme-bg-primary",
          "border-l border-white/[0.06] light:border-theme-modal-border",
          "transition-[transform,opacity,visibility] duration-300 ease-out",
          show
            ? "translate-x-0 opacity-100 visible pointer-events-auto shadow-[-24px_0_48px_rgba(0,0,0,0.35)]"
            : "translate-x-full opacity-0 invisible pointer-events-none shadow-none",
        ].join(" ")}
      >
        {/* 顶栏 */}
        <header className="shrink-0 h-[56px] px-5 flex items-center justify-between border-b border-white/[0.06] light:border-theme-modal-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] light:bg-black/[0.04] flex items-center justify-center shrink-0">
              <ClockCounterClockwise
                size={16}
                weight="regular"
                className="text-white/70 light:text-theme-text-primary"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-white/90 light:text-theme-text-primary tracking-tight truncate">
                {t("chat.prompt.history.title")}
              </h2>
              {!loading && history.length > 0 && (
                <p className="text-[11px] text-white/35 light:text-theme-text-secondary tabular-nums">
                  {history.length} 条记录
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="h-8 px-2.5 rounded-lg border-none bg-transparent text-[12px] font-medium text-white/40 hover:text-red-300/90 hover:bg-red-500/10 light:text-theme-text-secondary light:hover:text-red-600 light:hover:bg-red-50 cursor-pointer transition-colors"
              >
                {t("chat.prompt.history.clearAll")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border-none bg-transparent text-white/40 hover:text-white hover:bg-white/[0.06] light:text-theme-text-secondary light:hover:text-theme-text-primary light:hover:bg-black/[0.04] cursor-pointer transition-colors"
              aria-label="关闭"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </header>

        {/* 列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {loading ? (
            <LoaderSkeleton />
          ) : history.length === 0 ? (
            <EmptyState label={t("chat.prompt.history.noHistory")} />
          ) : (
            <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
              {history.map((item, index) => (
                <li key={item.id}>
                  <PromptHistoryItem
                    id={item.id}
                    {...item}
                    index={index}
                    onRestore={() => onRestore(item.prompt)}
                    onPublishClick={onPublishClick}
                    setHistory={setHistory}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
});

function EmptyState({ label }) {
  return (
    <div className="h-full min-h-[240px] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] text-white/40 light:text-theme-text-secondary leading-relaxed max-w-[220px] m-0">
        {label}
      </p>
    </div>
  );
}

function LoaderSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton.default
          key={i}
          height={108}
          width="100%"
          borderRadius={12}
          highlightColor="rgba(255,255,255,0.06)"
          baseColor="rgba(255,255,255,0.03)"
        />
      ))}
    </div>
  );
}
