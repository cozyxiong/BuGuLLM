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
import Quiz from "../Quiz";
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
import { Question } from "@phosphor-icons/react";
import GenerateButton from "./GenerateButton";
import { fieldLabel, fieldControl, generateStage, generatePanel } from "./formStyles";
import { loadPlayerOpen, savePlayerOpen } from "./playerPref";

const STORE_KEY = (slug) => `bagullm.learn.session.${slug}.quiz`;
const ANSWERS_KEY = (slug) => `bagullm.learn.quiz.answers.${slug}`;

function loadAnswers(slug) {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY(slug));
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export default function QuizStudio() {
  const { slug } = useParams();
  const filePaths = useActiveFilePaths();
  const [count, setCount] = useState(10);
  const [type, setType] = useState("single");
  const generating = useGenerateKind(slug, "quiz");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [index, setIndex] = useState(0);
  const [showPlayer, setShowPlayerState] = useState(() =>
    loadPlayerOpen("quiz", slug)
  );
  const setShowPlayer = useCallback(
    (open) => {
      setShowPlayerState(open);
      savePlayerOpen("quiz", slug, open);
    },
    [slug]
  );
  const [enlarged, setEnlarged] = useState(false);
  const [phase, setPhase] = useState("quiz");
  const [reviewScope, setReviewScope] = useState(null);
  const [answers, setAnswers] = useState(() => loadAnswers(slug));
  const lastPrefer = useRef(null);

  const refresh = useCallback(
    async (preferItemId = null) => {
      const r = await Learning.list(slug, { itemType: "quiz", limit: 400 });
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

      const prefer = preferItemId ?? lastPrefer.current ?? stored;
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
    setAnswers(loadAnswers(slug));
    setPhase("quiz");
    setReviewScope(null);
    setShowPlayerState(loadPlayerOpen("quiz", slug));
  }, [slug]);

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

  const session = sessions.find((s) => s.id === selectedId) || null;
  const items = session?.items || [];
  const playItems =
    reviewScope === "wrong"
      ? items.filter(
          (i) => answers[i.id]?.submitted && !answers[i.id]?.correct
        )
      : reviewScope === "answered"
        ? items.filter((i) => answers[i.id]?.submitted)
        : items;
  const current = playItems[index] || null;
  const viewSession =
    session && reviewScope ? { ...session, items: playItems } : session;

  useEffect(() => {
    setIndex(0);
    setReviewScope(null);
  }, [selectedId]);

  const allSubmitted =
    items.length > 0 && items.every((i) => answers[i.id]?.submitted);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    if (index < playItems.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    if (allSubmitted) setPhase("result");
  }, [index, playItems.length, allSubmitted]);

  const handleSubmitAnswer = useCallback(
    (payload) => {
      if (payload?.itemId == null) return;
      setAnswers((prev) => {
        const next = { ...prev, [payload.itemId]: payload };
        const done = items.every((i) =>
          i.id === payload.itemId ? payload.submitted : next[i.id]?.submitted
        );
        if (done) setPhase("result");
        return next;
      });
    },
    [items]
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
      for (const it of items) delete next[it.id];
      return next;
    });
    setReviewScope(null);
    setIndex(0);
    setPhase("quiz");
  };

  useEffect(() => {
    if (index >= playItems.length && playItems.length > 0) {
      setIndex(playItems.length - 1);
    }
    if (playItems.length === 0) setIndex(0);
  }, [playItems.length, index]);

  const selectSession = (s) => {
    setSelectedId(s?.id || null);
    setShowPlayer(true);
    setEnlarged(false);
    const done = (s?.items || []).every((i) => answers[i.id]?.submitted);
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
  useRefreshOnGenerateDone(slug, "quiz", onJobDone);
  usePlayGenerated(slug, "quiz", onJobDone);

  const handleGenerate = () => {
    if (!filePaths.length) {
      showToast("请先选择笔记", "warning");
      return;
    }
    const r = startGenerateJob({
      slug,
      kind: "quiz",
      filePaths,
      count,
      type,
    });
    if (r.error) showToast(r.error, "warning");
  };

  const onQuizAnswered = useCallback(
    async (action) => {
      if (action === "trash") {
        const leavingId = current?.id;
        const nextId = items[index + 1]?.id;
        const grouped = await refresh();
        const nextSess =
          (nextId && findSessionByItemId(grouped, nextId)) ||
          grouped.find((s) => s.id === selectedId) ||
          grouped[0] ||
          null;
        setSelectedId(nextSess?.id || null);
        if (nextSess && leavingId) {
          const pos = nextSess.items.findIndex((i) => i.id === nextId);
          setIndex(pos >= 0 ? pos : 0);
        } else {
          setIndex(0);
        }
        return;
      }
      if (index < items.length - 1) setIndex((i) => i + 1);
    },
    [current?.id, index, items, refresh, selectedId]
  );

  return (
    <StudioShell
      title="测试"
      description="根据所选笔记生成单选或多选试题。"
      requireDocs
      fillHeight
      budgetKind="quiz"
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
                unit=" 道"
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
                />
              </div>
            </>
          ) : showPlayer && current && !enlarged ? (
            <>
              <SessionPlayerBar
                session={viewSession}
                index={index}
                onIndexChange={setIndex}
                unit=" 道"
                onEnlarge={() => setEnlarged(true)}
                onClose={() => {
                  setEnlarged(false);
                  setShowPlayer(false);
                }}
              />
              <div className="flex-1 min-h-0 overflow-hidden">
                <Quiz
                  item={current}
                  slug={slug}
                  onAnswered={onQuizAnswered}
                  onPrev={goPrev}
                  onNext={goNext}
                  canPrev={index > 0}
                  canNext={index < playItems.length - 1 || allSubmitted}
                  answer={current?.id != null ? answers[current.id] : null}
                  onSubmit={handleSubmitAnswer}
                />
              </div>
            </>
          ) : (
            <div className={generateStage}>
              <div className={generatePanel}>
                <div>
                  <label className={fieldLabel}>题量</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={count}
                    onChange={(e) =>
                      setCount(
                        Math.min(30, Math.max(1, Number(e.target.value) || 10))
                      )
                    }
                    className={fieldControl}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>题型</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={fieldControl}
                  >
                    <option value="single">单选</option>
                    <option value="multi">多选</option>
                  </select>
                </div>
                <GenerateButton
                  loading={generating}
                  disabled={!filePaths.length}
                  onClick={handleGenerate}
                >
                  生成测试
                </GenerateButton>
              </div>
            </div>
          )}
        </div>

        <HistoryRail count={sessions.length} onClear={handleClearAll}>
          {loading ? (
            <p className="text-[11px] text-theme-text-secondary p-3">加载中…</p>
          ) : (
            <SessionHistoryList
              sessions={sessions}
              selectedId={selectedId}
              onSelect={selectSession}
              onDelete={handleDeleteSession}
              onRename={handleRenameSession}
              emptyIcon={Question}
              itemIcon={Question}
              emptyTitle="暂无已保存的测试"
              emptyHint="选择笔记后点击「生成测试」"
              unit=" 道"
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
            unit=" 道"
            enlarged
            hidePager={phase === "result"}
            onEnlarge={() => setEnlarged(false)}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            {phase === "result" ? (
              <QuizResult
                items={items}
                answers={answers}
                onReview={handleReview}
                onReviewWrong={handleReviewWrong}
                onRetake={handleRetake}
                center
              />
            ) : (
              <Quiz
                item={current}
                slug={slug}
                onAnswered={onQuizAnswered}
                onPrev={goPrev}
                onNext={goNext}
                canPrev={index > 0}
                canNext={index < playItems.length - 1 || allSubmitted}
                center
                answer={current?.id != null ? answers[current.id] : null}
                onSubmit={handleSubmitAnswer}
              />
            )}
          </div>
        </EnlargedStage>
      ) : null}
    </StudioShell>
  );
}
