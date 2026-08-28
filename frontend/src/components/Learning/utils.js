/** Flatten library tree to markdown files */
export function flattenLibraryFiles(tree, acc = []) {
  if (!tree) return acc;

  // root node itself may be a file (rare) or folder with items
  if (tree.type === "file") {
    const ext = (tree.extension || "").toLowerCase();
    const p = tree.path || "";
    if (
      ext === ".md" ||
      ext === ".markdown" ||
      ext === ".txt" ||
      p.endsWith(".md") ||
      p.endsWith(".markdown")
    ) {
      acc.push({
        path: p,
        name: tree.name || p.split("/").pop(),
        size: tree.size,
        updatedAt: tree.updatedAt,
      });
    }
    return acc;
  }

  const items = tree.items || tree.children || (Array.isArray(tree) ? tree : []);
  for (const node of items) {
    flattenLibraryFiles(node, acc);
  }
  return acc;
}

export function parseItemContent(item) {
  if (!item) return {};
  if (item.content && typeof item.content === "object") return item.content;
  if (typeof item.content === "string") {
    try {
      return JSON.parse(item.content);
    } catch {
      return { raw: item.content };
    }
  }
  return {};
}

/** Normalize learning item for UI components */
export function normalizeLearningItem(item) {
  if (!item) return null;
  const c = parseItemContent(item);
  const itemType = item.itemType || item.type || "";

  const sessionTitle = String(c.sessionTitle || item.sessionTitle || "").trim();

  if (itemType === "flashcard") {
    const sources = Array.isArray(c.sources)
      ? c.sources
      : Array.isArray(item.sources)
        ? item.sources
        : [];
    return {
      ...item,
      itemType,
      type: "flashcard",
      front: c.front || c.question || item.title || "",
      back: c.back || c.answer || "",
      tags: c.tags || [],
      difficulty: c.difficulty || "",
      role: c.role || "",
      company: c.company || "",
      sources,
      answerMode: c.answerMode || (sources.length ? "rag" : "llm"),
      answerStatus: c.answerStatus || (c.back ? "ready" : "pending"),
      sourcePaths: c.sourcePaths || item.sourcePaths || [],
      sourceNames: c.sourceNames || item.sourceNames || [],
      sessionTitle,
    };
  }

  if (itemType === "quiz_single" || itemType === "quiz_multi" || itemType === "quiz") {
    const multi =
      itemType === "quiz_multi" ||
      c.multi === true ||
      Array.isArray(c.correctIndices);
    return {
      ...item,
      itemType,
      type: "quiz",
      multiChoice: multi,
      multi,
      question: c.question || item.title || "",
      options: c.options || [],
      correctIndex: c.correctIndex ?? 0,
      correctIndices: c.correctIndices || (typeof c.correctIndex === "number" ? [c.correctIndex] : []),
      explanation: c.explanation || "",
      difficulty: c.difficulty || "",
      role: c.role || "",
      tags: Array.isArray(c.tags) ? c.tags : [],
      sourcePaths: c.sourcePaths || item.sourcePaths || [],
      sourceNames: c.sourceNames || item.sourceNames || [],
      sessionTitle,
    };
  }

  if (itemType === "mindmap") {
    let nodes = [];
    if (Array.isArray(c.nodes)) nodes = c.nodes;
    else if (Array.isArray(c)) nodes = c;
    else if (c && (c.text || c.label || c.children)) nodes = [c];
    // content 已在 item 顶层展开的情况
    else if (Array.isArray(item.nodes)) nodes = item.nodes;

    return {
      ...item,
      itemType,
      type: "mindmap",
      nodes,
      sourcePaths: c.sourcePaths || item.sourcePaths || [],
      sourceNames: c.sourceNames || item.sourceNames || [],
      sessionTitle,
    };
  }

  return { ...item, itemType, type: itemType, sessionTitle, ...c };
}

const SESSION_GAP_MS = 20000;

/** 今天 / 昨天 / M月D日 HH:mm */
export function formatSessionTime(ts) {
  if (ts == null) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const startOf = (x) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (dayDiff === 0) return `今天 ${hm}`;
  if (dayDiff === 1) return `昨天 ${hm}`;
  if (d.getFullYear() === new Date().getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

function fileNameFromPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop();
}

function normPath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

/** 学习项是否来自当前选中的资料（含文件夹前缀） */
export function itemMatchesSourcePaths(item, selectedPaths = []) {
  const wanted = (selectedPaths || []).map(normPath).filter(Boolean);
  if (!wanted.length) return true;
  const c = parseItemContent(item);
  const sources = (c.sourcePaths || item.sourcePaths || []).map(normPath);
  if (!sources.length) return false;
  return sources.some((src) =>
    wanted.some((sel) => src === sel || src.startsWith(sel + "/") || sel.startsWith(src + "/"))
  );
}

export function sessionSourceLabel(items = []) {
  const names = [];
  const seen = new Set();
  for (const it of items) {
    const fromNames = Array.isArray(it.sourceNames) ? it.sourceNames : [];
    const fromPaths = (it.sourcePaths || []).map(fileNameFromPath);
    const list = fromNames.length ? fromNames : fromPaths;
    for (const name of list) {
      const label = String(name || "").trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      names.push(label);
    }
  }
  if (!names.length) return "未命名资料";
  if (names.length <= 2) return names.join("、");
  return `${names.slice(0, 2).join("、")} 等${names.length}项`;
}

function sessionTypeKey(item) {
  if (!item) return "";
  if (item.itemType === "quiz_multi" || item.multi) return "quiz_multi";
  if (item.itemType === "quiz_single" || item.type === "quiz")
    return "quiz_single";
  return item.itemType || item.type || "";
}

/**
 * 将逐条保存的卡片/试题按生成批次归组（时间接近 + 同源 + 同类型）
 */
export function groupLearningSessions(rawItems, { gapMs = SESSION_GAP_MS } = {}) {
  const items = (rawItems || []).map(normalizeLearningItem).filter(Boolean);
  const sorted = [...items].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });

  const sessions = [];
  for (const item of sorted) {
    const t = new Date(item.createdAt || 0).getTime();
    const pathsKey = [...(item.sourcePaths || [])]
      .map(String)
      .sort()
      .join("|");
    const typeKey = sessionTypeKey(item);
    const last = sessions[sessions.length - 1];
    if (
      last &&
      Number.isFinite(t) &&
      t - last.endAt <= gapMs &&
      last.pathsKey === pathsKey &&
      last.typeKey === typeKey
    ) {
      last.items.push(item);
      last.endAt = t;
    } else {
      sessions.push({
        id: `s-${item.id}`,
        items: [item],
        startAt: t,
        endAt: t,
        pathsKey,
        typeKey,
      });
    }
  }

  return sessions.reverse().map((s) => {
    const sourceLabel = sessionSourceLabel(s.items);
    const sessionTitle = (
      s.items.find((i) => String(i.sessionTitle || "").trim())?.sessionTitle ||
      ""
    ).trim();
    return {
      ...s,
      sourceLabel,
      sessionTitle,
      title: sessionTitle || sourceLabel,
      timeLabel: formatSessionTime(s.endAt || s.startAt),
      quizTypeLabel:
        s.typeKey === "quiz_multi"
          ? "多选"
          : s.typeKey === "quiz_single"
            ? "单选"
            : "",
    };
  });
}

export function findSessionByItemId(sessions, itemId) {
  if (itemId == null) return null;
  return sessions.find((s) => s.items.some((i) => i.id === itemId)) || null;
}
