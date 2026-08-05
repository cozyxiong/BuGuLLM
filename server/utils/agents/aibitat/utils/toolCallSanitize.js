/**
 * Model-agnostic helpers for agent tool-call hygiene.
 * Some models leak tool invocations as plain text (XML / markup / JSON in prose)
 * instead of provider-native tool_calls — recover or strip so the harness stays stable.
 */

const { safeJsonParse } = require("../../../http");

/** @param {string} text */
function looksLikeLeakedToolMarkup(text = "") {
  const s = String(text || "");
  if (!s.trim()) return false;
  if (/tool[_-]?calls?/i.test(s) && /invoke|function[_-]?call|<\/?[a-z_|]{0,20}parameter/i.test(s))
    return true;
  if (/<\/?[a-z_.|-]*invoke\b/i.test(s)) return true;
  if (/<\/?[a-z_.|-]*tool_call\b/i.test(s)) return true;
  if (/<\/?[a-z_.|-]*function_call\b/i.test(s)) return true;
  if (/<\/?[a-z_.|-]*parameter\b/i.test(s) && /name\s*=/i.test(s)) return true;
  // Fenced JSON that looks like a tool request
  if (
    /```(?:json|tool|xml)?\s*[\s\S]*"name"\s*:\s*"[a-zA-Z0-9_.-]+"[\s\S]*"arguments"\s*:/i.test(
      s
    )
  )
    return true;
  if (
    /(?:call|use|run)\s+(?:the\s+)?(?:tool|function)\s+[a-zA-Z0-9_.-]+/i.test(s) &&
    /(?:with|args|parameters|path)\s*[:=]/i.test(s)
  )
    return true;
  return false;
}

/**
 * Strip common leaked tool-call markup from assistant text for display/storage.
 * @param {string} text
 */
function stripLeakedToolMarkup(text = "") {
  let s = String(text || "");
  if (!s) return "";

  // Block-level tool call envelopes (provider-agnostic)
  s = s.replace(/```(?:json|tool|xml)?\s*[\s\S]*?```/gi, (block) => {
    if (/"name"\s*:/.test(block) && /"arguments"\s*:/.test(block)) return "";
    if (/invoke|tool_call|function_call|parameter/i.test(block)) return "";
    return block;
  });

  s = s.replace(/<[^>]*tool_calls?[^>]*>[\s\S]*?<\/[^>]*tool_calls?[^>]*>/gi, "");
  s = s.replace(/<[^>]*function_call[^>]*>[\s\S]*?<\/[^>]*function_call[^>]*>/gi, "");
  s = s.replace(/<[^>]*invoke[^>]*>[\s\S]*?<\/[^>]*invoke[^>]*>/gi, "");
  s = s.replace(/<[^>]*tool_call[^>]*>[\s\S]*?<\/[^>]*tool_call[^>]*>/gi, "");

  // Loose parameter / invoke lines
  s = s.replace(/<\/?[^>\n]*(?:invoke|parameter|tool_call|function_call|tool_calls)[^>\n]*>/gi, "");

  // Pipe-tagged proprietary protocols (e.g. |TAG|tool_calls) without vendor names
  s = s.replace(/[|<]{1,2}[A-Za-z0-9_-]{2,32}[|>]{1,2}[\s\S]*?(?:tool_calls?|invoke)[\s\S]*$/gi, "");

  // JSON-only tool payload as entire message
  const trimmed = s.trim();
  if (/^\{[\s\S]*"name"\s*:[\s\S]*"arguments"\s*:[\s\S]*\}$/.test(trimmed)) {
    return "";
  }

  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Try to recover a single tool call from leaked plain-text markup.
 * @param {string} text
 * @param {string[]} [allowedNames]
 * @returns {{ id: string, name: string, arguments: object } | null}
 */
function parseEmbeddedToolCall(text = "", allowedNames = []) {
  const s = String(text || "");
  if (!s.trim()) return null;
  const allowed = new Set(
    (allowedNames || []).filter(Boolean).map((n) => String(n).toLowerCase())
  );

  const pickName = (name) => {
    if (!name) return null;
    const n = String(name).trim();
    if (!n) return null;
    if (allowed.size && !allowed.has(n.toLowerCase())) return null;
    return n;
  };

  // --- JSON: {"name":"...","arguments":{...}} or tool_calls array ---
  const jsonCandidates = [];
  const fence = s.match(/```(?:json|tool)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) jsonCandidates.push(fence[1].trim());
  const brace = s.match(/\{[\s\S]*"name"\s*:\s*"[^"]+"[\s\S]*\}/);
  if (brace?.[0]) jsonCandidates.push(brace[0]);

  for (const raw of jsonCandidates) {
    const obj = safeJsonParse(raw, null);
    if (!obj) continue;
    if (Array.isArray(obj.tool_calls) && obj.tool_calls[0]) {
      const tc = obj.tool_calls[0];
      const name = pickName(tc.function?.name || tc.name);
      if (!name) continue;
      let args = tc.function?.arguments ?? tc.arguments ?? {};
      if (typeof args === "string") args = safeJsonParse(args, {});
      return {
        id: tc.id || `recovered_${Date.now()}`,
        name,
        arguments: args && typeof args === "object" ? args : {},
      };
    }
    const name = pickName(obj.name || obj.function?.name || obj.tool);
    if (!name) continue;
    let args = obj.arguments ?? obj.parameters ?? obj.function?.arguments ?? {};
    if (typeof args === "string") args = safeJsonParse(args, {});
    return {
      id: `recovered_${Date.now()}`,
      name,
      arguments: args && typeof args === "object" ? args : {},
    };
  }

  // --- XML-ish: invoke name="tool" + parameter name="k">v</parameter> ---
  const invokeName =
    s.match(/invoke\s+name\s*=\s*["']([^"']+)["']/i)?.[1] ||
    s.match(/<invoke[^>]*\bname\s*=\s*["']([^"']+)["']/i)?.[1] ||
    s.match(/function_call[^>]*\bname\s*=\s*["']([^"']+)["']/i)?.[1] ||
    s.match(/tool_call[^>]*\bname\s*=\s*["']([^"']+)["']/i)?.[1] ||
    s.match(/name\s*=\s*["']([a-zA-Z][a-zA-Z0-9_.-]{2,80})["'][\s\S]{0,80}parameter/i)?.[1];

  const nameFromInvoke = pickName(invokeName);
  if (nameFromInvoke) {
    const args = {};
    const paramRe =
      /parameter\s+name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/[^>]*parameter/gi;
    let m;
    while ((m = paramRe.exec(s)) !== null) {
      args[m[1]] = String(m[2] || "")
        .replace(/^\s+|\s+$/g, "")
        .replace(/^["']|["']$/g, "");
    }
    // Fallback: name="path" ... >value without strict close
    if (!Object.keys(args).length) {
      const loose = [
        ...s.matchAll(
          /parameter\s+name\s*=\s*["']([^"']+)["'][^>]*>([^<\n]+)/gi
        ),
      ];
      for (const lm of loose) {
        args[lm[1]] = String(lm[2] || "").trim();
      }
    }
    return {
      id: `recovered_${Date.now()}`,
      name: nameFromInvoke,
      arguments: args,
    };
  }

  // --- Prose: use tool filesystem-list-directory with path=. ---
  for (const candidate of allowedNames) {
    const re = new RegExp(
      `(?:call|use|run|invoke)\\s+(?:the\\s+)?(?:tool\\s+)?["']?${escapeRegExp(candidate)}["']?`,
      "i"
    );
    if (!re.test(s)) continue;
    const args = {};
    const pathM = s.match(/\bpath\s*[=:]\s*["']?([^\s"'<>]+)/i);
    if (pathM) args.path = pathM[1];
    const cmdM = s.match(/\bcommand\s*[=:]\s*["']([^"']+)["']/i);
    if (cmdM) args.command = cmdM[1];
    return {
      id: `recovered_${Date.now()}`,
      name: candidate,
      arguments: args,
    };
  }

  return null;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Clean final assistant text before persisting / returning to user.
 * @param {string} text
 */
function sanitizeAgentFinalText(text = "") {
  let s = stripLeakedToolMarkup(text);
  // Strip incomplete think blocks for display safety
  s = s
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
  if (looksLikeLeakedToolMarkup(s) && !parseEmbeddedToolCall(s)) {
    s = stripLeakedToolMarkup(s);
  }
  // If almost nothing left after stripping a pure tool dump
  if (!s && looksLikeLeakedToolMarkup(text)) {
    return "工具调用未正确完成，请再试一次（或换一种说法描述任务）。";
  }
  return s;
}

/**
 * Normalize a provider completion: recover functionCall from text if needed.
 * @param {{ textResponse?: string, functionCall?: object|null, uuid?: string }} completion
 * @param {Array<{name?: string}|string>} functions
 */
function normalizeProviderCompletion(completion, functions = []) {
  if (!completion || typeof completion !== "object") return completion;
  const names = (functions || [])
    .map((f) => (typeof f === "string" ? f : f?.name))
    .filter(Boolean);

  let textResponse = completion.textResponse ?? "";
  let functionCall = completion.functionCall || null;

  if (!functionCall && textResponse) {
    const recovered = parseEmbeddedToolCall(textResponse, names);
    if (recovered) {
      functionCall = recovered;
      textResponse = stripLeakedToolMarkup(textResponse);
    }
  }

  return {
    ...completion,
    textResponse,
    functionCall,
  };
}

const TOOL_PROTOCOL_RECOVERY_HINT =
  "Your previous reply contained a tool/function invocation as plain text (XML, markup, or fenced JSON). " +
  "That is invalid. Use the API's native tool/function calling channel only — do not print tool calls in the message body. " +
  "Continue the user's task with a proper tool call or a normal final answer. " +
  "For vault paths, use paths relative to the workspace vault root (e.g. AI/RAG.md or .), never OS absolute paths.";

module.exports = {
  looksLikeLeakedToolMarkup,
  stripLeakedToolMarkup,
  parseEmbeddedToolCall,
  sanitizeAgentFinalText,
  normalizeProviderCompletion,
  TOOL_PROTOCOL_RECOVERY_HINT,
};
