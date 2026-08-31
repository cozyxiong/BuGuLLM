/* eslint-disable react-hooks/refs */
import { memo, useRef, useEffect, useState } from "react";
import { Warning, CaretDown, CaretRight } from "@phosphor-icons/react";
import renderMarkdown from "@/utils/chat/markdown";
import DOMPurify from "@/utils/chat/purify";
import AssistantBlocks from "../AssistantBlocks";
import {
  THOUGHT_REGEX_CLOSE,
  THOUGHT_REGEX_COMPLETE,
  THOUGHT_REGEX_OPEN,
  ThoughtChainComponent,
  QueryLoadingIndicator,
} from "../ThoughtContainer";

const PromptReply = ({
  uuid,
  reply,
  pending,
  error,
  sources = [],
  supplement = null,
  relatedTopics = null,
  sendCommand = null,
}) => {
  if (!reply && sources.length === 0 && !pending && !error) return null;

  // 问答模式：无工具时用与思考框一致的加载动画填充
  if (pending) {
    return (
      <div className="flex justify-start w-full">
        <div className="py-2 pl-0 pr-4 flex flex-col w-full">
          <QueryLoadingIndicator />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-start w-full">
        <div className="py-4 pl-0 pr-4 flex flex-col md:max-w-[80%]">
          <span className="inline-block p-2 rounded-lg bg-red-50 text-red-500">
            <Warning className="h-4 w-4 mb-1 inline-block" /> Could not respond
            to message.
            <span className="text-xs">Reason: {error || "unknown"}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div key={uuid} className="flex justify-start w-full">
      <div className="py-1.5 pl-0 pr-4 flex flex-col w-full">
        <RenderAssistantChatContent
          key={`${uuid}-prompt-reply-content`}
          message={reply}
          messageId={uuid}
          sources={sources}
        />
        {supplement && <AISupplement content={supplement} />}
        {relatedTopics && relatedTopics.length > 0 && (
          <RelatedTopicsChips
            topics={relatedTopics}
            sendCommand={sendCommand}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Collapsible section for the AI supplement (standard interview answer).
 */
function AISupplement({ content }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-3 border border-emerald-500/30 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-x-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-emerald-400 text-sm font-medium"
      >
        {isExpanded ? (
          <CaretDown size={14} weight="bold" />
        ) : (
          <CaretRight size={14} weight="bold" />
        )}
        面试标准答案 (AI 补充)
      </button>
      {isExpanded && (
        <div className="px-4 py-3 text-sm text-white/80 light:text-slate-700 bg-emerald-500/5">
          <span
            className="break-words"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(renderMarkdown(content)),
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Clickable chips for related knowledge topics.
 * When clicked, submits the query as a new message.
 */
function RelatedTopicsChips({ topics = [], sendCommand }) {
  if (!topics.length) return null;

  function handleTopicClick(query) {
    if (sendCommand && query) {
      sendCommand({ text: query, autoSubmit: true });
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-white/50 light:text-slate-500">
        相关知识点:
      </span>
      {topics.map((topic, idx) => (
        <button
          key={`topic-${idx}-${topic.title}`}
          type="button"
          onClick={() => handleTopicClick(topic.query)}
          className="px-3 py-1 text-xs rounded-full bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/25 hover:border-cyan-500/50 transition-all cursor-pointer"
        >
          {topic.title}
        </button>
      ))}
    </div>
  );
}

function RenderAssistantChatContent({ message, messageId, sources = [] }) {
  const thoughtChainRef = useRef(null);

  const thinking =
    message.match(THOUGHT_REGEX_OPEN) && !message.match(THOUGHT_REGEX_CLOSE);

  useEffect(() => {
    if (thinking && thoughtChainRef.current) {
      thoughtChainRef.current.updateContent(message);
      return;
    }
    const completeThoughtChain = message.match(THOUGHT_REGEX_COMPLETE)?.[0];
    if (completeThoughtChain && thoughtChainRef.current) {
      thoughtChainRef.current.updateContent(completeThoughtChain);
    }
  }, [message, thinking]);

  if (thinking)
    return (
      <ThoughtChainComponent
        ref={thoughtChainRef}
        content={message}
        messageId={messageId}
      />
    );

  const completeThought = message.match(THOUGHT_REGEX_COMPLETE)?.[0] || "";
  const msgToRender = message.replace(THOUGHT_REGEX_COMPLETE, "");

  return (
    <div className="flex flex-col gap-y-3">
      {completeThought && (
        <ThoughtChainComponent
          ref={thoughtChainRef}
          content={completeThought}
          messageId={messageId}
        />
      )}
      <AssistantBlocks content={msgToRender} sources={sources} />
    </div>
  );
}

export default memo(PromptReply);
