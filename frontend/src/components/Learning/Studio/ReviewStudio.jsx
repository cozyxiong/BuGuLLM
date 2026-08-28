import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import StudioShell from "./StudioShell";
import FlashCard from "../FlashCard";
import Quiz from "../Quiz";
import QuizResult from "../Quiz/Result";
import { normalizeLearningItem } from "../utils";
import { Brain } from "@phosphor-icons/react";
import {
  EnlargedStage,
  SessionPlayerBar,
} from "./SessionHistory";

function ratedOf(answers, id) {
  if (id == null) return null;
  return answers[id] || answers[String(id)] || null;
}

function itemKind(item) {
  if (item?.itemType === "flashcard" || item?.type === "flashcard")
    return "flashcard";
  return "quiz";
}

function isCardOrQuiz(item) {
  const t = item?.itemType || item?.type;
  return (
    t === "flashcard" ||
    t === "quiz" ||
    t === "quiz_single" ||
    t === "quiz_multi"
  );
}

function recencySort(a, b) {
  return new Date(b.lastUpdatedAt || 0) - new Date(a.lastUpdatedAt || 0);
}

function sm2Sort(a, b) {
  const ta = iTime(a.nextReviewAt);
  const tb = iTime(b.nextReviewAt);
  if (ta !== tb) return ta - tb;
  return recencySort(a, b);
}

function pickReviewItems(raw, spaced) {
  const pool = (raw || [])
    .map(normalizeLearningItem)
    .filter(Boolean)
    .filter(isCardOrQuiz);
  const sorted = pool.slice().sort(spaced ? sm2Sort : recencySort);
  return {
    items: sorted.length > 30 ? sorted.slice(0, 30) : sorted,
    total: pool.length,
  };
}

function iTime(v) {
  if (!v) return 0;
  const n = new Date(v).getTime();
  return Number.isFinite(n) ? n : 0;
}

export default function ReviewStudio() {
  const { slug } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("quiz");
  const [reviewScope, setReviewScope] = useState(null);
  const [answers, setAnswers] = useState({});
  const [enlarged, setEnlarged] = useState(false);

  const refresh = useCallback(async () => {
    const [trash, settings] = await Promise.all([
      Learning.getTrash(slug),
      Learning.getSettings(slug),
    ]);
    const spaced = !!settings?.settings?.spacedRepetitionEnabled;
    const picked = pickReviewItems(trash.items || [], spaced);
    setItems(picked.items);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    setAnswers({});
    setIndex(0);
    setPhase("quiz");
    setReviewScope(null);
    setEnlarged(false);
    refresh();
  }, [refresh]);

  const playItems =
    reviewScope === "wrong"
      ? items.filter(
          (i) =>
            ratedOf(answers, i.id)?.submitted &&
            !ratedOf(answers, i.id)?.correct
        )
      : reviewScope === "answered"
        ? items.filter((i) => ratedOf(answers, i.id)?.submitted)
        : items;
  const current = playItems[index] || null;
  const kind = current ? itemKind(current) : null;
  const currentAnswer = current ? ratedOf(answers, current.id) : null;
  const session = { title: "复习", items: playItems };

  const failCount = items.filter(
    (i) => ratedOf(answers, i.id)?.submitted && !ratedOf(answers, i.id)?.correct
  ).length;
  const passCount = items.filter(
    (i) => ratedOf(answers, i.id)?.submitted && ratedOf(answers, i.id)?.correct
  ).length;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    if (index < playItems.length - 1) setIndex((i) => i + 1);
    else setPhase("result");
  }, [index, playItems.length]);

  const handleEnd = () => setPhase("result");

  const handleReview = () => {
    setReviewScope("answered");
    setIndex(0);
    setPhase("quiz");
  };

  const handleReviewWrong = () => {
    setReviewScope("wrong");
    setIndex(0);
    setPhase("quiz");
  };

  const handleRetake = () => {
    setAnswers({});
    setReviewScope(null);
    setIndex(0);
    setPhase("quiz");
  };

  const onReviewed = (rating, ratedId) => {
    const fail = rating === "again" || rating === "hard";
    const id = ratedId ?? current?.id;
    if (id == null) return;
    setAnswers((prev) => ({
      ...prev,
      [String(id)]: {
        submitted: true,
        correct: !fail,
        kind: fail ? "fail" : "pass",
      },
    }));
    if (index >= playItems.length - 1) setPhase("result");
    else setIndex((i) => i + 1);
  };

  const playerBar = (opts = {}) => (
    <SessionPlayerBar
      session={phase === "result" ? { title: "复习", items } : session}
      index={index}
      onIndexChange={setIndex}
      unit=" 道"
      hidePager={phase === "result"}
      onEnlarge={() => setEnlarged((v) => !v)}
      enlarged={!!opts.enlarged}
      onEnd={phase === "result" ? undefined : handleEnd}
    />
  );

  const playerBody =
    phase === "result" ? (
      <QuizResult
        items={items}
        answers={answers}
        center
        title="复习结果"
        reviewLabel="回顾全部"
        reviewWrongLabel="回顾错题"
        retakeLabel="重新复习"
        onReview={handleReview}
        onReviewWrong={handleReviewWrong}
        onRetake={handleRetake}
      />
    ) : current && kind === "flashcard" ? (
      <FlashCard
        item={current}
        slug={slug}
        keepTrash
        answer={currentAnswer}
        onReviewed={onReviewed}
        onPrev={goPrev}
        onNext={goNext}
        canPrev={index > 0}
        canNext={index < playItems.length - 1 || playItems.length > 0}
        failCount={failCount}
        passCount={passCount}
      />
    ) : current ? (
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
            setPhase("result");
          }
        }}
      />
    ) : null;

  return (
    <StudioShell
      title="复习"
      fillHeight
      description="复习垃圾桶里的错题，可在设置里设置间隔复习"
    >
      {loading ? (
        <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
          加载中…
        </div>
      ) : !items.length ? (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-theme-button-primary/10 flex items-center justify-center mb-4">
            <Brain
              className="w-7 h-7 text-theme-button-primary"
              weight="duotone"
            />
          </div>
          <p className="text-sm font-semibold text-theme-text-primary mb-1">
            暂无待复习内容
          </p>
          <p className="text-xs text-theme-text-secondary max-w-xs leading-relaxed">
            不记得的卡片和答错的测试会进入垃圾桶，再到这里练习。
          </p>
        </div>
      ) : (
        <div className="h-full min-h-0 flex flex-col border-t border-theme-modal-border">
          {!enlarged ? (
            <>
              {playerBar()}
              <div className="flex-1 min-h-0 overflow-hidden">{playerBody}</div>
            </>
          ) : null}
        </div>
      )}
      {enlarged && (phase === "result" ? items.length : current) ? (
        <EnlargedStage>
          {playerBar({ enlarged: true })}
          <div className="flex-1 min-h-0 overflow-hidden">{playerBody}</div>
        </EnlargedStage>
      ) : null}
    </StudioShell>
  );
}
