/**
 * Closed-loop grounded RAG constraints appended to the workspace system prompt.
 *
 * 核心：
 * - 答案空间被上传/检索到的 Context 严格限定
 * - 知识库未覆盖时明确声明，禁止用通识补全
 * - 每条事实断言必须可点击追溯到具体段落
 */

/**
 * @param {string} baseSystemPrompt
 * @param {{ hasContext: boolean, contextCount?: number, strict?: boolean }} opts
 */
function buildGroundedSystemPrompt(baseSystemPrompt, opts = {}) {
  const { hasContext = false, contextCount = 0, strict = true } = opts;
  const base = String(baseSystemPrompt || "").trim();

  if (!hasContext) {
    return (
      base +
      `\n\n## Grounding status\nNo relevant source passages were retrieved for this turn.\n` +
      `If the user asks about facts that would require the knowledge base, reply that the knowledge base has no matching material and do NOT invent details from general knowledge.`
    );
  }

  // strict：有上下文时强制闭环
  const grounded = `

## Closed-loop grounded mode
You are answering in a closed-loop RAG system. The answer space is bounded exclusively by the Context blocks labeled [CONTEXT 0]…[CONTEXT ${Math.max(0, contextCount - 1)}].

Rules:
1. Use ONLY facts that appear in those Context blocks. Do not fill gaps with training-data / general knowledge.
2. After every factual claim, place an inline citation using 1-based indices: [1] maps to CONTEXT 0, [2] to CONTEXT 1, etc. Cite only contexts you actually used.
3. If the Context does not address part of the question, explicitly write: 「知识库未覆盖该点」and stop inventing.
4. Prefer concrete, auditable details present in the sources (names, numbers, steps, code) over vague paraphrase.
5. Do not append JSON metadata or extra citation tables at the end.
${strict ? "6. When Context is partial, still stay inside Context — never complete the answer from outside knowledge." : ""}
`;

  return base + grounded;
}

/**
 * 将检索到的 context 规整为带稳定编号的块（便于对齐与审计）
 * @param {string[]} contextTexts
 * @param {object[]} sources parallel sources
 */
function packageGroundedContexts(contextTexts = [], sources = []) {
  return (contextTexts || []).map((text, i) => {
    const src = sources[i] || {};
    const title = src.title || src.docSource || `source-${i + 1}`;
    const body = String(text || "").trim();
    return {
      index: i,
      citeNum: i + 1,
      title,
      text: body,
      // 给模型看的包装
      labeled: `[CONTEXT ${i}] (cite as [${i + 1}]; title: ${title})\n${body}\n[END CONTEXT ${i}]`,
    };
  });
}

/**
 * 若要覆盖默认 appendContext，可把 labeled 数组拼成单一 system 附加串
 */
function joinLabeledContexts(packages = []) {
  if (!packages.length) return "";
  return (
    "\n## Source Context (closed-loop; cite with [n])\n" +
    packages.map((p) => p.labeled).join("\n\n")
  );
}

module.exports = {
  buildGroundedSystemPrompt,
  packageGroundedContexts,
  joinLabeledContexts,
};
