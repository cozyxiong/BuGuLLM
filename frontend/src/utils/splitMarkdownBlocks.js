/**
 * Split Markdown into top-level blocks for drag-and-drop.
 * Fences, tables, lists, quotes, headings, and paragraphs stay intact.
 */

function isFenceOpen(line) {
  return /^(`{3,}|~{3,})/.test(line);
}

function isHeading(line) {
  return /^#{1,6}\s/.test(line);
}

function isHr(line) {
  return /^(\*{3,}|-{3,}|_{3,})\s*$/.test(line);
}

function isQuote(line) {
  return /^>\s?/.test(line);
}

function isListLine(line) {
  return /^(\s*)([-*+]|\d+\.)\s/.test(line);
}

function isTableLine(line) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isBlockStart(line) {
  return (
    isFenceOpen(line) ||
    isHeading(line) ||
    isHr(line) ||
    isQuote(line) ||
    isListLine(line) ||
    isTableLine(line)
  );
}

export function splitMarkdownBlocks(text) {
  const src = String(text ?? "").replace(/\r\n/g, "\n");
  if (!src.trim()) return [];
  const lines = src.split("\n");
  const blocks = [];
  let i = 0;

  const push = (s) => {
    const t = String(s || "").replace(/^\n+|\n+$/g, "");
    if (t) blocks.push(t);
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isFenceOpen(line)) {
      const open = line.match(/^(`{3,}|~{3,})/)[1];
      const chunk = [line];
      i += 1;
      while (i < lines.length) {
        chunk.push(lines[i]);
        if (
          lines[i].trim().length >= open.length &&
          lines[i].trim().replace(/[`~]/g, "").trim() === "" &&
          lines[i].trim()[0] === open[0]
        ) {
          i += 1;
          break;
        }
        i += 1;
      }
      push(chunk.join("\n"));
      continue;
    }

    if (isHeading(line) || isHr(line)) {
      push(line);
      i += 1;
      continue;
    }

    if (isQuote(line)) {
      const chunk = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) {
          if (i + 1 < lines.length && isQuote(lines[i + 1])) {
            chunk.push(cur);
            i += 1;
            continue;
          }
          break;
        }
        if (!isQuote(cur) && chunk.length) break;
        chunk.push(cur);
        i += 1;
      }
      push(chunk.join("\n"));
      continue;
    }

    if (isListLine(line)) {
      const chunk = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) {
          if (i + 1 < lines.length && (isListLine(lines[i + 1]) || /^\s{2,}\S/.test(lines[i + 1]))) {
            chunk.push(cur);
            i += 1;
            continue;
          }
          break;
        }
        if (isListLine(cur) || /^\s{2,}\S/.test(cur)) {
          chunk.push(cur);
          i += 1;
          continue;
        }
        break;
      }
      push(chunk.join("\n"));
      continue;
    }

    if (isTableLine(line)) {
      const chunk = [];
      while (i < lines.length && isTableLine(lines[i])) {
        chunk.push(lines[i]);
        i += 1;
      }
      push(chunk.join("\n"));
      continue;
    }

    const chunk = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      chunk.push(lines[i]);
      i += 1;
    }
    push(chunk.join("\n"));
  }

  return mergeHeadingWithNext(blocks);
}

function isHeadingOnly(md) {
  const t = String(md || "").trim();
  if (!t || t.includes("\n")) return false;
  return isHeading(t);
}

/** 标题与紧随其后的非标题块合成一块；标题挨着标题则各自独立。 */
function mergeHeadingWithNext(blocks) {
  const out = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const cur = blocks[i];
    const next = blocks[i + 1];
    if (isHeadingOnly(cur) && next && !isHeadingOnly(next)) {
      out.push(`${cur}\n\n${next}`);
      i += 1;
      continue;
    }
    out.push(cur);
  }
  return out;
}

export function joinMarkdownBlocks(blocks) {
  return (blocks || []).join("\n\n");
}

export const BAGU_MD_TYPE = "application/x-bagu-md";

export function setMarkdownDragData(event, markdown) {
  const text = String(markdown || "");
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(BAGU_MD_TYPE, text);
  event.dataTransfer.setData("text/plain", text);
}
