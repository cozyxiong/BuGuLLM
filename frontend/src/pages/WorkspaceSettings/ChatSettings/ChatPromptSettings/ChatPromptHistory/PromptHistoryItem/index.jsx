import { useState } from "react";
import { ArrowCounterClockwise, Trash, CaretDown } from "@phosphor-icons/react";
import PromptHistory from "@/models/promptHistory";
import { useTranslation } from "react-i18next";
import moment from "moment";
import "moment/locale/zh-cn";

const PREVIEW_CHARS = 160;

export default function PromptHistoryItem({
  id,
  prompt,
  modifiedAt,
  user,
  onRestore,
  setHistory,
  onPublishClick: _onPublishClick,
  index = 0,
}) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const locale = (i18n.language || "zh").startsWith("zh") ? "zh-cn" : "en";
  const timeLabel = moment(modifiedAt).locale(locale).fromNow();
  const needsExpand = (prompt || "").length > PREVIEW_CHARS;
  const displayText =
    needsExpand && !expanded
      ? `${(prompt || "").slice(0, PREVIEW_CHARS).trim()}…`
      : prompt || "";

  const deleteHistory = async () => {
    if (!window.confirm(t("chat.prompt.history.deleteConfirm"))) return;
    setDeleting(true);
    try {
      const { success } = await PromptHistory.delete(id);
      if (success) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article
      className={[
        "group relative rounded-xl border transition-all duration-150",
        "border-white/[0.06] light:border-theme-modal-border",
        "bg-white/[0.02] light:bg-black/[0.015]",
        "hover:border-white/[0.1] hover:bg-white/[0.035]",
        "light:hover:border-theme-modal-border light:hover:bg-black/[0.03]",
      ].join(" ")}
    >
      <div className="px-3.5 pt-3 pb-2.5">
        {/* 元信息 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-white/35 light:text-theme-text-secondary">
            <span className="tabular-nums shrink-0 text-white/25 light:text-theme-text-secondary/70">
              #{index + 1}
            </span>
            <span className="w-px h-2.5 bg-white/10 light:bg-theme-modal-border shrink-0" />
            <time className="truncate" dateTime={modifiedAt}>
              {timeLabel}
            </time>
            {user?.username && (
              <>
                <span className="w-px h-2.5 bg-white/10 light:bg-theme-modal-border shrink-0" />
                <span className="truncate text-white/50 light:text-theme-text-secondary">
                  {user.username}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 正文预览 */}
        <p className="m-0 text-[13px] leading-[1.55] text-white/75 light:text-theme-text-primary whitespace-pre-wrap break-words">
          {displayText}
        </p>

        {needsExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-0.5 border-none bg-transparent p-0 text-[11px] font-medium text-white/40 hover:text-white/70 light:text-theme-text-secondary light:hover:text-theme-text-primary cursor-pointer transition-colors"
          >
            {expanded ? "收起" : t("chat.prompt.history.expand")}
            <CaretDown
              size={12}
              weight="bold"
              className={[
                "transition-transform duration-150",
                expanded ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
        )}
      </div>

      {/* 操作栏 */}
      <div className="px-2.5 py-2 border-t border-white/[0.05] light:border-theme-modal-border flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRestore}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border-none bg-white/[0.06] hover:bg-white/[0.1] light:bg-black/[0.04] light:hover:bg-black/[0.07] text-[12px] font-medium text-white/85 light:text-theme-text-primary cursor-pointer transition-colors"
        >
          <ArrowCounterClockwise size={13} weight="bold" />
          {t("chat.prompt.history.restore")}
        </button>
        <button
          type="button"
          onClick={deleteHistory}
          disabled={deleting}
          title={t("chat.prompt.history.delete")}
          aria-label={t("chat.prompt.history.delete")}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border-none bg-transparent hover:bg-red-500/15 text-white/30 hover:text-red-300 light:text-theme-text-secondary light:hover:text-red-600 light:hover:bg-red-50 cursor-pointer disabled:opacity-50 transition-colors"
        >
          <Trash size={14} weight="regular" />
        </button>
      </div>
    </article>
  );
}
