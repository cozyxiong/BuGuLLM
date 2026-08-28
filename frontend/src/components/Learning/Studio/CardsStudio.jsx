import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import showToast from "@/utils/toast";
import {
  startGenerateJob,
  useGenerateKind,
  useRefreshOnGenerateDone,
  usePlayGenerated,
} from "../generateJobs";
import StudioShell from "./StudioShell";
import { useActiveFilePaths } from "../LearningContext";
import FlashCard from "../FlashCard";
import QuizResult from "../Quiz/Result";
import {
  SessionHistoryList,
  SessionPlayerBar,
  EnlargedStage,
  HistoryRail,
} from "./SessionHistory";
import {
  groupLearningSessions,
  findSessionByItemId,
} from "../utils";
import { Cards } from "@phosphor-icons/react";
import GenerateButton from "./GenerateButton";
import { fieldLabel, fieldControl, generateStage, generatePanel } from "./formStyles";
import { loadPlayerOpen, savePlayerOpen } from "./playerPref";

const STORE_KEY = (slug) => `bagullm.learn.session.${slug}.flashcard`;
const ANSWERS_KEY = (slug) => `bagullm.learn.card.ratings.${slug}`;

function loadAnswers(slug) {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY(slug));
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export default function CardsStudio() {
  const { slug } = useParams();
  const filePaths = useActiveFilePaths();
  const [count, setCount] = useState(12);
  const generating = useGenerateKind(slug, "cards");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [index, setIndex] = useState(0);
  const [showPlayer, setShowPlayerState] = useState(() =>
    loadPlayerOpen("flashcard", slug)
  );
  const setShowPlayer = useCallback(
    (open) => {
      setShowPlayerState(open);
      savePlayerOpen("flashcard", slug, open);
    },
    [slug]
  );
  const [enlarged, setEnlarged] = useState(false);
  const [phase, setPhase] = useState("quiz");
  const [reviewScope, setReviewScope] = useState(null);
  const [answers, setAnswers] = useState(() => loadAnswers(slug));
  const lastPrefer = useRef(null);
  const sessionIdsRef = useRef([]);

  const refresh = useCallback(
    async (preferItemId = null) => {
      const r = await Learning.list(slug, { itemType: "flashcard", limit: 400 });
      if (r.error) {
        showToast(r.error, "error");
        setSessions([]);
        setSelectedId(null);
        setLoading(false);
        return [];
      }
      const grouped = groupLearningSessions(r.items || []);
      setSessions(grouped);

      const stored =
        preferItemId == null
          ? (() => {
              try {
                return sessionStorage.getItem(STORE_KEY(slug));
              } catch {
                return null;
              }
            })()
          : null;

      const prefer =
        preferItemId ?? lastPrefer.current ?? stored;
      lastPrefer.current = preferItemId ?? lastPrefer.current;

      setSelectedId((prev) => {
        if (preferItemId != null) {
          const hit = findSessionByItemId(grouped, preferItemId);
          if (hit) return hit.id;
        }
        if (prev && grouped.some((s) => s.id === prev)) return prev;
        if (prefer) {
          const byItem = findSessionByItemId(grouped, prefer);
          if (byItem) return byItem.id;
          if (grouped.some((s) => s.id === prefer)) return prefer;
        }
        return grouped[0]?.id || null;
      });
      setLoading(false);
      return grouped;
    },
    [slug]
  );

  useEffect(() => {
    setLoading(true);
    lastPrefer.current = null;
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    try {
      sessionStorage.setItem(STORE_KEY(slug), selectedId);
    } catch {
      /* ignore */
    }
  }, [slug, selectedId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ANSWERS_KEY(slug), JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [slug, answers]);

  useEffect(() => {
    setAnswers(loadAnswers(slug));
    setPhase("quiz");
    setReviewScope(null);
    setShowPlayerState(loadPlayerOpen("flashcard", slug));
  }, [slug]);

  const session = sessions.find((s) => s.id === selectedId) || null;
  const items = session?.items || [];
  const playItems =
    reviewScope === "wrong"
      ? items.filter((i) => {
          const a = answers[i.id] || answers[String(i.id)];
          return a?.submitted && !a?.correct;
        })
      : reviewScope === "answered"
        ? items.filter((i) => {
            const a = answers[i.id] || answers[String(i.id)];
            return a?.submitted;
          })
        : items;
  const current = playItems[index] || null;
  const viewSession =
    session && reviewScope ? { ...session, items: playItems } : session;

  const ratedOf = (id) => answers[id] || answers[String(id)];
  const countIds = sessionIdsRef.current.length
    ? sessionIdsRef.current
    : items.map((i) => String(i.id));
  const failCount = countIds.filter(
    (id) => ratedOf(id)?.submitted && !ratedOf(id)?.correct
  ).length;
  const passCount = countIds.filter(
    (id) => ratedOf(id)?.submitted && ratedOf(id)?.correct
  ).length;

  useEffect(() => {
    setIndex(0);
    setReviewScope(null);
    sessionIdsRef.current = (items || []).map((i) => String(i.id));
  }, [selectedId]);

  useEffect(() => {
    const ids = (items || []).map((i) => String(i.id));
    sessionIdsRef.current = [...new Set([...sessionIdsRef.current, ...ids])];
  }, [items]);

  useEffect(() => {
    if (index >= playItems.length && playItems.length > 0) {
      setIndex(playItems.length - 1);
    }
    if (playItems.length === 0) setIndex(0);
  }, [playItems.length, index]);

  useEffect(() => {
    const next = playItems[index + 1];
    if (!next?.id) return;
    Learning.ensureAnswer(slug, next.id).catch(() => {});
  }, [slug, index, playItems]);

  const selectSession = (s) => {
    setSelectedId(s?.id || null);
    setShowPlayer(true);
    setEnlarged(false);
    const done = (s?.items || []).every(
      (i) => answers[i.id]?.submitted || answers[String(i.id)]?.submitted
    );
    setReviewScope(null);
    setPhase(done && s?.items?.length ? "result" : "quiz");
  };

  const handleClearAll = async () => {
    const ids = sessions
      .flatMap((s) => (s.items || []).map((i) => i.id))
      .filter(Boolean);
    if (!ids.length) return;
    if (
      !window.confirm(
        `确定清除全部 ${sessions.length} 条历史？此操作不可恢复。`
      )
    )
      return;
    const result = await Learning.deleteMany(slug, ids);
    if (result.error) showToast(result.error, "error");
    else showToast("已清除全部历史", "success");
    setEnlarged(false);
    setShowPlayer(false);
    setSelectedId(null);
    await refresh();
  };

  const handleDeleteSession = async (s) => {
    const name = s.title || s.sourceLabel || "该记录";
    if (!window.confirm(`确定删除「${name}」？`)) return;
    const ids = (s.items || []).map((i) => i.id).filter(Boolean);
    if (!ids.length) return;
    if (selectedId === s.id) setEnlarged(false);
    const result = await Learning.deleteMany(slug, ids);
    if (result.error) showToast(result.error, "error");
    else showToast("已删除", "success");
    await refresh();
  };

  const handleRenameSession = async (s, name) => {
    const ids = (s.items || []).map((i) => i.id).filter(Boolean);
    if (!ids.length) return;
    setSessions((prev) =>
      prev.map((x) =>
        x.id === s.id
          ? {
              ...x,
              title: name,
              sessionTitle: name,
              items: (x.items || []).map((i) => ({ ...i, sessionTitle: name })),
            }
          : x
      )
    );
    const result = await Learning.rename(slug, ids, { sessionTitle: name });
    if (result.error) {
      showToast(result.error, "error");
      await refresh();
      return;
    }
    await refresh();
  };

  const onJobDone = useCallback(
    (job) => {
      setShowPlayer(true);
      setPhase("quiz");
      setReviewScope(null);
      setIndex(0);
      if (job.itemId) {
        lastPrefer.current = job.itemId;
        refresh(job.itemId);
      } else {
        refresh();
      }
    },
    [refresh]
  );
  useRefreshOnGenerateDone(slug, "cards", onJobDone);
  usePlayGenerated(slug, "cards", onJobDone);

  const handleGenerate = () => {
    if (!filePaths.length) {
      showToast("请先选择笔记（建议已完成索引）", "warning");
      return;
    }
    const r = startGenerateJob({
      slug,
      kind: "cards",
      filePaths,
      count,
    });
    if (r.error) showToast(r.error, "warning");
  };

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    if (index < playItems.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    setPhase("result");
  }, [index, playItems.length]);

  const onReviewed = useCallback(
    (rating, ratedId) => {
      const itemId = ratedId ?? current?.id;
      if (itemId == null) return;
      const key = String(itemId);
      const fail = rating === "again" || rating === "hard";
      const payload = {
        submitted: true,
        correct: !fail,
        kind: fail ? "fail" : "pass",
      };
      setAnswers((prev) => ({ ...prev, [key]: payload }));
      if (fail) Learning.moveToTrash(slug, itemId).catch(() => {});
      if (index >= playItems.length - 1) {
        setPhase("result");
        return;
      }
      setIndex((i) => i + 1);
    },
    [current?.id, index, playItems.length, slug]
  );

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
    setAnswers((prev) => {
      const next = { ...prev };
      for (const it of items) {
        delete next[it.id];
        delete next[String(it.id)];
      }
      return next;
    });
    setReviewScope(null);
    setIndex(0);
    setPhase("quiz");
  };

  const resultCopy = {
    title: "学习结果",
    statCorrect: "记得",
    statWrong: "不记得",
    statUnit: "张",
    reviewLabel: "回顾卡片",
    reviewWrongLabel: "回顾错题",
    retakeLabel: "重新学习",
  };

  return (
    <StudioShell
      title="学习卡片"
      description="根据所选笔记生成问答卡片；答案来自知识库检索。生成记录会保留在右侧，随时可继续翻阅。"
      requireDocs
      fillHeight
      budgetKind="cards"
      budgetCount={count}
    >
      <div className="h-full flex min-h-0 border-t border-theme-modal-border">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-theme-text-secondary">
              加载中…
            </div>
          ) : showPlayer && phase === "result" && items.length && !enlarged ? (
            <>
              <SessionPlayerBar
                session={session}
                index={index}
                onIndexChange={setIndex}
                unit=" 张"
                hidePager
                onEnlarge={() => setEnlarged(true)}
                onClose={() => {
                  setEnlarged(false);
                  setShowPlayer(false);
                }}
              />
              <div className="flex-1 min-h-0 overflow-hidden">
                <QuizResult
                  items={items}
                  answers={answers}
                  onReview={handleReview}
                  onReviewWrong={handleReviewWrong}
                  onRetake={handleRetake}
                  {...resultCopy}
                />
              </div>
            </>
          ) : showPlayer && current && !enlarged ? (
            <>
              <SessionPlayerBar
                session={viewSession}
                index={index}
                onIndexChange={setIndex}
                unit=" 张"
                onEnlarge={() => setEnlarged(true)}
                onClose={() => {
                  setEnlarged(false);
                  setShowPlayer(false);
                }}
              />
              <div className="flex-1 min-h-0">
                <FlashCard
                  item={current}
                  slug={slug}
                  onReviewed={onReviewed}
                  onPrev={goPrev}
                  onNext={goNext}
                  canPrev={index > 0}
                  canNext={index < playItems.length - 1 || playItems.length > 0}
                  failCount={failCount}
                  passCount={passCount}
                  answer={current?.id != null ? ratedOf(current.id) : null}
                />
              </div>
            </>
          ) : (
            <div className={generateStage}>
              <div className={generatePanel}>
                <div>
                  <label className={fieldLabel}>卡片数量</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) =>
                      setCount(
                        Math.min(50, Math.max(1, Number(e.target.value) || 12))
                      )
                    }
                    className={fieldControl}
                  />
                </div>
                <GenerateButton
                  loading={generating}
                  disabled={!filePaths.length}
                  onClick={handleGenerate}
                >
                  生成卡片
                </GenerateButton>
                {!filePaths.length && (
                  <p className="text-[10px] text-theme-text-secondary leading-relaxed">
                    请先在左侧文件树选择笔记
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <HistoryRail
          count={sessions.length}
          onClear={handleClearAll}
        >
          {loading ? (
            <p className="text-[11px] text-theme-text-secondary p-3">加载中…</p>
          ) : (
            <SessionHistoryList
              sessions={sessions}
              selectedId={selectedId}
              onSelect={selectSession}
              onDelete={handleDeleteSession}
              onRename={handleRenameSession}
              emptyIcon={Cards}
              itemIcon={Cards}
              emptyTitle="暂无已保存的卡片"
              emptyHint="选择笔记后点击「生成卡片」"
              unit=" 张"
            />
          )}
        </HistoryRail>
      </div>
      {enlarged && (phase === "result" ? items.length : current) ? (
        <EnlargedStage>
          <SessionPlayerBar
            session={phase === "result" ? session : viewSession}
            index={index}
            onIndexChange={setIndex}
            unit=" 张"
            enlarged
            hidePager={phase === "result"}
            onEnlarge={() => setEnlarged(false)}
          />
          <div className="flex-1 min-h-0">
            {phase === "result" ? (
              <QuizResult
                items={items}
                answers={answers}
                onReview={handleReview}
                onReviewWrong={handleReviewWrong}
                onRetake={handleRetake}
                center
                {...resultCopy}
              />
            ) : (
              <FlashCard
                item={current}
                slug={slug}
                onReviewed={onReviewed}
                onPrev={goPrev}
                onNext={goNext}
                canPrev={index > 0}
                canNext={index < playItems.length - 1 || playItems.length > 0}
                failCount={failCount}
                passCount={passCount}
                answer={current?.id != null ? ratedOf(current.id) : null}
              />
            )}
          </div>
        </EnlargedStage>
      ) : null}
    </StudioShell>
  );
}
