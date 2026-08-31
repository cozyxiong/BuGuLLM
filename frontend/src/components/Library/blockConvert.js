/**
 * Convert / reorder Vditor WYSIWYG top-level blocks.
 * Vault remains Markdown; we mutate the WYSIWYG DOM then let Vditor serialize.
 */

function getLute(vditor) {
  return vditor?.vditor?.lute || null;
}

export function getWysiwygRoot(vditor) {
  return (
    vditor?.vditor?.wysiwyg?.element ||
    vditor?.vditor?.element?.querySelector?.(".vditor-reset") ||
    null
  );
}

function isListTag(el) {
  return el?.tagName === "UL" || el?.tagName === "OL";
}

function isListItem(el) {
  return el?.tagName === "LI";
}

function parentList(el) {
  const p = el?.parentElement;
  return isListTag(p) ? p : null;
}

function listItems(list) {
  return Array.from(list?.children || []).filter((c) => c.tagName === "LI");
}

function emptyListCleanup(list) {
  if (list && !listItems(list).length) list.remove();
}

function nestedListsOf(li) {
  const out = [];
  for (const child of li.children) {
    if (isListTag(child)) out.push(child);
    if (child.tagName === "P" || child.tagName === "DIV") {
      for (const inner of child.children) {
        if (isListTag(inner)) out.push(inner);
      }
    }
  }
  return out;
}

/**
 * 列表项命中盒不含嵌套子列表，避免缝里的鼠标被算到父项上。
 */
export function blockHitRect(el) {
  const full = el.getBoundingClientRect();
  const box = {
    top: full.top,
    bottom: full.bottom,
    left: full.left,
    right: full.right,
    width: full.width,
    height: full.height,
  };
  if (!isListItem(el)) return box;
  const nested = nestedListsOf(el);
  if (!nested.length) return box;
  let bottom = box.bottom;
  for (const list of nested) {
    const nr = list.getBoundingClientRect();
    if (nr.top < bottom) bottom = nr.top;
  }
  box.bottom = Math.max(box.top, bottom);
  box.height = box.bottom - box.top;
  return box;
}

/** 文档编辑器块：顶层块 + 每个列表项（嵌套项也单独成块） */
export function collectEditorBlocks(root) {
  if (!root) return [];
  const out = [];
  const walkList = (list) => {
    for (const li of listItems(list)) {
      out.push(li);
      for (const nested of nestedListsOf(li)) walkList(nested);
    }
  };
  for (const el of root.children) {
    if (el.nodeType !== 1) continue;
    if (isListTag(el)) walkList(el);
    else if (el.getAttribute("data-block") === "0") out.push(el);
  }
  return out;
}

export function getTopBlock(node, root) {
  if (!node || !root) return null;
  let el = node.nodeType === 3 ? node.parentElement : node;
  while (el && el !== root) {
    if (isListItem(el) && el.closest("ul, ol")) return el;
    if (
      el.getAttribute?.("data-block") === "0" &&
      el.parentElement === root &&
      !isListTag(el)
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** 按鼠标纵向位置命中整行；列表按条目命中，间距和左侧手柄沟也算 */
export function getBlockAtY(root, clientY, pad = 64) {
  if (!root) return null;
  let best = null;
  let bestDist = Infinity;
  let bestArea = Infinity;
  for (const el of collectEditorBlocks(root)) {
    const r = blockHitRect(el);
    const dist =
      clientY < r.top
        ? r.top - clientY
        : clientY > r.bottom
          ? clientY - r.bottom
          : 0;
    if (dist > pad) continue;
    const area = Math.max(1, r.width * r.height);
    if (dist < bestDist || (dist === bestDist && area < bestArea)) {
      best = el;
      bestDist = dist;
      bestArea = area;
    }
  }
  return best;
}

/**
 * 相邻块的「上块之后」和「下块之前」是同一插入缝。
 * 提示线画在缝中间，避免标题上下各出现两条线。
 */
export function dropLineFor(block, clientY, host, root) {
  if (!block || !host) return null;
  const rect = blockHitRect(block);
  const place = clientY < rect.top + rect.height / 2 ? "before" : "after";
  const blocks = collectEditorBlocks(root);
  const idx = blocks.indexOf(block);
  const neighbor =
    idx >= 0
      ? place === "before"
        ? blocks[idx - 1]
        : blocks[idx + 1]
      : null;
  const wrapRect = host.getBoundingClientRect();
  let y = place === "before" ? rect.top : rect.bottom;
  if (neighbor) {
    const nr = blockHitRect(neighbor);
    y =
      place === "before"
        ? (nr.bottom + rect.top) / 2
        : (rect.bottom + nr.top) / 2;
  }
  return {
    top: y - wrapRect.top,
    left: rect.left - wrapRect.left,
    width: rect.width,
    place,
    block,
  };
}

function listDepth(el) {
  if (!isListItem(el)) return 0;
  let depth = 0;
  let list = parentList(el);
  while (list) {
    depth += 1;
    const owner = list.parentElement?.closest("li");
    list = owner ? parentList(owner) : null;
  }
  return depth;
}

function isFirstInList(li) {
  const list = parentList(li);
  return !!list && listItems(list)[0] === li;
}

function isLastInList(li) {
  const list = parentList(li);
  if (!list) return false;
  const items = listItems(list);
  return items[items.length - 1] === li;
}

function walkAncestor(li, up) {
  let cur = li;
  let list = parentList(cur);
  for (let i = 0; i < up; i += 1) {
    const owner = list?.parentElement?.closest("li");
    if (!owner) return { li: null, list };
    cur = owner;
    list = parentList(cur);
  }
  return { li: cur, list };
}

function depthLeft(li, depth, maxDepth, fallbackLeft) {
  const up = maxDepth - depth;
  if (up <= 0) return fallbackLeft;
  const anc = walkAncestor(li, up);
  if (anc.li) return blockHitRect(anc.li).left;
  if (anc.list) return anc.list.getBoundingClientRect().left;
  return fallbackLeft;
}

function levelFromMouseX(li, clientX, minLevel, maxLevel, itemLeft) {
  if (maxLevel <= minLevel) return maxLevel;
  const lefts = [];
  for (let d = minLevel; d <= maxLevel; d += 1) {
    lefts.push({ level: d, left: depthLeft(li, d, maxLevel, itemLeft) });
  }
  if (clientX <= lefts[0].left) return minLevel;
  for (let i = 0; i < lefts.length - 1; i += 1) {
    const mid = (lefts[i].left + lefts[i + 1].left) / 2;
    if (clientX < mid) return lefts[i].level;
  }
  return maxLevel;
}

/**
 * 文档树同款：嵌套列表在首/末项可提升层级，随鼠标左右改缩进。
 */
export function computeEditorDrop(block, clientX, clientY, host, root) {
  const base = dropLineFor(block, clientY, host, root);
  if (!base) return null;
  const wrapRect = host.getBoundingClientRect();
  const result = {
    ...base,
    target: block,
    insertPlace: base.place,
    canPromote: false,
    showHint: false,
    level: 0,
  };
  if (!isListItem(block)) return result;

  const depth = listDepth(block);
  result.level = depth;
  const canPromote =
    depth > 1 &&
    ((base.place === "before" && isFirstInList(block)) ||
      (base.place === "after" && isLastInList(block)));
  result.canPromote = canPromote;
  if (!canPromote) return result;

  const blocks = collectEditorBlocks(root);
  const idx = blocks.indexOf(block);
  const flatNeighbor =
    idx >= 0
      ? base.place === "before"
        ? blocks[idx - 1]
        : blocks[idx + 1]
      : null;
  let minLevel = 1;
  if (flatNeighbor && isListItem(flatNeighbor)) {
    minLevel = Math.min(depth, Math.max(1, listDepth(flatNeighbor)));
  }

  const itemLeft = blockHitRect(block).left;
  const level = levelFromMouseX(block, clientX, minLevel, depth, itemLeft);
  result.level = level;
  result.showHint = true;

  const up = depth - level;
  if (up > 0) {
    const anc = walkAncestor(block, up);
    result.target = anc.li || anc.list || block;
    const edge = anc.li
      ? blockHitRect(anc.li).left
      : anc.list
        ? anc.list.getBoundingClientRect().left
        : itemLeft;
    result.left = edge - wrapRect.left;
    result.width = Math.max(40, base.left + base.width - result.left);
  }
  return result;
}

function parseHtmlNodes(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = String(html || "").trim();
  return Array.from(wrap.childNodes).filter(
    (n) => n.nodeType !== 3 || n.textContent.trim()
  );
}

function mergeAdjacentLists(node) {
  if (!node || node.nodeType !== 1) return;
  let list = isListTag(node) ? node : null;
  if (!list && isListTag(node.previousElementSibling)) {
    list = node.previousElementSibling;
  }
  if (!list && isListTag(node.nextElementSibling)) {
    list = node.nextElementSibling;
  }
  if (!list) return;
  const prev = list.previousElementSibling;
  if (isListTag(prev) && prev.tagName === list.tagName) {
    while (list.firstChild) prev.appendChild(list.firstChild);
    list.remove();
    list = prev;
  }
  const next = list.nextElementSibling;
  if (isListTag(next) && next.tagName === list.tagName) {
    while (next.firstChild) list.appendChild(next.firstChild);
    next.remove();
  }
}

/** 在列表项处切开，返回插入点两侧的列表（中间就是插入缝） */
function splitListAt(li, place) {
  const list = parentList(li);
  if (!list) return { before: null, after: null };
  const items = listItems(list);
  const idx = items.indexOf(li);
  const cut = place === "before" ? idx : idx + 1;
  if (cut <= 0) return { before: null, after: list };
  if (cut >= items.length) return { before: list, after: null };
  const after = list.cloneNode(false);
  for (const item of items.slice(cut)) after.appendChild(item);
  list.after(after);
  return { before: list, after };
}

function insertNodesBetweenLists(before, after, nodes, host, refNext) {
  if (!nodes.length) return;
  if (before?.parentElement) {
    before.after(...nodes);
    return;
  }
  if (after?.parentElement) {
    after.before(...nodes);
    return;
  }
  if (host) {
    const ref = refNext && refNext.parentNode === host ? refNext : null;
    nodes.forEach((n) => host.insertBefore(n, ref));
  }
}

function listItemHtml(li) {
  const clone = li.cloneNode(true);
  clone.querySelectorAll("input").forEach((n) => n.remove());
  return clone.innerHTML.trim();
}

function blockItems(block) {
  if (!block) return [""];
  const tag = block.tagName;
  if (tag === "LI") {
    return [listItemHtml(block)];
  }
  if (tag === "UL" || tag === "OL") {
    const items = Array.from(block.children)
      .filter((el) => el.tagName === "LI")
      .map(listItemHtml);
    return items.length ? items : [""];
  }
  if (block.getAttribute("data-type") === "code-block") {
    const code = block.querySelector("pre code");
    return [(code?.textContent || "").replace(/\n$/, "")];
  }
  if (tag === "TABLE") {
    return [block.innerText.replace(/\n+/g, " ").trim()];
  }
  if (tag === "HR") return [""];
  if (tag === "BLOCKQUOTE") {
    const inner = Array.from(block.querySelectorAll("p, h1, h2, h3, h4, li"))
      .map((el) => el.innerHTML.trim())
      .filter(Boolean);
    return inner.length ? inner : [block.innerHTML];
  }
  return [block.innerHTML];
}

function firstText(items) {
  const html = items[0] || "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || "").trim();
}

function toMd(type, items) {
  const joined = items.join("\n");
  const line = firstText(items) || "";
  switch (type) {
    case "h1":
      return `# ${line || "标题"}`;
    case "h2":
      return `## ${line || "标题"}`;
    case "h3":
      return `### ${line || "标题"}`;
    case "h4":
      return `#### ${line || "标题"}`;
    case "hr":
    case "line":
      return "---";
    case "paragraph":
      return items.map((html) => htmlToPlain(html) || "").join("\n\n") || "";
    case "ul":
      return items
        .map((html) => `- ${htmlToPlain(html) || "列表"}`)
        .join("\n");
    case "ol":
      return items
        .map((html, i) => `${i + 1}. ${htmlToPlain(html) || "列表"}`)
        .join("\n");
    case "check":
    case "task":
      return items
        .map((html) => `- [ ] ${htmlToPlain(html) || "待办"}`)
        .join("\n");
    case "quote":
      return items
        .map((html) => `> ${htmlToPlain(html) || "引用"}`)
        .join("\n");
    case "callout":
      return `> [!NOTE]\n${items
        .map((html) => `> ${htmlToPlain(html) || "提示"}`)
        .join("\n")}`;
    case "code":
      return `\`\`\`\n${items.map(htmlToPlain).join("\n")}\n\`\`\``;
    case "table":
      return "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |";
    case "toggle":
      return `<details>\n<summary>${line || "折叠"}</summary>\n\n</details>`;
    case "link":
      return `[${line || "链接"}](https://)`;
    case "image":
      return `![图片]()`;
    case "file":
      return `[文件或视频]()`;
    default:
      return joined;
  }
}

function htmlToPlain(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || "").replace(/\u200b/g, "").trim();
}

function mdToWysiwygHtml(vditor, md) {
  const lute = getLute(vditor);
  if (!lute || !md) return "";
  try {
    if (typeof lute.Md2VditorDOM === "function") {
      return lute.Md2VditorDOM(md);
    }
    if (typeof lute.SpinVditorDOM === "function") {
      return lute.SpinVditorDOM(md);
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function insertMarkdownAt(vditor, target, place, md) {
  const root = getWysiwygRoot(vditor);
  const source = String(md || "").trim();
  if (!root || !source) return;
  let html = mdToWysiwygHtml(vditor, source);
  if (!html) {
    const tmp = document.createElement("div");
    tmp.textContent = source;
    html = `<p data-block="0">${tmp.innerHTML.replace(/\n/g, "<br>")}</p>`;
  }
  const nodes = parseHtmlNodes(html);
  if (!nodes.length) return;
  if (target && root.contains(target) && isListItem(target)) {
    const list = parentList(target);
    const host = list?.parentElement;
    const refNext = list?.nextSibling;
    const { before, after } = splitListAt(target, place || "after");
    insertNodesBetweenLists(before, after, nodes, host, refNext);
    nodes.forEach((n) => mergeAdjacentLists(n));
  } else if (target && root.contains(target)) {
    target.insertAdjacentHTML(
      place === "before" ? "beforebegin" : "afterend",
      html
    );
    const inserted =
      place === "before" ? target.previousElementSibling : target.nextElementSibling;
    mergeAdjacentLists(inserted);
  } else {
    const empty =
      root.childElementCount === 1 &&
      !root.firstElementChild?.textContent?.trim();
    if (empty) root.innerHTML = html;
    else root.insertAdjacentHTML("beforeend", html);
  }
  persistVditor(vditor);
}

export function persistVditor(vditor) {
  if (!vditor) return;
  try {
    const md = vditor.getValue();
    vditor.vditor?.options?.input?.(md);
  } catch {
    /* not ready */
  }
}

export function convertBlock(vditor, block, type) {
  if (!vditor || !block) return null;
  const items = blockItems(block);
  const md = toMd(type, items);
  let html = mdToWysiwygHtml(vditor, md);
  if (!html) {
    html = fallbackHtml(type, items);
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  const nodes = Array.from(wrap.childNodes).filter(
    (n) => n.nodeType !== 3 || n.textContent.trim()
  );
  if (!nodes.length) return block;
  const first = nodes[0];
  if (isListItem(block)) {
    const list = parentList(block);
    const host = list?.parentElement;
    const refNext = list?.nextSibling;
    const { before, after } = splitListAt(block, "before");
    block.remove();
    emptyListCleanup(after);
    insertNodesBetweenLists(before, after, nodes, host, refNext);
    emptyListCleanup(before);
    nodes.forEach((n) => mergeAdjacentLists(n));
  } else {
    block.replaceWith(...nodes);
  }
  persistVditor(vditor);
  return first instanceof HTMLElement ? first : null;
}

function fallbackHtml(type, items) {
  const inner = items[0] || "";
  const text = htmlToPlain(inner);
  switch (type) {
    case "h1":
      return `<h1 data-block="0">${inner || "标题"}</h1>`;
    case "h2":
      return `<h2 data-block="0">${inner || "标题"}</h2>`;
    case "h3":
      return `<h3 data-block="0">${inner || "标题"}</h3>`;
    case "h4":
      return `<h4 data-block="0">${inner || "标题"}</h4>`;
    case "hr":
    case "line":
      return `<hr data-block="0">`;
    case "ul":
      return `<ul data-block="0">${items
        .map((h) => `<li>${h || "列表"}</li>`)
        .join("")}</ul>`;
    case "ol":
      return `<ol data-block="0">${items
        .map((h) => `<li>${h || "列表"}</li>`)
        .join("")}</ol>`;
    case "check":
    case "task":
      return `<ul data-block="0">${items
        .map(
          (h) =>
            `<li class="vditor-task"><input type="checkbox" /> ${h || "待办"}</li>`
        )
        .join("")}</ul>`;
    case "quote":
    case "callout":
      return `<blockquote data-block="0"><p data-block="0">${inner || "引用"}</p></blockquote>`;
    case "code":
      return `<div class="vditor-wysiwyg__block" data-type="code-block" data-block="0" data-marker="\`\`\`"><pre><code>${text}\n</code></pre></div>`;
    case "table":
      return `<table data-block="0"><thead><tr><th>列1</th><th>列2</th><th>列3</th></tr></thead><tbody><tr><td> </td><td> </td><td> </td></tr></tbody></table>`;
    case "link":
      return `<p data-block="0"><a href="https://">${text || "链接"}</a></p>`;
    case "image":
      return `<p data-block="0"><img alt="图片" src=""></p>`;
    case "file":
      return `<p data-block="0"><a href="">${text || "文件或视频"}</a></p>`;
    case "toggle":
      return `<p data-block="0">${text || "折叠"}</p>`;
    default:
      return `<p data-block="0">${inner}</p>`;
  }
}

export function moveBlock(vditor, source, target, place) {
  if (!vditor || !source || !target || source === target) return;
  if (source.contains?.(target)) return;
  const srcList = parentList(source);
  const tgtList = parentList(target);

  if (isListItem(source) && isListItem(target) && srcList && tgtList) {
    if (place === "before") tgtList.insertBefore(source, target);
    else tgtList.insertBefore(source, target.nextSibling);
    emptyListCleanup(srcList);
    mergeAdjacentLists(tgtList);
  } else if (isListItem(source) && srcList) {
    const ul = document.createElement(srcList.tagName);
    ul.setAttribute("data-block", srcList.getAttribute("data-block") || "0");
    ul.appendChild(source);
    if (place === "before") target.parentElement?.insertBefore(ul, target);
    else target.parentElement?.insertBefore(ul, target.nextSibling);
    emptyListCleanup(srcList);
    mergeAdjacentLists(ul);
  } else if (isListItem(target) && tgtList) {
    const list = tgtList;
    const host = list.parentElement;
    const refNext = list.nextSibling;
    const { before, after } = splitListAt(target, place);
    insertNodesBetweenLists(before, after, [source], host, refNext);
    mergeAdjacentLists(source);
  } else if (place === "before") {
    target.parentElement?.insertBefore(source, target);
  } else {
    target.parentElement?.insertBefore(source, target.nextSibling);
  }
  persistVditor(vditor);
}

export function focusBlock(block) {
  if (!block) return;
  try {
    const range = document.createRange();
    const target =
      block.querySelector("p, li, h1, h2, h3, h4, code, th, td") || block;
    range.selectNodeContents(target);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* ignore */
  }
}
