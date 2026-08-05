import React, { useState } from "react";
import { CaretDown, Check, X } from "@phosphor-icons/react";
import AgentSkillWhitelist from "@/models/agentSkillWhitelist";
import { useTranslation } from "react-i18next";
import useTimeoutProgress from "@/hooks/useTimeoutProgress";
import { formatToolStep, kindFromSkillName } from "@/utils/chat/agentActivity";
import { ActivityKindIcon } from "../ThoughtContainer";

export default function ToolApprovalRequest({
  requestId,
  skillName,
  payload = {},
  description = null,
  timeoutMs = null,
  websocket,
  onResponse,
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [responded, setResponded] = useState(false);
  const [approved, setApproved] = useState(null);
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const hasPayload = payload && Object.keys(payload).length > 0;
  // Keep English tool labels (e.g. "Mkdir 总结") — do not localize skill names
  const displayName = formatToolStep(skillName, payload) || skillName;
  const kind = kindFromSkillName(skillName);

  const progressPercent = useTimeoutProgress(timeoutMs, {
    active: !responded,
    intervalMs: 50,
    onTimeout: handleTimeout,
  });

  function handleTimeout() {
    if (responded) return;
    setResponded(true);
    setApproved(false);
    onResponse?.(false);
  }

  async function handleResponse(isApproved) {
    if (responded) return;

    setResponded(true);
    setApproved(isApproved);

    if (isApproved && alwaysAllow) {
      await AgentSkillWhitelist.addToWhitelist(skillName);
    }

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(
        JSON.stringify({
          type: "toolApprovalResponse",
          requestId,
          approved: isApproved,
        })
      );
    }

    onResponse?.(isApproved);
  }

  // After response: one quiet line, no big card
  if (approved !== null) {
    return (
      <div className="flex justify-start w-full my-1 select-none">
        <div
          className={[
            "inline-flex items-center gap-1.5 text-[13px] leading-none",
            approved
              ? "text-emerald-500/80 light:text-emerald-600"
              : "text-red-400/80 light:text-red-500",
          ].join(" ")}
        >
          {approved ? (
            <Check size={13} weight="bold" />
          ) : (
            <X size={13} weight="bold" />
          )}
          <span>
            {approved
              ? t("chat_window.agent_invocation.tool_call_was_approved")
              : t("chat_window.agent_invocation.tool_call_was_rejected")}
          </span>
          <span className="text-[#8b8b8b]/70 light:text-[#a1a1aa] truncate max-w-[220px]">
            · {displayName}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start w-full my-1.5 select-none">
      <div
        className={[
          "relative w-full max-w-[480px]",
          "rounded-xl",
          "border border-white/[0.08] light:border-black/[0.08]",
          "bg-white/[0.03] light:bg-black/[0.025]",
          "overflow-hidden",
        ].join(" ")}
      >
        {/* Compact single row: icon · label · actions */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 min-h-[36px]">
          <div className="text-[#8b8b8b] light:text-[#71717a] shrink-0">
            <ActivityKindIcon kind={kind} />
          </div>

          <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
            <span className="text-[12px] text-[#8b8b8b] light:text-[#71717a] shrink-0 hidden sm:inline">
              {t("chat_window.agent_invocation.model_wants_to_call")}
            </span>
            <span className="text-[13px] font-medium text-white/85 light:text-zinc-800 truncate">
              {displayName}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleResponse(true)}
              className="border-none cursor-pointer h-6 px-2.5 rounded-md text-[12px] font-semibold bg-white text-zinc-900 hover:bg-white/90 light:bg-zinc-900 light:text-white light:hover:bg-zinc-800 transition-colors"
            >
              {t("chat_window.agent_invocation.approve")}
            </button>
            <button
              type="button"
              onClick={() => handleResponse(false)}
              className="border-none cursor-pointer h-6 px-2 rounded-md text-[12px] font-medium text-white/55 light:text-zinc-500 hover:text-white/80 light:hover:text-zinc-800 hover:bg-white/5 light:hover:bg-zinc-100 transition-colors"
            >
              {t("chat_window.agent_invocation.reject")}
            </button>
            {(hasPayload || description) && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="border-none bg-transparent p-0.5 cursor-pointer text-[#6b6b6b] light:text-[#a1a1aa] hover:text-[#a3a3a3] transition-colors"
                aria-label={isExpanded ? "Hide details" : "Show details"}
              >
                <CaretDown
                  size={12}
                  weight="bold"
                  className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Always-allow sits under the row, still compact */}
        <div className="px-2.5 pb-1.5 flex flex-col gap-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#6b6b6b] light:text-[#a1a1aa] hover:text-[#8b8b8b] transition-colors select-none pl-[26px]">
            <input
              type="checkbox"
              checked={alwaysAllow}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
              className="w-3 h-3 rounded border-white/20 bg-transparent cursor-pointer accent-zinc-400"
            />
            <span className="truncate">
              {t("chat_window.agent_invocation.always_allow", {
                skillName: displayName,
              })}
            </span>
          </label>

          {isExpanded && (description || hasPayload) && (
            <div className="ml-[26px] rounded-md bg-black/20 light:bg-zinc-100/80 px-2 py-1.5 overflow-x-auto">
              {description && (
                <p className="m-0 mb-1 text-[11px] text-[#8b8b8b] light:text-zinc-600">
                  {description}
                </p>
              )}
              {hasPayload && (
                <pre className="m-0 text-[11px] leading-relaxed text-[#7a7a7a] light:text-zinc-500 font-mono whitespace-pre-wrap break-words">
                  {formatPayload(payload)}
                </pre>
              )}
            </div>
          )}
        </div>

        {timeoutMs && !responded && (
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5 light:bg-black/5">
            <div
              className="h-full bg-white/20 light:bg-zinc-400/60 transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatPayload(data) {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
