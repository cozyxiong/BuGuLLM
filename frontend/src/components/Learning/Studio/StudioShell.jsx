import React from "react";
import { useActiveFilePaths } from "../LearningContext";
import { FileText, WarningCircle } from "@phosphor-icons/react";
import NoteBudgetBadge from "./NoteBudgetBadge";

/**
 * 各学习子页通用内容区：标题 + 资料角标 + 可选说明
 * 风格对齐知识库空态 / 侧栏工具条
 */
export default function StudioShell({
  title,
  description,
  children,
  requireDocs = false,
  /** 子内容需要撑满高度（导图分栏等） */
  fillHeight = false,
  /** cards | quiz | mindmap，用于字数 / 窗口提示 */
  budgetKind,
  budgetCount,
}) {
  const activePaths = useActiveFilePaths();

  return (
    <div className="h-full flex flex-col min-h-0 bg-theme-bg-secondary">
      <div className="shrink-0 px-4 sm:px-6 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-theme-text-primary tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed max-w-xl">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {budgetKind ? (
              <NoteBudgetBadge kind={budgetKind} count={budgetCount} />
            ) : null}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-theme-text-secondary bg-theme-settings-input-bg border border-theme-modal-border">
              <FileText size={12} weight="fill" className="text-theme-button-primary" />
              资料{" "}
              <strong className="text-theme-button-primary font-semibold">
                {activePaths.length}
              </strong>
            </span>
          </div>
        </div>
        {requireDocs && activePaths.length === 0 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs leading-relaxed">
            <WarningCircle size={14} weight="fill" className="shrink-0 mt-0.5" />
            <span>
              请先在左侧选择文档（单击打开，或 Ctrl / Shift 多选）后再生成。
            </span>
          </div>
        )}
      </div>
      <div
        className={
          fillHeight
            ? "flex-1 min-h-0 overflow-hidden flex flex-col"
            : "flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-8"
        }
      >
        {children}
      </div>
    </div>
  );
}
