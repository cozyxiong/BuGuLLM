import React, { useEffect, useState } from "react";
import Learning from "@/models/learning";
import { useLearning, useActiveFilePaths } from "../LearningContext";

function formatCount(n) {
  if (n == null || !Number.isFinite(n)) return "…";
  return Math.round(n).toLocaleString("zh-CN");
}

/**
 * 已选笔记字数 / 当前模型大约能塞入的字数
 */
export default function NoteBudgetBadge({ kind, count }) {
  const { slug } = useLearning();
  const filePaths = useActiveFilePaths();
  const pathKey = filePaths.join("\0");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !kind) return undefined;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await Learning.contextBudget(slug, {
        filePaths,
        kind,
        count,
      });
      if (cancelled) return;
      if (r?.error) {
        setLoading(false);
        return;
      }
      setData(r);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, kind, count, pathKey]);

  const used = data?.usedChars;
  const budget = data?.budgetChars;
  const over = !!data?.over;
  const title = over
    ? "已超出当前模型可塞入篇幅，将仅根据每篇前半段内容生成"
    : "已选笔记字数 / 当前模型大约能塞入的字数";

  return (
    <span
      title={title}
      className={`inline-flex items-center shrink-0 px-2.5 py-1 rounded-full text-[11px] tabular-nums border ${
        over
          ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25"
          : "text-theme-text-secondary bg-theme-settings-input-bg border-theme-modal-border"
      }`}
    >
      <strong
        className={`font-semibold ${
          over ? "" : "text-theme-text-primary"
        }`}
      >
        {loading && used == null ? "…" : formatCount(used ?? 0)}
      </strong>
      <span className="mx-0.5 opacity-50">/</span>
      <span>{formatCount(budget)}</span>
    </span>
  );
}
