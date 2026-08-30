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

export function getTopBlock(node, root) {
  if (!node || !root) return null;
  let el = node.nodeType === 3 ? node.parentElement : node;
  while (el && el !== root) {
    if (
      el.getAttribute?.("data-block") === "0" &&
      el.parentElement === root
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** 按鼠标纵向位置命中整行，左右空白和左侧手柄沟都算在该块上 */
export function getBlockAtY(root, clientY, pad = 4) {
  if (!root) return null;
  let best = null;
  let bestDist = Infinity;
  for (const el of root.children) {
    if (el.nodeType !== 1 || el.getAttribute("data-block") !== "0") continue;
    const r = el.getBoundingClientRect();
    if (clientY < r.top - pad || clientY > r.bottom + pad) continue;
    const dist = Math.abs(clientY - (r.top + r.bottom) / 2);
    if (dist < bestDist) {
      best = el;
      bestDist = dist;
    }
  }
  return best;
}

function listItemHtml(li) {
  const clone = li.cloneNode(true);
  clone.querySelectorAll("input").forEach((n) => n.remove());
  return clone.innerHTML.trim();
}

function blockItems(block) {
  if (!block) return [""];
  const tag = block.tagName;
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
  block.replaceWith(...nodes);
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
  if (place === "before") target.parentElement?.insertBefore(source, target);
  else target.parentElement?.insertBefore(source, target.nextSibling);
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
