import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  createContext,
  useContext,
  useCallback,
} from "react";
import {
  CaretDown,
  MagnifyingGlass,
  FileText,
  PencilSimple,
  Terminal,
  Globe,
  Lightbulb,
  FolderOpen,
  Wrench,
  Brain,
  Copy,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { formatElapsed } from "@/utils/chat/agentActivity";

/**
 * Context to persist thought expansion state across component transitions
 */
const ThoughtExpansionContext = createContext(null);

export function ThoughtExpansionProvider({ children }) {
  const [expansionStates, setExpansionStates] = useState({});

  const getExpanded = useCallback(
    (messageId) => {
      if (!messageId) return false;
      return expansionStates[messageId] ?? false;
    },
    [expansionStates]
  );

  const setExpanded = useCallback((messageId, expanded) => {
    if (!messageId) return;
    setExpansionStates((prev) => ({
      ...prev,
      [messageId]: expanded,
    }));
  }, []);

  return (
    <ThoughtExpansionContext.Provider value={{ getExpanded, setExpanded }}>
      {children}
    </ThoughtExpansionContext.Provider>
  );
}

export function useThoughtExpansion(messageId) {
  const context = useContext(ThoughtExpansionContext);
  if (!context) {
    return { expanded: false, setExpanded: () => {} };
  }
  return {
    expanded: context.getExpanded(messageId),
    setExpanded: (value) => context.setExpanded(messageId, value),
  };
}

const THOUGHT_KEYWORDS = ["thought", "thinking", "think", "thought_chain"];
const CLOSING_TAGS = [...THOUGHT_KEYWORDS, "response", "answer"];
export const THOUGHT_REGEX_OPEN = new RegExp(
  THOUGHT_KEYWORDS.map((keyword) => `<${keyword}\\s*(?:[^>]*?)?\\s*>`).join("|")
);
export const THOUGHT_REGEX_CLOSE = new RegExp(
  CLOSING_TAGS.map((keyword) => `</${keyword}\\s*(?:[^>]*?)?>`).join("|")
);
export const THOUGHT_REGEX_COMPLETE = new RegExp(
  THOUGHT_KEYWORDS.map(
    (keyword) =>
      `<${keyword}\\s*(?:[^>]*?)?\\s*>[\\s\\S]*?<\\/${keyword}\\s*(?:[^>]*?)?>`
  ).join("|")
);

function contentIsNotEmpty(content = "") {
  return (
    content
      ?.trim()
      ?.replace(THOUGHT_REGEX_OPEN, "")
      ?.replace(THOUGHT_REGEX_CLOSE, "")
      ?.replace(/[\n\s]/g, "")?.length > 0
  );
}

/**
 * Elapsed timer while thinking is active; freezes when complete.
 */
function useThinkingElapsed(isActive) {
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
    // freeze on complete
    if (startRef.current != null) {
      setElapsedMs(Date.now() - startRef.current);
    }
  }, [isActive]);

  return elapsedMs;
}

/** Shared muted Grok text classes */
const MUTED =
  "text-[14px] leading-[1.45] text-[#8b8b8b] light:text-[#71717a] font-normal";
const MUTED_HOVER =
  "hover:text-[#a3a3a3] light:hover:text-[#52525b] transition-colors";

/**
 * Grok web-style thinking header: 「思考中…」/「思考了 9s」+ caret
 * No card, no border — plain muted text only.
 */
export const ThoughtChainComponent = forwardRef(
  ({ content: initialContent, messageId, forceActive = false }, ref) => {
    const { t } = useTranslation();
    const [content, setContent] = useState(initialContent);
    const [hasReadableContent, setHasReadableContent] = useState(
      contentIsNotEmpty(initialContent)
    );
    const { expanded, setExpanded } = useThoughtExpansion(messageId);

    useEffect(() => {
      if (initialContent !== content) {
        setContent(initialContent);
        setHasReadableContent(contentIsNotEmpty(initialContent));
      }
    }, [initialContent]);

    useImperativeHandle(ref, () => ({
      updateContent: (newContent) => {
        setContent(newContent);
        setHasReadableContent(contentIsNotEmpty(newContent));
      },
    }));

    const isThinking =
      forceActive ||
      (content.match(THOUGHT_REGEX_OPEN) && !content.match(THOUGHT_REGEX_CLOSE));
    const isComplete =
      !forceActive &&
      (content.match(THOUGHT_REGEX_COMPLETE) ||
        content.match(THOUGHT_REGEX_CLOSE));

    const show =
      forceActive ||
      isThinking ||
      isComplete ||
      (content && content.match(THOUGHT_REGEX_OPEN));

    const elapsedMs = useThinkingElapsed(!!isThinking);

    if (!show && !hasReadableContent) return null;
    if (!content && !forceActive) return null;

    const elapsedLabel = formatElapsed(elapsedMs);
    const headerText = isThinking
      ? t("chat_window.agent_activity.thinking")
      : elapsedLabel
        ? t("chat_window.agent_activity.thought_for", { time: elapsedLabel })
        : t("chat_window.agent_activity.thought_done");

    // Complete: collapsible "思考了 9s ▾" — hide meaningless "0s" shells
    if (!isThinking && isComplete) {
      if (!elapsedLabel) {
        // Too short to show a thought timer; don't leave empty visual noise
        return null;
      }
      return (
        <div className="flex justify-start w-full mb-0.5 select-none">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`border-none bg-transparent p-0 cursor-pointer inline-flex items-center gap-1 ${MUTED} ${MUTED_HOVER}`}
            aria-expanded={expanded}
          >
            <span>{headerText}</span>
            <CaretDown
              size={12}
              weight="bold"
              className={`opacity-70 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      );
    }

    // Active thinking — plain muted text + soft shimmer, no pill/card
    return (
      <div className="flex justify-start w-full my-0.5 select-none">
        <div className={`inline-flex items-center gap-1.5 ${MUTED}`}>
          <span className="grok-thinking-shimmer">{headerText}</span>
          {elapsedLabel && isThinking && (
            <span className="opacity-60 tabular-nums">{elapsedLabel}</span>
          )}
        </div>
      </div>
    );
  }
);
ThoughtChainComponent.displayName = "ThoughtChainComponent";

/**
 * Query-mode pending — same flat typography as Grok thinking line.
 */
export function QueryLoadingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex justify-start w-full my-0.5 select-none">
      <span className={`grok-thinking-shimmer ${MUTED}`}>
        {t("chat_window.agent_activity.loading")}
      </span>
    </div>
  );
}

/**
 * Icon for a tool kind — matches Grok timeline glyphs.
 */
export function ActivityKindIcon({ kind, className = "" }) {
  const props = {
    size: 15,
    weight: "regular",
    className: `shrink-0 ${className}`,
  };
  switch (kind) {
    case "search":
      return <MagnifyingGlass {...props} />;
    case "read":
    case "info":
      return <FileText {...props} />;
    case "write":
    case "edit":
      return <PencilSimple {...props} />;
    case "run":
      return <Terminal {...props} />;
    case "browse":
      return <Globe {...props} />;
    case "list":
    case "mkdir":
      return <FolderOpen {...props} />;
    case "copy":
    case "move":
      return <Copy {...props} />;
    case "think":
      return <Lightbulb {...props} />;
    case "memory":
    case "history":
      return <Brain {...props} />;
    default:
      return <Wrench {...props} />;
  }
}

/**
 * Grok vertical timeline of tool steps (icons + connector line + muted labels).
 */
export function GrokActivityTimeline({
  steps = [],
  active = false,
  className = "",
}) {
  if (!steps.length) return null;

  return (
    <div className={`flex flex-col ${className}`}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isActiveStep = active && isLast;
        const label = typeof step === "string" ? step : step.label;
        const kind = typeof step === "string" ? "tool" : step.kind || "tool";

        return (
          <div key={`${kind}-${label}-${i}`} className="flex gap-2.5 min-w-0">
            {/* icon column + vertical rule */}
            <div className="flex flex-col items-center w-[18px] shrink-0">
              <div
                className={[
                  "flex items-center justify-center w-[18px] h-[18px]",
                  isActiveStep
                    ? "text-[#a3a3a3] light:text-[#52525b]"
                    : "text-[#6b6b6b] light:text-[#a1a1aa]",
                ].join(" ")}
              >
                <ActivityKindIcon kind={kind} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 min-h-[12px] my-0.5 bg-[#3f3f3f] light:bg-[#e4e4e7]" />
              )}
            </div>

            {/* label */}
            <div
              className={[
                "min-w-0 pb-2.5 text-[14px] leading-[1.45] font-normal",
                isLast && active ? "pb-1" : "",
                isActiveStep
                  ? "text-[#b0b0b0] light:text-[#3f3f46]"
                  : "text-[#8b8b8b] light:text-[#71717a]",
              ].join(" ")}
            >
              <span className="break-words">
                {label}
                {isActiveStep && <ThinkingEllipsis />}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThinkingEllipsis() {
  return (
    <span className="inline-flex ml-0.5 gap-[2px] align-middle" aria-hidden>
      <span className="activity-dot" />
      <span className="activity-dot" style={{ animationDelay: "0.15s" }} />
      <span className="activity-dot" style={{ animationDelay: "0.3s" }} />
    </span>
  );
}
