import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowsIn,
  ArrowsOut,
  Broom,
  CaretLeft,
  CaretRight,
  PencilSimple,
  Trash,
  X,
} from "@phosphor-icons/react";

function HistoryContextMenu({ x, y, title, onRename, onDelete, onClose }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [onClose]);

  const menuStyle = {};
  if (typeof window !== "undefined") {
    if (x + 160 > window.innerWidth) menuStyle.right = window.innerWidth - x;
    else menuStyle.left = x;
    if (y + 120 > window.innerHeight) menuStyle.bottom = window.innerHeight - y;
    else menuStyle.top = y;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9990] bg-theme-bg-secondary border border-theme-modal-border rounded-lg shadow-xl py-1 min-w-[160px]"
      style={menuStyle}
    >
      {title ? (
        <div className="px-3 py-1.5 text-[10px] text-theme-text-secondary truncate border-b border-theme-modal-border/50 max-w-[220px]">
          {title}
        </div>
      ) : null}
      {onRename ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRename();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors"
        >
          <PencilSimple className="w-3.5 h-3.5" />
          重命名
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash className="w-3.5 h-3.5" />
          删除
        </button>
      ) : null}
    </div>,
    document.body
  );
}

/** 历史行：悬停删除、右键重命名/删除（对齐文件树） */
export function HistoryListItem({
  title,
  subtitle,
  active,
  icon: Icon,
  onSelect,
  onDelete,
  onRename,
}) {
  const [menu, setMenu] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef(null);
  const skipBlurRef = useRef(false);
  const committedRef = useRef(false);

  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [editing]);

  const startRename = () => {
    setMenu(null);
    setDraft(title);
    committedRef.current = false;
    skipBlurRef.current = true;
    // 等右键菜单卸掉、点击事件走完，再进入编辑，避免立刻 blur 把改名取消
    window.setTimeout(() => {
      setEditing(true);
      window.setTimeout(() => {
        skipBlurRef.current = false;
      }, 200);
    }, 0);
  };

  const cancelEdit = () => {
    skipBlurRef.current = false;
    committedRef.current = true;
    setEditing(false);
    setDraft(title);
  };

  const commitEdit = () => {
    if (skipBlurRef.current) {
      inputRef.current?.focus();
      return;
    }
    if (committedRef.current) return;
    committedRef.current = true;
    const name = String(draft || "").trim();
    setEditing(false);
    if (!name || name === title) {
      setDraft(title);
      return;
    }
    onRename?.(name);
  };

  const canMenu = Boolean(onRename || onDelete);

  return (
    <div
      onClick={() => {
        if (!editing) onSelect?.();
      }}
      onContextMenu={(e) => {
        if (!canMenu || editing) return;
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`group relative w-full text-left pl-3 pr-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
        active
          ? "bg-theme-button-primary/10"
          : "hover:bg-theme-file-picker-hover/70"
      }`}
    >
      {active ? (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-theme-button-primary" />
      ) : null}
      <div className="flex items-center gap-2 min-w-0">
        {Icon ? (
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              active
                ? "bg-theme-button-primary/15 text-theme-button-primary ring-1 ring-inset ring-black/80 light:ring-black/70"
                : "bg-theme-bg-primary/60 text-theme-text-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" weight="duotone" />
          </span>
        ) : null}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  skipBlurRef.current = false;
                  commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              onBlur={commitEdit}
              className="w-full bg-theme-settings-input-bg text-theme-text-primary text-xs px-1.5 py-0.5 rounded border border-blue-500 focus:outline-none"
            />
          ) : (
            <p
              className={`text-[12px] truncate leading-snug ${
                active
                  ? "text-theme-text-primary font-medium"
                  : "text-theme-text-primary/90"
              }`}
            >
              {title}
            </p>
          )}
          {subtitle ? (
            <p className="text-[10px] text-theme-text-secondary/80 mt-0.5 truncate">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {menu ? (
        <HistoryContextMenu
          x={menu.x}
          y={menu.y}
          title={title}
          onRename={onRename ? startRename : undefined}
          onDelete={onDelete}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * 右侧生成批次列表（对齐导图历史 / 文件树）
 */
export function SessionHistoryList({
  sessions = [],
  selectedId,
  onSelect,
  onDelete,
  onRename,
  emptyIcon: EmptyIcon,
  itemIcon,
  emptyTitle,
  emptyHint,
  unit = "项",
}) {
  if (!sessions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-10 text-theme-text-secondary">
        {EmptyIcon ? (
          <EmptyIcon className="w-6 h-6 mb-2 opacity-30" weight="duotone" />
        ) : null}
        <p className="text-[11px] text-center">{emptyTitle || "暂无历史"}</p>
        {emptyHint ? (
          <p className="text-[10px] text-center mt-1 opacity-60 leading-relaxed">
            {emptyHint}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-1.5 pb-3 space-y-0.5">
      {sessions.map((s) => {
        const active = selectedId != null && selectedId === s.id;
        const count = s.items?.length || 0;
        const title = s.title || s.sourceLabel || "未命名";
        return (
          <HistoryListItem
            key={s.id}
            icon={itemIcon || EmptyIcon}
            title={title}
            subtitle={`${count}${unit}${
              s.quizTypeLabel ? ` · ${s.quizTypeLabel}` : ""
            }${s.timeLabel ? ` · ${s.timeLabel}` : ""}`}
            active={active}
            onSelect={() => onSelect?.(s)}
            onDelete={onDelete ? () => onDelete(s) : undefined}
            onRename={onRename ? (name) => onRename(s, name) : undefined}
          />
        );
      })}
    </div>
  );
}

/** 右侧历史栏：标题 + 清除 */
export function HistoryRail({
  title = "最近生成",
  count = 0,
  onClear,
  children,
}) {
  return (
    <aside className="w-[15.5rem] shrink-0 min-h-0 flex flex-col border-l border-theme-modal-border/70 bg-theme-bg-secondary/30">
      <div className="shrink-0 h-10 px-3 flex items-center justify-between gap-2 border-b border-theme-modal-border/50">
        <p className="text-[11px] font-medium tracking-wide text-theme-text-secondary">
          {title}
          {count > 0 ? (
            <span className="ml-1.5 tabular-nums text-theme-text-secondary/70">
              {count}
            </span>
          ) : null}
        </p>
        {onClear && count > 0 ? (
          <button
            type="button"
            onClick={onClear}
            title="清除全部"
            aria-label="清除全部"
            className="w-6 h-6 rounded-md flex items-center justify-center text-theme-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Broom className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </aside>
  );
}

/** 右侧练习区顶栏：资料名 + 进度翻页 */
const iconBtn =
  "w-7 h-7 rounded-lg flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover disabled:opacity-30 disabled:pointer-events-none transition-colors";

export function SessionPlayerBar({
  session,
  index,
  onIndexChange,
  unit = "项",
  onEnlarge,
  onClose,
  enlarged = false,
  hidePager = false,
  onDelete,
  deleteDisabled = true,
  onEnd,
}) {
  const total = session?.items?.length || 0;
  if (!session || !total) return null;
  const safeIndex = Math.min(Math.max(0, index), total - 1);

  return (
    <div className="shrink-0 h-12 px-4 border-b border-theme-modal-border flex items-center justify-between gap-3 bg-theme-bg-primary/50">
      <div className="min-w-0 flex items-baseline gap-2">
        <p className="text-xs font-medium text-theme-text-primary truncate">
          {session.title || session.sourceLabel}
        </p>
        <p className="text-[10px] text-theme-text-secondary truncate shrink-0">
          {[
            session.timeLabel,
            session.quizTypeLabel,
            `${total}${unit}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!hidePager ? (
          <>
            <button
              type="button"
              disabled={safeIndex <= 0}
              onClick={() => onIndexChange?.(safeIndex - 1)}
              className={iconBtn}
              aria-label="上一题"
            >
              <CaretLeft className="w-4 h-4" weight="bold" />
            </button>
            <span className="min-w-[3.25rem] text-center text-[11px] tabular-nums text-theme-text-secondary">
              {safeIndex + 1} / {total}
            </span>
            <button
              type="button"
              disabled={safeIndex >= total - 1}
              onClick={() => onIndexChange?.(safeIndex + 1)}
              className={iconBtn}
              aria-label="下一题"
            >
              <CaretRight className="w-4 h-4" weight="bold" />
            </button>
          </>
        ) : null}
        {onEnlarge ? (
          <button
            type="button"
            onClick={onEnlarge}
            className={`${iconBtn} ml-1`}
            aria-label={enlarged ? "还原" : "放大"}
            title={enlarged ? "还原" : "放大"}
          >
            {enlarged ? (
              <ArrowsIn className="w-4 h-4" weight="bold" />
            ) : (
              <ArrowsOut className="w-4 h-4" weight="bold" />
            )}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={iconBtn}
            aria-label="关闭"
            title="关闭"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        ) : null}
        {onEnd ? (
          <button
            type="button"
            onClick={onEnd}
            className={`${iconBtn} ml-1 text-[11px] font-medium w-auto px-2`}
            aria-label="结束"
            title="结束并查看结果"
          >
            结束
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className={`${iconBtn} ${
              deleteDisabled
                ? ""
                : "text-red-400 hover:text-red-400 hover:bg-red-500/10"
            }`}
            aria-label="删除"
            title={
              deleteDisabled ? "答对后才可删除" : "永久删除"
            }
          >
            <Trash className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 放大后居中铺开；缩小按钮仍在内容顶栏原位 */
export function EnlargedStage({ children }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/55 light:bg-slate-900/40 flex items-center justify-center p-4 sm:p-8">
      <div className="relative z-0 w-full max-w-3xl h-[min(86vh,760px)] flex flex-col min-h-0 rounded-2xl border border-theme-modal-border bg-theme-bg-secondary shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}
