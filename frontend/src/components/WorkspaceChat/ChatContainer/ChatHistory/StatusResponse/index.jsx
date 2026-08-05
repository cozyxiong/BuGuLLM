import React, { useMemo, useState, useEffect, useRef } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import {
  extractActivitySteps,
  formatElapsed,
} from "@/utils/chat/agentActivity";
import { GrokActivityTimeline } from "../ThoughtContainer";

/**
 * Grok web-style agent activity — flat typography, no cards.
 */
export default function StatusResponse({ messages = [], isThinking = false }) {
  const { t } = useTranslation();
  const steps = useMemo(() => extractActivitySteps(messages), [messages]);
  const [userExpanded, setUserExpanded] = useState(false);
  const elapsedMs = useElapsed(isThinking);
  const elapsedLabel = formatElapsed(elapsedMs);

  useEffect(() => {
    if (!isThinking) setUserExpanded(false);
  }, [isThinking]);

  const hasSteps = steps.length > 0;
  const showTimeline = hasSteps && (isThinking || userExpanded);

  // Drop empty shells: no tools + not running → nothing to show
  // Also drop completed "思考了 0s" with zero useful content
  if (!isThinking && !hasSteps) return null;

  const headerText = isThinking
    ? hasSteps
      ? t("chat_window.agent_activity.working")
      : t("chat_window.agent_activity.thinking")
    : elapsedLabel
      ? t("chat_window.agent_activity.thought_for", { time: elapsedLabel })
      : hasSteps
        ? t("chat_window.agent_activity.used_tools", { count: steps.length })
        : t("chat_window.agent_activity.thought_done");

  // Completed with no duration and no steps already filtered; if no duration
  // and somehow no steps, hide
  if (!isThinking && !elapsedLabel && !hasSteps) return null;

  const canToggle = hasSteps && !isThinking;

  return (
    <div className="flex justify-start w-full my-0.5 select-none">
      <div className="w-full max-w-full flex flex-col gap-1">
        <div className="flex items-center min-h-[20px]">
          {canToggle ? (
            <button
              type="button"
              onClick={() => setUserExpanded((v) => !v)}
              className="border-none bg-transparent p-0 cursor-pointer inline-flex items-center gap-1 text-[14px] leading-[1.45] text-[#8b8b8b] light:text-[#71717a] hover:text-[#a3a3a3] light:hover:text-[#52525b] transition-colors font-normal"
              aria-expanded={userExpanded}
            >
              <span>{headerText}</span>
              <CaretDown
                size={12}
                weight="bold"
                className={`opacity-70 transition-transform duration-200 ${userExpanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : (
            <span
              className={[
                "inline-flex items-center gap-1.5 text-[14px] leading-[1.45] font-normal text-[#8b8b8b] light:text-[#71717a]",
                isThinking ? "grok-thinking-shimmer" : "",
              ].join(" ")}
            >
              <span>{headerText}</span>
              {isThinking && elapsedLabel && (
                <span className="opacity-60 tabular-nums">{elapsedLabel}</span>
              )}
            </span>
          )}
        </div>

        {showTimeline && (
          <GrokActivityTimeline steps={steps} active={isThinking} />
        )}
      </div>
    </div>
  );
}

function useElapsed(isActive) {
  const startRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (isActive) {
      if (startRef.current == null) startRef.current = Date.now();
      const tick = () => setElapsedMs(Date.now() - startRef.current);
      tick();
      const id = setInterval(tick, 200);
      return () => clearInterval(id);
    }
    if (startRef.current != null) {
      setElapsedMs(Date.now() - startRef.current);
    }
  }, [isActive]);

  return elapsedMs;
}
