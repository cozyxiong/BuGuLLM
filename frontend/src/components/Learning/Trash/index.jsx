import React, { useEffect, useMemo, useState } from "react";
import Learning from "@/models/learning";
import showToast from "@/utils/toast";
import {
  Cards,
  CaretLeft,
  CaretRight,
  Question,
  Trash,
  TreeStructure,
} from "@phosphor-icons/react";
import { normalizeLearningItem } from "../utils";
import FlashCard from "../FlashCard";
import Quiz from "../Quiz";
import MindMap from "../MindMap";
import QuizResult from "../Quiz/Result";
import {
  EnlargedStage,
  SessionPlayerBar,
} from "../Studio/SessionHistory";

const PAGE_SIZE = 10;

function ratedOf(answers, id) {
  if (id == null) return null;
  return answers[id] || answers[String(id)] || null;
}

const TYPE_ICONS = {
  flashcard: Cards,
  quiz: Question,
  quiz_single: Question,
  quiz_multi: Question,
  mindmap: TreeStructure,
};

const TYPE_LABELS = {
  flashcard: "学习卡片",
  quiz: "测试题",
  quiz_single: "单选题",
  quiz_multi: "多选题",
  mindmap: "思维目录",
};

function itemKind(item) {
  if (item?.itemType === "flashcard" || item?.type === "flashcard")
    return "flashcard";
  if (item?.itemType === "mindmap" || item?.type === "mindmap") return "mindmap";
  return "quiz";
}

export default function TrashBin({
  slug,
  items = [],
  onRefresh,
  emptyTitle,
  emptyHint,
}) {
  const list = useMemo(
    () => (items || []).map(normalizeLearningItem).filter(Boolean),
    [items]
  );
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState(null);
  const [index, setIndex] = useState(0);
  const [reviewScope, setReviewScope] = useState(null);
  const [answers, setAnswers] = useState({});
  const [deleting, setDeleting] = useState(false);

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = list.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  useEffect(() => {
    setAnswers({});
    setMode(null);
  }, [slug]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const playItems =
    reviewScope === "wrong"
      ? list.filter(
          (i) =>
            ratedOf(answers, i.id)?.submitted &&
            !ratedOf(answers, i.id)?.correct
        )
      : reviewScope === "answered"
        ? list.filter((i) => ratedOf(answers, i.id)?.submitted)
        : list;

  useEffect(() => {
    if (mode !== "play") return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => {
          if (i < playItems.length - 1) return i + 1;
          setMode("result");
          return i;
        });
      } else if (e.key === "Escape") {
        closeViewer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, playItems.length]);

  const current = mode === "play" ? playItems[index] || null : null;
  const kind = current ? itemKind(current) : null;
  const currentAnswer = current ? ratedOf(answers, current.id) : null;
  const canDelete = !!currentAnswer?.correct;
  const failCount = list.filter(
    (i) => ratedOf(answers, i.id)?.submitted && !ratedOf(answers, i.id)?.correct
  ).length;
  const passCount = list.filter(
    (i) => ratedOf(answers, i.id)?.submitted && ratedOf(answers, i.id)?.correct
  ).length;

  const closeViewer = () => {
    setMode(null);
    setAnswers({});
    setReviewScope(null);
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (index < playItems.length - 1) setIndex((i) => i + 1);
    else setMode("result");
  };

  const handleEnd = () => setMode("result");

  const handleReview = () => {
    setReviewScope("answered");
    setIndex(0);
    setMode("play");
  };

  const handleReviewWrong = () => {
    setReviewScope("wrong");
    setIndex(0);
    setMode("play");
  };

  const handleRetake = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const it of list) {
        delete next[it.id];
        delete next[String(it.id)];
      }
      return next;
    });
    setReviewScope(null);
    setIndex(0);
    setMode("play");
  };

  const handleDeleteCorrect = async () => {
    const ids = list
      .filter((i) => ratedOf(answers, i.id)?.correct)
      .map((i) => i.id)
      .filter(Boolean);
    if (!ids.length) return false;
    if (!window.confirm(`确定删除 ${ids.length} 道答对的题？此操作不可恢复。`))
      return false;
    setDeleting(true);
    const result = await Learning.deleteMany(slug, ids);
    setDeleting(false);
    if (result.error) {
      showToast(result.error, "error");
      return false;
    }
    showToast(`已删除 ${result.count ?? ids.length} 道答对的题`, "success");
    setAnswers((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        delete next[id];
        delete next[String(id)];
      }
      return next;
    });
    await onRefresh?.();
    return true;
  };

  const handleDelete = async () => {
    if (!current?.id || !canDelete || deleting) return;
    setDeleting(true);
    const result = await Learning.delete(slug, current.id);
    setDeleting(false);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    showToast("已删除", "success");
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[current.id];
      delete next[String(current.id)];
      return next;
    });
    const nextIndex =
      index >= playItems.length - 1 ? Math.max(0, index - 1) : index;
    const willEmpty = list.length <= 1;
    await onRefresh?.();
    if (willEmpty) setMode(null);
    else setIndex(nextIndex);
  };

  if (!list.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-theme-button-primary/10 flex items-center justify-center mb-4">
          <Trash className="w-7 h-7 text-theme-button-primary" weight="duotone" />
        </div>
        <p className="text-sm font-semibold text-theme-text-primary mb-1">
          {emptyTitle || "垃圾桶为空"}
        </p>
        <p className="text-xs text-theme-text-secondary max-w-xs leading-relaxed">
          {emptyHint || "不记得的卡片和答错的测试都会进入垃圾桶"}
        </p>
      </div>
    );
  }

  const viewer =
    mode === "result" ? (
      <>
        <SessionPlayerBar
          session={{ title: "垃圾桶", items: list }}
          index={0}
          hidePager
          onClose={closeViewer}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <QuizResult
            items={list}
            answers={answers}
            center
            title="垃圾桶结果"
            reviewLabel="回顾全部"
            reviewWrongLabel="回顾错题"
            retakeLabel="重新复习"
            deleteCorrectLabel="删除答对的题"
            onReview={handleReview}
            onReviewWrong={handleReviewWrong}
            onRetake={handleRetake}
            onDeleteCorrect={handleDeleteCorrect}
          />
        </div>
      </>
    ) : current ? (
    <>
      <SessionPlayerBar
        session={{ title: "垃圾桶", items: playItems }}
        index={index}
        onIndexChange={setIndex}
        unit=" 项"
        onClose={closeViewer}
        onEnd={handleEnd}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        {kind === "flashcard" ? (
          <FlashCard
            item={current}
            slug={slug}
            keepTrash
            answer={currentAnswer}
            onReviewed={(rating, ratedId) => {
              const fail = rating === "again" || rating === "hard";
              const id = ratedId ?? current.id;
              setAnswers((prev) => ({
                ...prev,
                [String(id)]: {
                  submitted: true,
                  correct: !fail,
                  kind: fail ? "fail" : "pass",
                },
              }));
              if (index >= playItems.length - 1) setMode("result");
              else setIndex((i) => i + 1);
            }}
            onPrev={goPrev}
            onNext={goNext}
            canPrev={index > 0}
            canNext={index < playItems.length - 1 || playItems.length > 0}
            failCount={failCount}
            passCount={passCount}
          />
        ) : kind === "quiz" ? (
          <Quiz
            item={current}
            slug={slug}
            center
            allowRetry
            keepTrash
            answer={currentAnswer}
            onPrev={goPrev}
            onNext={goNext}
            canPrev={index > 0}
            canNext={index < playItems.length - 1 || playItems.length > 0}
            onSubmit={(payload) => {
              if (payload?.itemId == null) return;
              setAnswers((prev) => ({
                ...prev,
                [String(payload.itemId)]: payload,
              }));
              if (payload.submitted && index >= playItems.length - 1) {
                setMode("result");
              }
            }}
          />
        ) : (
          <MindMap item={current} />
        )}
      </div>
    </>
  ) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <p className="text-xs text-theme-text-secondary">
          共 {list.length} 项
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {pageItems.map((item, i) => {
          const absIndex = safePage * PAGE_SIZE + i;
          const Icon =
            TYPE_ICONS[item.itemType] || TYPE_ICONS[item.type] || Question;
          const label =
            TYPE_LABELS[item.itemType] ||
            TYPE_LABELS[item.type] ||
            item.itemType;
          const saved = ratedOf(answers, item.id);
          const status =
            saved?.submitted && saved.correct
              ? "已答对"
              : saved?.submitted
                ? "已答错"
                : "";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAnswers({});
                setReviewScope(null);
                setIndex(absIndex);
                setMode("play");
              }}
              className="w-full flex items-center gap-3 bg-theme-bg-primary border border-theme-modal-border rounded-xl p-3 text-left hover:border-theme-button-primary/30 transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-theme-button-primary/10 flex items-center justify-center shrink-0">
                <Icon
                  className="w-4 h-4 text-theme-button-primary"
                  weight="duotone"
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-theme-text-primary text-sm truncate">
                  {item.title || item.question || item.front || "未命名"}
                </span>
                <span className="block text-theme-text-secondary text-xs mt-0.5">
                  {label}
                  {status ? ` · ${status}` : ""}
                  {item.lastUpdatedAt
                    ? ` · ${new Date(item.lastUpdatedAt).toLocaleDateString("zh-CN")}`
                    : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {pageCount > 1 ? (
        <div className="shrink-0 pt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-text-secondary hover:bg-theme-file-picker-hover disabled:opacity-30"
            aria-label="上一页"
          >
            <CaretLeft className="w-4 h-4" weight="bold" />
          </button>
          <span className="text-[11px] tabular-nums text-theme-text-secondary">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-text-secondary hover:bg-theme-file-picker-hover disabled:opacity-30"
            aria-label="下一页"
          >
            <CaretRight className="w-4 h-4" weight="bold" />
          </button>
        </div>
      ) : null}

      {mode ? <EnlargedStage>{viewer}</EnlargedStage> : null}
    </div>
  );
}
