import React, { useState, useEffect } from "react";
import Learning from "@/models/learning";
import showToast from "@/utils/toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import { normalizeLearningItem } from "../utils";

const navBtnClass =
  "flex items-center justify-center w-11 h-11 rounded-full border border-theme-button-primary/45 text-theme-button-primary bg-transparent hover:bg-theme-button-primary/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:border-theme-modal-border disabled:text-theme-text-secondary";

const pillBase =
  "inline-flex items-center justify-center gap-1.5 min-w-[4.5rem] h-11 px-4 rounded-full border bg-theme-bg-primary text-sm font-semibold tabular-nums tracking-tight transition-all active:scale-95 disabled:opacity-35 disabled:pointer-events-none";

function arraysEqualAsSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return [...a].sort().join(",") === [...b].sort().join(",");
}

function emptySelection(multi) {
  return multi ? [] : null;
}

function restoreSelection(answer, multi) {
  if (!answer) return emptySelection(multi);
  if (multi) {
    return Array.isArray(answer.selected) ? answer.selected : [];
  }
  return typeof answer.selected === "number" ? answer.selected : null;
}

export default function Quiz({
  item,
  slug,
  onAnswered,
  onPrev,
  onNext,
  canPrev = false,
  canNext = false,
  center = false,
  answer = null,
  onSubmit,
  allowRetry = false,
}) {
  const q = normalizeLearningItem(item);
  const multi = !!q?.multi;
  const [selected, setSelected] = useState(() =>
    restoreSelection(answer, multi)
  );
  const [submitted, setSubmitted] = useState(!!answer?.submitted);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelected(restoreSelection(answer, multi));
    setSubmitted(!!answer?.submitted);
    // 只在换题时恢复，避免作答过程中被父级重渲染冲掉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, multi]);

  if (!q) return null;

  const correctSet = multi
    ? q.correctIndices || []
    : [q.correctIndex ?? 0];

  const isCorrect = submitted
    ? multi
      ? arraysEqualAsSet(selected, correctSet)
      : selected === (q.correctIndex ?? 0)
    : false;

  const toggleOption = (idx) => {
    if (submitted) return;
    if (multi) {
      setSelected((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      setSelected(idx);
    }
  };

  const canSubmit = multi
    ? Array.isArray(selected) && selected.length > 0
    : selected !== null;

  const handleSubmit = async () => {
    if (!canSubmit || submitted) return;
    const correct = multi
      ? arraysEqualAsSet(selected, correctSet)
      : selected === (q.correctIndex ?? 0);
    setSubmitted(true);
    onSubmit?.({
      itemId: q.id,
      selected,
      submitted: true,
      correct,
    });
    if (q.id && slug) {
      setLoading(true);
      const result = await Learning.review(slug, q.id, correct ? "good" : "again");
      if (result.error) showToast(`记录失败: ${result.error}`, "error");
      if (!correct) await Learning.moveToTrash(slug, q.id);
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (loading) return;
    onPrev?.();
  };

  const handleNext = () => {
    if (loading) return;
    if (onNext) onNext();
    else onAnswered?.("next");
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-theme-bg-secondary">
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
      <div
        className={`w-full max-w-2xl mx-auto ${
          center
            ? "min-h-full flex flex-col justify-center py-6"
            : "pt-4 pb-3"
        }`}
      >
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-theme-text-secondary text-xs">
              {multi ? "多选题（可选多个）" : "单选题"}
            </span>
            {q.role ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 light:bg-slate-100 text-theme-text-secondary">
                {q.role}
              </span>
            ) : null}
            {q.difficulty ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 light:bg-slate-100 text-theme-text-secondary">
                {q.difficulty}
              </span>
            ) : null}
          </div>
          <h2 className="text-theme-text-primary text-lg font-semibold leading-relaxed whitespace-pre-wrap">
            {q.question}
          </h2>
        </div>

        <div className={`space-y-2 ${submitted ? "mb-6" : ""}`}>
          {(q.options || []).map((opt, idx) => {
            const isSelected = multi
              ? selected.includes(idx)
              : selected === idx;
            const isCorrectOption = submitted && correctSet.includes(idx);
            const isWrongOption =
              submitted && isSelected && !correctSet.includes(idx);

            let optionClass =
              "border-transparent bg-white/[0.04] light:bg-slate-100 hover:bg-white/[0.07] light:hover:bg-slate-200/80";
            if (submitted) {
              if (isCorrectOption)
                optionClass = "border-transparent bg-white/[0.08] light:bg-emerald-50";
              else if (isWrongOption)
                optionClass = "border-transparent bg-white/[0.03] light:bg-red-50 opacity-80";
            } else if (isSelected) {
              optionClass =
                "border-white/15 light:border-slate-300 bg-white/10 light:bg-slate-200";
            }

            const markSelected = isSelected && !submitted;

            return (
              <button
                key={idx}
                disabled={submitted}
                onClick={() => toggleOption(idx)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 border rounded-lg text-left transition-colors ${optionClass} disabled:cursor-default`}
              >
                <span
                  className={`flex-shrink-0 w-6 h-6 ${
                    multi ? "rounded-md" : "rounded-full"
                  } border flex items-center justify-center text-xs font-mono ${
                    markSelected
                      ? "border-white/25 bg-white/15 text-white light:border-slate-400 light:bg-slate-300 light:text-slate-900"
                      : "border-white/15 text-theme-text-secondary light:border-slate-300"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-theme-text-primary text-sm flex-1">
                  {opt}
                </span>
                {submitted && isCorrectOption && (
                  <CheckCircle
                    className="w-5 h-5 text-emerald-500"
                    weight="fill"
                  />
                )}
                {submitted && isWrongOption && (
                  <XCircle className="w-5 h-5 text-red-500" weight="fill" />
                )}
              </button>
            );
          })}
        </div>

        {submitted && (
          <div
            className={`p-4 rounded-xl border ${
              isCorrect
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-red-500/10 border-red-500/30"
            }`}
          >
            <p className="text-sm font-semibold mb-1 text-theme-text-primary">
              {isCorrect ? "✓ 回答正确！" : "✗ 回答错误"}
            </p>
            {q.explanation && (
              <p className="text-sm text-theme-text-secondary">
                {q.explanation}
              </p>
            )}
          </div>
        )}

      </div>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-5 sm:pb-6 border-t border-theme-modal-border/60 bg-theme-bg-secondary">
        <div className="flex items-center justify-center gap-3 sm:gap-4 select-none">
          <button
            type="button"
            className={navBtnClass}
            disabled={!canPrev || loading}
            onClick={handlePrev}
            aria-label="上一题"
            title="上一题"
          >
            <ArrowLeft className="w-5 h-5" weight="bold" />
          </button>
          <button
            type="button"
            className={`${pillBase} min-w-[7.5rem] text-white bg-theme-button-primary border-theme-button-primary hover:opacity-90`}
            disabled={
              loading ||
              (submitted && !(allowRetry && !isCorrect)) ||
              (!submitted && !canSubmit)
            }
            onClick={() => {
              if (submitted && allowRetry && !isCorrect) {
                setSubmitted(false);
                setSelected(emptySelection(multi));
                onSubmit?.({
                  itemId: q.id,
                  selected: emptySelection(multi),
                  submitted: false,
                  correct: false,
                });
                return;
              }
              handleSubmit();
            }}
          >
            {submitted
              ? allowRetry && !isCorrect
                ? "重答"
                : "已提交"
              : "提交"}
          </button>
          <button
            type="button"
            className={navBtnClass}
            disabled={!canNext || loading}
            onClick={handleNext}
            aria-label="下一题"
            title="下一题"
          >
            <ArrowRight className="w-5 h-5" weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
