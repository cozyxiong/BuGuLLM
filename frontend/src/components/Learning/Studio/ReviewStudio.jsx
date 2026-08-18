import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import StudioShell from "./StudioShell";
import FlashCard from "../FlashCard";
import Quiz from "../Quiz";
import { normalizeLearningItem } from "../utils";
import { Brain } from "@phosphor-icons/react";

export default function ReviewStudio() {
  const { slug } = useParams();
  const [dueItems, setDueItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("practice");
  const [loading, setLoading] = useState(true);
  const [failCount, setFailCount] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const ratingsRef = useRef(new Map());

  const refresh = useCallback(async () => {
    const result = await Learning.getDue(slug);
    setDueItems((result.items || []).map(normalizeLearningItem));
    if (result.mode) setMode(result.mode);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (index >= dueItems.length && dueItems.length > 0) {
      setIndex(dueItems.length - 1);
    }
    if (dueItems.length === 0) setIndex(0);
  }, [dueItems, index]);

  const current = dueItems[index];

  // 预取下一张卡的答案/来源
  useEffect(() => {
    const next = dueItems[index + 1];
    if (!next?.id) return;
    if (next.itemType !== "flashcard" && next.type !== "flashcard") return;
    const hasBack = String(next.back || "").trim().length > 0;
    const hasSources =
      Array.isArray(next.sources) && next.sources.length > 0;
    if (next.answerStatus === "ready" && hasBack && hasSources) return;
    Learning.ensureAnswer(slug, next.id).catch(() => {});
  }, [slug, index, dueItems]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(dueItems.length - 1, i + 1));
  }, [dueItems.length]);

  const onReviewed = useCallback(
    async (rating) => {
      const itemId = current?.id;
      const nextKind =
        rating === "again" || rating === "hard" ? "fail" : "pass";
      const prev = itemId != null ? ratingsRef.current.get(itemId) : null;
      if (prev !== nextKind) {
        if (prev === "fail") setFailCount((n) => Math.max(0, n - 1));
        if (prev === "pass") setPassCount((n) => Math.max(0, n - 1));
        if (nextKind === "fail") setFailCount((n) => n + 1);
        else setPassCount((n) => n + 1);
        if (itemId != null) ratingsRef.current.set(itemId, nextKind);
      }

      if (mode === "spaced") {
        // 间隔模式：已评卡会出队，刷新后停在同位置（原下一张顶上）
        const keep = index;
        await refresh();
        setIndex(() => Math.max(0, keep));
      } else if (index < dueItems.length - 1) {
        setIndex((i) => i + 1);
      }
      // 练习模式最后一张：停留当前，可继续用方向键浏览
    },
    [mode, index, dueItems.length, refresh, current?.id]
  );

  const onQuizAnswered = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return (
    <StudioShell
      title="复习"
      fillHeight
      description={
        mode === "spaced"
          ? "间隔复习 · 按 SM-2 安排下次复习"
          : "自由练习 · 可在设置中开启间隔复习"
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-full text-theme-text-secondary text-sm">
          加载中…
        </div>
      ) : current ? (
        <div className="h-full min-h-0 flex flex-col">
          {current.itemType === "flashcard" || current.type === "flashcard" ? (
            <FlashCard
              item={current}
              slug={slug}
              onReviewed={onReviewed}
              onPrev={goPrev}
              onNext={goNext}
              canPrev={index > 0}
              canNext={index < dueItems.length - 1}
              failCount={failCount}
              passCount={passCount}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <Quiz
                item={current}
                slug={slug}
                onAnswered={onQuizAnswered}
                onPrev={goPrev}
                onNext={goNext}
                canPrev={index > 0}
                canNext={index < dueItems.length - 1}
              />
            </div>
          )}
        </div>
      ) : (
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
            先在「卡片」或「测试」中根据笔记生成学习内容，再回到这里练习。
          </p>
          {(failCount > 0 || passCount > 0) && (
            <p className="mt-3 text-xs text-theme-text-secondary tabular-nums">
              本轮 · 不记得 {failCount} · 记得 {passCount}
            </p>
          )}
        </div>
      )}
    </StudioShell>
  );
}
