import React, { useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  ListBullets,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import ReleasePlay from "./ReleasePlay";

function collectTags(items = []) {
  const seen = new Set();
  const tags = [];
  const push = (raw) => {
    const label = String(raw || "")
      .replace(/\.(md|markdown|txt)$/i, "")
      .trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    tags.push(label);
  };
  for (const it of items) {
    if (Array.isArray(it.tags)) it.tags.forEach(push);
  }
  if (!tags.length) {
    for (const it of items) {
      if (Array.isArray(it.sourceNames)) it.sourceNames.forEach(push);
    }
  }
  return tags;
}

function Donut({ correct, wrong, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCorrect = Math.min(safeTotal, Math.max(0, Number(correct) || 0));
  const safeWrong = Math.min(
    safeTotal - safeCorrect,
    Math.max(0, Number(wrong) || 0)
  );
  const pct = safeTotal ? Math.round((safeCorrect / safeTotal) * 100) : 0;
  const r = 56;
  const c = 2 * Math.PI * r;
  const correctLen = safeTotal ? (safeCorrect / safeTotal) * c : 0;
  const wrongLen = safeTotal ? (safeWrong / safeTotal) * c : 0;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-theme-modal-border"
        />
        {wrongLen > 0 ? (
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${wrongLen} ${c - wrongLen}`}
            strokeDashoffset={-correctLen}
            strokeLinecap="butt"
            className="text-red-400/85"
          />
        ) : null}
        {correctLen > 0 ? (
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${correctLen} ${c - correctLen}`}
            strokeLinecap={wrongLen > 0 ? "butt" : "round"}
            className="text-emerald-400"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-theme-text-primary leading-none">
          {pct}
          <span className="text-base font-medium text-theme-text-secondary">
            %
          </span>
        </span>
        <span className="text-[11px] text-theme-text-secondary mt-1">
          正确率
        </span>
      </div>
    </div>
  );
}

export default function QuizResult({
  items = [],
  answers = {},
  onReview,
  onReviewWrong,
  onRetake,
  center = false,
  title = "测试结果",
  statCorrect = "答对",
  statWrong = "答错",
  statUnit = "题",
  reviewLabel = "回顾测试",
  reviewWrongLabel = "回顾错题",
  retakeLabel = "重新测试",
  onDeleteCorrect,
  deleteCorrectLabel = "删除答对的题",
}) {
  const [released, setReleased] = useState(false);
  const { correct, wrong, total, tags } = useMemo(() => {
    const list = items || [];
    let ok = 0;
    let bad = 0;
    for (const it of list) {
      const a = answers[it.id] || answers[String(it.id)];
      if (a?.submitted && a.correct) ok += 1;
      else if (a?.submitted && !a.correct) bad += 1;
    }
    return {
      correct: ok,
      wrong: bad,
      total: ok + bad,
      tags: collectTags(list),
    };
  }, [items, answers]);

  const handleDeleteCorrect = async () => {
    if (!onDeleteCorrect) return;
    const ok = await onDeleteCorrect();
    if (ok) setReleased(true);
  };

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto px-6 ${
        center ? "flex items-center" : ""
      }`}
    >
      <div className="w-full max-w-md mx-auto py-8 text-center">
        {!released ? (
          <p className="text-sm font-medium text-theme-text-primary mb-6">
            {title}
          </p>
        ) : null}
        {released ? (
          <ReleasePlay />
        ) : (
          <>
            <Donut correct={correct} wrong={wrong} total={total} />
            <p className="mt-5 text-sm text-theme-text-secondary">
              {statCorrect}{" "}
              <span className="text-emerald-400 font-semibold tabular-nums">
                {correct}
              </span>{" "}
              {statUnit} · {statWrong}{" "}
              <span className="text-red-400 font-semibold tabular-nums">
                {wrong}
              </span>{" "}
              {statUnit} · 共{" "}
              <span className="text-theme-text-primary font-semibold tabular-nums">
                {total}
              </span>{" "}
              {statUnit}
            </p>
          </>
        )}

        {!released && tags.length ? (
          <div className="mt-6 text-left">
            <p className="text-[11px] text-theme-text-secondary mb-2 text-center">
              涵盖知识点
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-[11px] text-theme-text-primary bg-theme-bg-primary border border-theme-modal-border"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 5 ? (
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] text-theme-text-secondary bg-theme-bg-primary border border-theme-modal-border"
                  title={tags.slice(5).join("、")}
                >
                  …
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onReview}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-theme-modal-border bg-theme-bg-primary text-[13px] font-medium text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors whitespace-nowrap"
          >
            <ListBullets className="w-4 h-4 shrink-0" />
            {reviewLabel}
          </button>
          <button
            type="button"
            onClick={onReviewWrong}
            disabled={wrong === 0}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-theme-modal-border bg-theme-bg-primary text-[13px] font-medium text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            <XCircle className="w-4 h-4 shrink-0 text-red-400" />
            {reviewWrongLabel}
          </button>
          {onRetake ? (
            <button
              type="button"
              onClick={onRetake}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-semibold text-white bg-theme-button-primary hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <ArrowCounterClockwise className="w-4 h-4 shrink-0" />
              {retakeLabel}
            </button>
          ) : null}
          {onDeleteCorrect && !released ? (
            <button
              type="button"
              onClick={handleDeleteCorrect}
              disabled={correct === 0}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-red-400/40 text-[13px] font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
            >
              <Trash className="w-4 h-4 shrink-0" />
              {deleteCorrectLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
