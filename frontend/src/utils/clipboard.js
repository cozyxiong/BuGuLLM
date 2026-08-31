import { renderMarkdownForClipboard } from "./chat/markdown";

/**
 * Strip chat-only chrome so pasted HTML is semantic (pre/code, lists, quotes).
 * @param {string} html
 * @returns {string}
 */
function sanitizeClipboardHtml(html) {
  if (!html || typeof document === "undefined") return html || "";
  const wrap = document.createElement("div");
  wrap.innerHTML = html;

  wrap.querySelectorAll("[data-code-snippet], button, svg").forEach((n) => n.remove());

  wrap.querySelectorAll("div.hljs, div.whitespace-pre-line").forEach((box) => {
    const pre = box.querySelector("pre");
    const code = pre?.textContent ?? box.textContent ?? "";
    const lang =
      box.querySelector("code.text-xs")?.textContent?.trim() ||
      box.querySelector("code")?.className?.replace(/^language-/, "") ||
      "";
    const next = document.createElement("pre");
    const inner = document.createElement("code");
    if (lang) inner.className = `language-${lang}`;
    inner.textContent = code.replace(/\n?Copy block\s*$/i, "").replace(/^Copy block\s*/i, "");
    next.appendChild(inner);
    box.replaceWith(next);
  });

  wrap.querySelectorAll("p").forEach((p) => {
    if ((p.textContent || "").trim() === "Copy block") p.remove();
  });

  return wrap.innerHTML;
}

/**
 * Copies the given markdown string as rich text to the clipboard.
 * HTML is clipboard-safe (no chat copy-button chrome). Plain text is markdown.
 * @param {string} markdownString - The markdown string to copy.
 * @returns {Promise<void>}
 */
export async function copyMarkdownAsRichText(markdownString) {
  try {
    const htmlContent = sanitizeClipboardHtml(
      renderMarkdownForClipboard(markdownString)
    );
    const blobHTML = new Blob([htmlContent], { type: "text/html" });
    const blobText = new Blob([markdownString], { type: "text/plain" });

    const data = [
      new ClipboardItem({
        "text/html": blobHTML,
        "text/plain": blobText,
      }),
    ];

    await navigator.clipboard.write(data);
  } catch (error) {
    console.error("Failed to copy markdown as rich text: ", error);
    try {
      await navigator.clipboard.writeText(markdownString || "");
    } catch {
      /* ignore */
    }
  }
}
