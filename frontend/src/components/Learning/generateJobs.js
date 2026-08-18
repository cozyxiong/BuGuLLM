import { useEffect, useState } from "react";
import Generate from "@/models/generate";
import paths from "@/utils/paths";

const KIND_META = {
  cards: {
    label: "卡片",
    section: "cards",
    store: (slug) => `bagullm.learn.session.${slug}.flashcard`,
  },
  quiz: {
    label: "测试",
    section: "quiz",
    store: (slug) => `bagullm.learn.session.${slug}.quiz`,
  },
  mindmap: {
    label: "导图",
    section: "mindmap",
    store: null,
  },
};

let jobs = [];
const listeners = new Set();

function emit() {
  const snapshot = jobs.slice();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeGenerateJobs(fn) {
  listeners.add(fn);
  fn(jobs.slice());
  return () => listeners.delete(fn);
}

export function getGenerateJobs() {
  return jobs.slice();
}

export function isKindGenerating(slug, kind) {
  return jobs.some(
    (j) => j.slug === slug && j.kind === kind && j.status === "running"
  );
}

export function dismissGenerateJob(id) {
  jobs = jobs.filter((j) => j.id !== id);
  emit();
}

export function startGenerateJob({
  slug,
  kind,
  filePaths,
  count,
  type,
}) {
  const meta = KIND_META[kind];
  if (!meta) return { error: "未知生成类型" };
  if (isKindGenerating(slug, kind)) {
    return { error: `${meta.label}正在生成中` };
  }

  const id = `${kind}-${Date.now()}`;
  const href = paths.workspace.learning(slug, meta.section);
  jobs = [
    ...jobs,
    {
      id,
      slug,
      kind,
      status: "running",
      href,
      label: meta.label,
    },
  ];
  emit();

  (async () => {
    try {
      let result;
      if (kind === "cards") {
        result = await Generate.generateFlashcards(slug, {
          filePaths,
          count,
          save: true,
        });
      } else if (kind === "quiz") {
        result = await Generate.generateQuiz(slug, {
          filePaths,
          count,
          type,
          save: true,
        });
      } else {
        result = await Generate.generateMindmap(slug, {
          filePaths,
          save: true,
        });
        const nodes =
          result.mindmap?.nodes || result.item?.content?.nodes || [];
        if (!result.error && !nodes.length) {
          throw new Error("导图已返回但没有节点，请重试一次。");
        }
      }
      if (result.error) throw new Error(result.error);

      const itemId =
        result.items?.[0]?.id || result.item?.id || null;
      if (itemId && meta.store) {
        try {
          sessionStorage.setItem(meta.store(slug), String(itemId));
        } catch {
          /* ignore */
        }
      }

      const got = result.count ?? (result.item ? 1 : 0);
      jobs = jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "done",
              itemId,
              count: got,
              requested: result.requested ?? count ?? got,
              truncated: !!result.truncated || (got > 0 && count && got < count),
            }
          : j
      );
      emit();
    } catch (e) {
      jobs = jobs.map((j) =>
        j.id === id
          ? { ...j, status: "error", error: e.message || "生成失败" }
          : j
      );
      emit();
    }
  })();

  return { id };
}

export function useGenerateKind(slug, kind) {
  const [running, setRunning] = useState(() =>
    isKindGenerating(slug, kind)
  );
  useEffect(() => {
    return subscribeGenerateJobs((list) => {
      setRunning(
        list.some(
          (j) => j.slug === slug && j.kind === kind && j.status === "running"
        )
      );
    });
  }, [slug, kind]);
  return running;
}

/** 当前页在生成完成时刷新列表 */
export function useRefreshOnGenerateDone(slug, kind, onDone) {
  useEffect(() => {
    const seen = new Set();
    return subscribeGenerateJobs((list) => {
      for (const j of list) {
        if (
          j.slug === slug &&
          j.kind === kind &&
          (j.status === "done" || j.status === "error") &&
          !seen.has(j.id)
        ) {
          seen.add(j.id);
          if (j.status === "done") onDone?.(j);
        }
      }
    });
  }, [slug, kind, onDone]);
}
