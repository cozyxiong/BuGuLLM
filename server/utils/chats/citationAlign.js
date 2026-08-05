/**
 * 引用对齐 — n-gram 快路径
 *
 * 答案多 claim 并集 + n-gram 小节/块定位 + 覆盖率/多节 → 整段
 * 约束：永远只在 sources[n-1] 闭包内对齐，不做全库关键字加权。
 */

function stripDocumentMeta(text = "") {
  const s = String(text || "");
  if (s.includes("<document_metadata>") && s.includes("</document_metadata>")) {
    return s
      .split("</document_metadata>")
      .slice(1)
      .join("</document_metadata>")
      .trim();
  }
  return s.trim();
}

function stripThink(text = "") {
  let s = String(text || "");
  // 完整 think 块
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  // 未闭合的 think（推理模型常见：整段都在 think 里）
  s = s.replace(/<think>[\s\S]*$/gi, "");
  s = s.replace(/<thinking>[\s\S]*$/gi, "");
  s = s.replace(/<\/?think>/gi, "");
  s = s.replace(/<\/?thinking>/gi, "");
  return s.trim();
}

function ngramScore(a, b) {
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
  const A = norm(a);
  const B = norm(b);
  if (A.length < 4 || B.length < 4) return 0;
  const n = 3;
  const setA = new Set();
  for (let i = 0; i + n <= A.length; i++) setA.add(A.slice(i, i + n));
  let hit = 0,
    sizeB = 0;
  for (let i = 0; i + n <= B.length; i++) {
    sizeB++;
    if (setA.has(B.slice(i, i + n))) hit++;
  }
  return hit / Math.max(1, Math.sqrt(setA.size * sizeB));
}

/** 去掉 markdown 装饰后的标题纯文本 */
function plainHeading(h) {
  return String(h || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * claim × 小节 综合分：正文 n-gram + 标题命中加权
 * （避免「Embedding/模型」等高频词把 claim 拖到错误长节）
 */
function scoreClaimAgainstSection(claim, sec) {
  const body = String(sec?.text || "");
  const head = plainHeading(sec?.heading);
  const bodySc = ngramScore(claim, body);
  const headSc = head.length >= 2 ? ngramScore(claim, head) : 0;

  const claimN = String(claim || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  let headBoost = 0;
  if (head.length >= 4) {
    // 标题前 4～8 字出现在 claim 中（如「国产开源」「海外商用」）
    for (const len of [8, 6, 4]) {
      if (head.length >= len && claimN.includes(head.slice(0, len))) {
        headBoost = 0.22;
        break;
      }
    }
    // 标题关键词片段（去数字）
    const key = head.replace(/[\d.．、]/g, "");
    if (!headBoost && key.length >= 4 && claimN.includes(key.slice(0, 4))) {
      headBoost = 0.16;
    }
  }

  // 标题信号权重大于正文泛化匹配
  return bodySc * 0.55 + headSc * 0.9 + headBoost;
}

// ───────── claim ─────────

function extractClaimsWithCitations(answerText = "") {
  const raw = stripThink(answerText);
  if (!raw) return [];
  const claims = [];
  const re = /\[(\d{1,3})\]/g;
  let m;
  const isList = (l) => /^\s*([-*+]|\d+[\.、)）])\s+/.test(l || "");
  const clean = (l) =>
    String(l || "")
      .replace(/\[\d{1,3}\]/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();

  while ((m = re.exec(raw)) !== null) {
    const citeNum = parseInt(m[1], 10);
    if (!Number.isFinite(citeNum) || citeNum < 1) continue;
    const idx = m.index;
    const lines = raw.split("\n");
    let pos = 0;
    let lineIdx = 0;
    let lineStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const next = pos + lines[i].length + 1;
      if (idx < next) {
        lineIdx = i;
        lineStart = pos;
        break;
      }
      pos = next;
    }

    const line = lines[lineIdx] || "";
    const offsetInLine = Math.max(0, idx - lineStart);

    // 同一行多个 [n]：只取「上一角标之后 → 本角标」这一段，避免整行并成一条 claim
    const citesOnLine = [];
    const lineCiteRe = /\[(\d{1,3})\]/g;
    let lm;
    while ((lm = lineCiteRe.exec(line)) !== null) {
      citesOnLine.push({
        num: parseInt(lm[1], 10),
        index: lm.index,
        end: lm.index + lm[0].length,
      });
    }
    const curI = citesOnLine.findIndex(
      (c) => c.index === offsetInLine || Math.abs(c.index - offsetInLine) <= 1
    );
    let segStart = 0;
    let segEnd = line.length;
    if (curI >= 0) {
      if (curI > 0) segStart = citesOnLine[curI - 1].end;
      // 本角标所在句：尽量到句号/分号，避免吃掉下一句
      const afterCite = citesOnLine[curI].end;
      const tail = line.slice(afterCite);
      const sentEndRel = tail.search(/[。！？；;\n]/);
      if (sentEndRel >= 0) segEnd = afterCite + sentEndRel + 1;
      else if (curI < citesOnLine.length - 1) segEnd = citesOnLine[curI + 1].index;
    }

    let claim = clean(line.slice(segStart, segEnd));

    // 列表续行（仅当本行只有一个该角标、或 claim 过短时）
    if (claim.length < 24 || citesOnLine.filter((c) => c.num === citeNum).length <= 1) {
      const parts = [claim];
      let j = lineIdx + 1;
      if (j < lines.length && !lines[j].trim()) j++;
      while (j < lines.length) {
        const l = lines[j];
        if (!l.trim()) {
          if (j + 1 < lines.length && isList(lines[j + 1])) {
            j++;
            continue;
          }
          break;
        }
        if (isList(l) || l.includes(`[${citeNum}]`)) {
          // 续行若自带其它角标，截到该角标前
          const other = l.search(/\[\d{1,3}\]/);
          const piece = other > 0 ? l.slice(0, other) : l;
          parts.push(clean(piece));
          if (other >= 0) break;
          j++;
          continue;
        }
        break;
      }
      claim = parts.filter(Boolean).join("\n");
    }

    if (claim.length < 10) {
      claim = clean(raw.slice(Math.max(0, idx - 200), idx));
    }
    if (claim.length >= 6)
      claims.push({ citeNum, claim: claim.slice(0, 900), at: idx });
  }
  const seen = new Set();
  return claims.filter((c) => {
    const k = `${c.citeNum}:${c.claim.slice(0, 100)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ───────── 文档结构 ─────────

const BOLD_HEADING_RE = /^\*\*[^*].{0,78}\*\*\s*$/;

function isHeadingLine(line) {
  const t = (line || "").trim();
  if (/^#{1,6}\s+\S/.test(t)) return true;
  if (/^#{1,6}\s+\*\*.+\*\*/.test(t)) return true;
  if (BOLD_HEADING_RE.test(t)) return true;
  return false;
}

function headingLevel(line) {
  const t = (line || "").trim();
  const m = t.match(/^(#{1,6})\s+/);
  if (m) return m[1].length;
  return 2;
}

function parseDocumentStructure(doc) {
  const text = String(doc || "");
  const lines = text.split("\n");
  const lineOffsets = [];
  let off = 0;
  for (const line of lines) {
    lineOffsets.push(off);
    off += line.length + 1;
  }

  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const start = lineOffsets[i];

    if (/^\s*```/.test(line)) {
      let j = i + 1;
      while (j < lines.length && !/^\s*```/.test(lines[j])) j++;
      if (j < lines.length) j++;
      const endLine = Math.min(j - 1, lines.length - 1);
      const rawSlice = text.slice(start, lineOffsets[endLine] + lines[endLine].length);
      const trimmed = rawSlice.trim();
      const rel = rawSlice.indexOf(trimmed);
      const bStart = start + Math.max(0, rel);
      blocks.push({ type: "code", text: trimmed, start: bStart, end: bStart + trimmed.length });
      i = j;
      continue;
    }

    if (isHeadingLine(line)) {
      const t = line.trim();
      blocks.push({
        type: "heading",
        text: t,
        level: headingLevel(line),
        start,
        end: start + line.length,
      });
      i++;
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^\s*([-*+]|\d+[.)、])\s+/.test(line)) {
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j];
        if (!l.trim()) break;
        if (isHeadingLine(l) || /^\s*```/.test(l)) break;
        if (/^\s*([-*+]|\d+[.)、])\s+/.test(l) && !/^\s{2,}/.test(l)) break;
        if (/^\s{2,}\S/.test(l) || /^\s{2,}([-*+]|\d+[.)、])\s+/.test(l)) {
          j++;
          continue;
        }
        break;
      }
      const endLine = j - 1;
      const rawSlice = text.slice(start, lineOffsets[endLine] + lines[endLine].length);
      const trimmed = rawSlice.trim();
      const rel = rawSlice.indexOf(trimmed);
      const bStart = start + Math.max(0, rel);
      blocks.push({
        type: "list-item",
        text: trimmed,
        start: bStart,
        end: bStart + trimmed.length,
      });
      i = j;
      continue;
    }

    let j = i + 1;
    while (
      j < lines.length &&
      lines[j].trim() &&
      !isHeadingLine(lines[j]) &&
      !/^\s*```/.test(lines[j]) &&
      !/^\s*([-*+]|\d+[.)、])\s+/.test(lines[j])
    ) {
      j++;
    }
    const endLine = j - 1;
    const rawSlice = text.slice(start, lineOffsets[endLine] + lines[endLine].length);
    const trimmed = rawSlice.trim();
    const rel = rawSlice.indexOf(trimmed);
    const bStart = start + Math.max(0, rel);
    blocks.push({
      type: "paragraph",
      text: trimmed,
      start: bStart,
      end: bStart + trimmed.length,
    });
    i = j;
  }

  const sections = [];
  let cur = { heading: null, headingLevel: 99, blocks: [] };
  const flush = () => {
    const content = cur.blocks.filter((b) => b.type !== "heading");
    const all = cur.heading ? [cur.heading, ...content] : content;
    if (!all.length) return;
    sections.push({
      heading: cur.heading?.text || null,
      headingLevel: cur.headingLevel,
      blocks: content,
      start: all[0].start,
      end: all[all.length - 1].end,
      text: text.slice(all[0].start, all[all.length - 1].end).trim(),
    });
  };

  for (const b of blocks) {
    if (b.type === "heading" && b.level <= 3) {
      flush();
      cur = { heading: b, headingLevel: b.level, blocks: [] };
      continue;
    }
    cur.blocks.push(b);
  }
  flush();

  if (!sections.length) {
    const content = blocks.filter((b) => b.type !== "heading");
    sections.push({
      heading: null,
      headingLevel: 99,
      blocks: content,
      start: 0,
      end: text.length,
      text: text.trim(),
    });
  }

  return { text, blocks, sections };
}

function expandRangeToBlocks(doc, range, blocks, sections) {
  // 找到覆盖 range 的 blocks，扩展为连续块；再取所属 section
  const contentBlocks = blocks.filter((b) =>
    ["paragraph", "list-item", "code"].includes(b.type)
  );
  const hit = contentBlocks.filter(
    (b) => !(b.end <= range.start || b.start >= range.end)
  );
  let from = range.start;
  let to = range.end;
  if (hit.length) {
    from = Math.min(...hit.map((b) => b.start));
    to = Math.max(...hit.map((b) => b.end));
  }

  // 所属 section
  let section = sections.find((s) => from >= s.start && from < s.end) || null;
  if (!section) {
    section = sections.find((s) => s.start <= from && s.end >= to) || sections[0];
  }

  // 若命中多个块或 quote 很长 → 用整节（标题+正文）
  const useFullSection =
    hit.length >= 2 ||
    range.end - range.start > 100 ||
    (section && section.blocks.length <= 8);

  let passStart;
  let passEnd;
  let highlights;

  if (useFullSection && section) {
    passStart = section.start;
    passEnd = section.end;
    // 高亮：从第一个 hit 到最后一个 hit；若 hit 覆盖大半节则正文全高亮
    if (hit.length) {
      const hStart = Math.min(...hit.map((b) => b.start)) - passStart;
      const hEnd = Math.max(...hit.map((b) => b.end)) - passStart;
      const cover = hEnd - hStart;
      const bodyLen = passEnd - passStart;
      if (hit.length >= Math.ceil(section.blocks.length * 0.4) || cover / bodyLen > 0.4) {
        // 跳过标题行
        const passage = doc.slice(passStart, passEnd);
        const firstLine = passage.split("\n")[0] || "";
        let bodyStart = 0;
        if (isHeadingLine(firstLine)) bodyStart = firstLine.length + 1;
        highlights = [{ start: bodyStart, end: passage.trimEnd().length }];
      } else {
        highlights = [
          {
            start: Math.max(0, hStart),
            end: Math.max(0, hEnd),
          },
        ];
      }
    } else {
      const passage = doc.slice(passStart, passEnd);
      const firstLine = passage.split("\n")[0] || "";
      let bodyStart = 0;
      if (isHeadingLine(firstLine)) bodyStart = firstLine.length + 1;
      highlights = [{ start: bodyStart, end: Math.max(bodyStart + 1, passage.length) }];
    }
  } else {
    // 单块：带上最近标题
    const headingBlock = [...blocks]
      .reverse()
      .find((b) => b.type === "heading" && b.start <= from);
    passStart = headingBlock ? headingBlock.start : from;
    passEnd = to;
    highlights = [
      {
        start: from - passStart,
        end: to - passStart,
      },
    ];
  }

  let passage = doc.slice(passStart, passEnd).trim();
  // 最小长度：避免只有标题
  if (passage.length < 60 && section && section.text.length > passage.length) {
    passStart = section.start;
    passEnd = section.end;
    passage = doc.slice(passStart, passEnd).trim();
    const firstLine = passage.split("\n")[0] || "";
    let bodyStart = 0;
    if (isHeadingLine(firstLine)) bodyStart = firstLine.length + 1;
    highlights = [{ start: bodyStart, end: passage.length }];
  }

  return {
    alignedPassage: passage,
    alignedHeading: section?.heading || null,
    highlights,
    text: passage,
    surroundingText: passage,
    passageStart: passStart,
  };
}

/**
 * 多 claim / 多 quote 区间 → 并集 → 适度结构扩展。
 *
 * 规则（偏精炼，避免动辄整段）：
 * - 默认展示并集块（可带所属节标题行）
 * - 命中 ≥2 个「有正文」的小节 → 并集扩到这些节（不是整篇 source）
 * - 仅当并集已覆盖全文 ≥75% 才回退整篇 source
 * - 单节内仅当覆盖该节 ≥70% 才扩成整节
 *
 * @param {string} doc
 * @param {{start:number,end:number}[]} ranges
 * @param {object[]} blocks
 * @param {object[]} sections
 * @param {{ score?: number, method?: string, unsupported?: string[] }} opts
 */
function finalizeAlignedFromRanges(doc, ranges, blocks, sections, opts = {}) {
  const method = opts.method || "union";
  const score = typeof opts.score === "number" ? opts.score : 0;
  if (!doc || !ranges?.length) return null;

  const cleaned = ranges
    .map((r) => ({
      start: Math.max(0, Number(r.start) || 0),
      end: Math.min(doc.length, Number(r.end) || 0),
    }))
    .filter((r) => r.end > r.start);
  if (!cleaned.length) return null;

  const union = {
    start: Math.min(...cleaned.map((r) => r.start)),
    end: Math.max(...cleaned.map((r) => r.end)),
  };

  const contentBlocks = (blocks || []).filter((b) =>
    ["paragraph", "list-item", "code"].includes(b.type)
  );

  /** 有实质正文的小节才参与「多节」判定（忽略空壳标题节） */
  const substantial = (s) => {
    const body = String(s?.text || "")
      .replace(/^#{1,6}\s+.+$/m, "")
      .replace(/^\*\*[^*].+\*\*\s*$/m, "")
      .replace(/\s+/g, "")
      .length;
    return body >= 24;
  };

  /** @type {Set<number>} */
  const sectionIdxs = new Set();
  for (const r of cleaned) {
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!substantial(s)) continue;
      // 区间与节有实质重叠（不只是擦到边界）
      const overlap = Math.min(r.end, s.end) - Math.max(r.start, s.start);
      if (overlap >= 12) sectionIdxs.add(i);
    }
  }

  const docLen = Math.max(1, doc.replace(/\s+$/u, "").length);
  const coverRatio = (union.end - union.start) / docLen;
  const COVER_FULL_DOC = 0.75;
  const useFullDoc = coverRatio >= COVER_FULL_DOC;

  let passStart;
  let passEnd;
  let alignedHeading = null;

  if (useFullDoc) {
    passStart = 0;
    passEnd = doc.length;
    if (sectionIdxs.size) {
      alignedHeading = sections[Math.min(...sectionIdxs)]?.heading || null;
    } else {
      alignedHeading = sections[0]?.heading || null;
    }
  } else if (sectionIdxs.size >= 2) {
    // 多节：只并「命中的节」，不扩成整篇 source
    const hitSecs = [...sectionIdxs].map((i) => sections[i]).filter(Boolean);
    passStart = Math.min(...hitSecs.map((s) => s.start));
    passEnd = Math.max(...hitSecs.map((s) => s.end));
    alignedHeading = hitSecs[0]?.heading || null;
  } else if (sectionIdxs.size === 1) {
    const si = [...sectionIdxs][0];
    const sec = sections[si];
    alignedHeading = sec.heading;
    const secLen = Math.max(1, sec.end - sec.start);
    const overlap =
      Math.min(union.end, sec.end) - Math.max(union.start, sec.start);
    const secCover = overlap / secLen;
    const hit = contentBlocks.filter(
      (b) =>
        b.start >= sec.start &&
        b.end <= sec.end &&
        !(b.end <= union.start || b.start >= union.end)
    );

    // 仅高覆盖才整节；否则块并集 + 必要时带上节标题行
    if (secCover >= 0.7) {
      passStart = sec.start;
      passEnd = sec.end;
    } else if (hit.length) {
      passStart = Math.min(...hit.map((b) => b.start));
      passEnd = Math.max(...hit.map((b) => b.end));
      // 标题行单独并入（不把中间未命中列表整段拉进来）
      if (sec.heading && sec.start < passStart) {
        const headEnd = Math.min(
          passStart,
          sec.start + String(sec.heading).length + 2
        );
        // 若 heading 在 doc 中紧挨节起点
        const headSlice = doc.slice(sec.start, Math.min(sec.end, sec.start + 120));
        if (isHeadingLine(headSlice.split("\n")[0] || "")) {
          passStart = sec.start;
        }
      }
    } else {
      passStart = Math.max(sec.start, union.start);
      passEnd = Math.min(sec.end, union.end);
    }
  } else {
    const hit = contentBlocks.filter(
      (b) => !(b.end <= union.start || b.start >= union.end)
    );
    if (hit.length) {
      passStart = Math.min(...hit.map((b) => b.start));
      passEnd = Math.max(...hit.map((b) => b.end));
      const headingBlock = [...(blocks || [])]
        .reverse()
        .find((b) => b.type === "heading" && b.start <= passStart);
      if (headingBlock && passStart - headingBlock.start < 200) {
        passStart = headingBlock.start;
        alignedHeading = headingBlock.text;
      }
    } else {
      passStart = union.start;
      passEnd = union.end;
    }
  }

  passStart = Math.max(0, passStart);
  passEnd = Math.min(doc.length, Math.max(passStart, passEnd));

  let slice = doc.slice(passStart, passEnd);
  const lead = (slice.match(/^\s*/) || [""])[0].length;
  const trail = (slice.match(/\s*$/) || [""])[0].length;
  passStart += lead;
  passEnd = Math.max(passStart, passEnd - trail);
  const passage = doc.slice(passStart, passEnd);

  // 展示侧不再依赖高亮区间；保留最小 highlights 兼容
  const firstLine = passage.split("\n")[0] || "";
  let bodyStart = 0;
  if (isHeadingLine(firstLine)) {
    bodyStart = Math.min(passage.length, firstLine.length + 1);
  }
  const highlights = [{ start: bodyStart, end: passage.length }];

  return {
    alignedPassage: passage,
    alignedHeading,
    highlights,
    text: passage,
    surroundingText: passage,
    passageStart: passStart,
    alignmentScore: score,
    alignmentMethod: method,
    unsupportedClaims: opts.unsupported || [],
  };
}

// ───────── n-gram 多 claim 并集 ─────────

function sectionBodyLen(sec) {
  return String(sec?.text || "")
    .replace(/^#{1,6}\s+.+$/m, "")
    .replace(/^\*\*[^*].+\*\*\s*$/m, "")
    .replace(/\s+/g, "").length;
}

/**
 * 连续高分块聚成簇，取分最高的一簇（避免 from..to 把中间无关列表全吃进来）
 * @param {number[]} scores
 * @param {number} thr
 * @returns {number[]} indices
 */
function bestScoreCluster(scores, thr) {
  if (!scores.length) return [0];
  const above = scores
    .map((s, i) => (s >= thr ? i : -1))
    .filter((i) => i >= 0);
  if (!above.length) {
    let bi = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[bi]) bi = i;
    }
    return [bi];
  }
  // 切成连续簇
  const clusters = [];
  let cur = [above[0]];
  for (let k = 1; k < above.length; k++) {
    if (above[k] === cur[cur.length - 1] + 1) cur.push(above[k]);
    else {
      clusters.push(cur);
      cur = [above[k]];
    }
  }
  clusters.push(cur);

  let best = clusters[0];
  let bestSum = -1;
  for (const c of clusters) {
    const sum = c.reduce((s, i) => s + scores[i], 0);
    if (sum > bestSum) {
      bestSum = sum;
      best = c;
    }
  }
  return best;
}

/**
 * 每条 claim 用 n-gram 定位小节/块，再并集。
 * 二级小节门槛更严，块级取高分簇而非整节撑满。
 */
function ngramAlignClaimsToDocument(claims, docText) {
  const doc = stripDocumentMeta(docText);
  if (!doc || !claims.length) return null;
  const { sections, blocks } = parseDocumentStructure(doc);
  if (!sections.length) return null;

  const claimTexts = claims
    .map((c) => String(c.claim || "").trim())
    .filter(Boolean);
  if (!claimTexts.length) return null;

  const contentBlocks = blocks.filter((b) =>
    ["paragraph", "list-item", "code"].includes(b.type)
  );

  /** @type {{start:number,end:number}[]} */
  const ranges = [];
  let scoreSum = 0;
  let scoreN = 0;

  for (let ci = 0; ci < claimTexts.length; ci++) {
    const claimText = claimTexts[ci];

    const secScores = sections.map((sec) => {
      let sc = scoreClaimAgainstSection(claimText, sec);
      if (sectionBodyLen(sec) < 24) sc *= 0.3;
      return sc;
    });
    let bestSi = 0;
    let bestSc = -1;
    for (let si = 0; si < secScores.length; si++) {
      if (secScores[si] > bestSc) {
        bestSc = secScores[si];
        bestSi = si;
      }
    }
    scoreSum += bestSc;
    scoreN++;

    // 默认只取 best；二级节须非常接近，或 claim 字面点名了该节标题
    const chosenSis = new Set([bestSi]);
    const nearRel = bestSc * 0.92;
    const nearAbs = 0.2;
    const claimN = claimText.toLowerCase().replace(/\s+/g, "");
    for (let si = 0; si < secScores.length; si++) {
      if (si === bestSi) continue;
      if (sectionBodyLen(sections[si]) < 24) continue;
      if (secScores[si] >= nearRel && secScores[si] >= nearAbs) {
        chosenSis.add(si);
        continue;
      }
      // 单句同时点名多个小节标题（如「海外…和国产…」）
      const h = plainHeading(sections[si].heading);
      if (h.length >= 4 && claimN.includes(h.slice(0, 4))) {
        chosenSis.add(si);
      }
    }
    if (bestSc < 0.08) {
      chosenSis.clear();
      chosenSis.add(bestSi);
    }

    for (const si of chosenSis) {
      const section = sections[si];
      const secBlocks = contentBlocks.filter(
        (b) => b.start >= section.start && b.end <= section.end
      );

      if (!secBlocks.length) {
        if (si === bestSi && bestSc >= 0.05) {
          ranges.push({ start: section.start, end: section.end });
        }
        continue;
      }

      const blockScores = secBlocks.map((b) => ngramScore(claimText, b.text));
      const maxS = Math.max(...blockScores, 0);
      // 标题被 claim 点名时略放宽块阈值，避免只命中首条列表
      const head = plainHeading(section.heading);
      const headNamed = head.length >= 4 && claimN.includes(head.slice(0, 4));
      const thr = Math.max(0.045, maxS * (headNamed ? 0.42 : 0.55));
      const idxs = bestScoreCluster(blockScores, thr);
      let related = idxs.map((i) => secBlocks[i]);

      // 标题强命中且命中块过少：并入同节中分接近的块（仍不成整节灌入）
      if (headNamed && related.length <= 1 && secBlocks.length > 1) {
        const soft = Math.max(0.04, maxS * 0.35);
        const extra = [];
        for (let i = 0; i < secBlocks.length; i++) {
          if (blockScores[i] >= soft) extra.push(secBlocks[i]);
        }
        if (extra.length > related.length) related = extra;
      }

      ranges.push({
        start: Math.min(...related.map((b) => b.start)),
        end: Math.max(...related.map((b) => b.end)),
      });
    }
  }

  if (!ranges.length) return null;

  const avgScore = scoreN ? scoreSum / scoreN : 0;
  return finalizeAlignedFromRanges(doc, ranges, blocks, sections, {
    score: avgScore,
    method: "ngram-claim-union",
  });
}

/**
 * @param {string} answerText
 * @param {object[]} sources
 */
async function alignCitationsInAnswer(answerText, sources = []) {
  if (!sources?.length || !answerText) return sources;

  const claims = extractClaimsWithCitations(answerText);
  if (!claims.length) {
    return sources.map((s) => ({
      ...s,
      text: stripDocumentMeta(s.text || s.surroundingText || ""),
      surroundingText: stripDocumentMeta(s.surroundingText || s.text || ""),
    }));
  }

  const byCite = new Map();
  for (const c of claims) {
    if (!byCite.has(c.citeNum)) byCite.set(c.citeNum, []);
    byCite.get(c.citeNum).push(c);
  }

  const out = sources.map((s) => ({ ...s }));

  for (const [citeNum, cs] of byCite.entries()) {
    const idx = citeNum - 1;
    if (idx < 0 || idx >= out.length) continue;
    const src = out[idx];
    const doc = src.originalText || src.surroundingText || src.text || "";
    try {
      const aligned = ngramAlignClaimsToDocument(cs, doc);

      if (aligned?.alignedPassage?.length >= 20) {
        out[idx] = {
          ...src,
          ...aligned,
          originalText: undefined,
          title: src.title,
          chunkId: src.chunkId,
          score: src.score,
          chunkSource: src.chunkSource,
          docSource: src.docSource,
          parent_document: src.parent_document,
          pending: false,
        };
      } else {
        const plain = stripDocumentMeta(
          src.text || src.surroundingText || ""
        );
        if (plain) {
          out[idx] = {
            ...src,
            text: plain,
            surroundingText: plain,
            alignedPassage: plain,
            originalText: undefined,
            pending: false,
          };
        }
      }
    } catch (e) {
      console.warn(`[citationAlign] source ${idx} failed:`, e.message);
    }
  }

  return out;
}

/** 流式阶段占位：只有标题，避免先闪错误正文 */
function sourcesPendingLite(sources = []) {
  return (sources || []).map((s, i) => ({
    title: s.title || `来源 ${i + 1}`,
    chunkId: s.chunkId,
    score: s.score,
    chunkSource: s.chunkSource,
    docSource: s.docSource,
    parent_document: s.parent_document,
    pending: true,
    text: "",
    surroundingText: "",
    highlights: [],
  }));
}

module.exports = {
  alignCitationsInAnswer,
  extractClaimsWithCitations,
  stripDocumentMeta,
  parseDocumentStructure,
  sourcesPendingLite,
};
