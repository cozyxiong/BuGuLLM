import React, { memo, useLayoutEffect, useRef, useState } from "react";
import { Info, Warning, CaretDown, CaretRight } from "@phosphor-icons/react";
import Actions from "./Actions";
import renderMarkdown from "@/utils/chat/markdown";
import InlineCitedContent from "../InlineSourceCitations";
import { v4 } from "uuid";
import DOMPurify from "@/utils/chat/purify";
import { EditMessageForm, useEditMessage } from "./Actions/EditMessage";
import { useWatchDeleteMessage } from "./Actions/DeleteMessage";
import TTSMessage from "./Actions/TTSButton";
import {
  THOUGHT_REGEX_CLOSE,
  THOUGHT_REGEX_COMPLETE,
  THOUGHT_REGEX_OPEN,
  ThoughtChainComponent,
} from "../ThoughtContainer";
import paths from "@/utils/paths";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { chatQueryRefusalResponse } from "@/utils/chat";
import HistoricalOutputs from "./HistoricalOutputs";
import HistoricalClarifyingQuestions from "./HistoricalClarifyingQuestions";
import { openImageLightbox } from "@/components/ImageLightbox";

const HistoricalMessage = ({
  uuid: uuidProp,
  message,
  role,
  workspace,
  sources = [],
  attachments = [],
  error = false,
  feedbackScore = null,
  chatId = null,
  isLastMessage = false,
  regenerateMessage,
  saveEditedMessage,
  forkThread,
  metrics = {},
  outputs = [],
  clarifyingQuestions = [],
  supplement = null,
  relatedTopics = null,
  sendCommand = null,
}) => {
  // Freeze uuid on first render. User messages arrive without a uuid and this value
  // is used as the wrapper div's `key` — a default param fallback would regenerate
  // on every render and remount the subtree, wiping TruncatableContent state.
  const [uuid] = useState(() => uuidProp ?? v4());
  const { t } = useTranslation();
  const { isEditing } = useEditMessage({ chatId, role });
  const { isDeleted, completeDelete, onEndAnimation } = useWatchDeleteMessage({
    chatId,
    role,
  });
  const adjustTextArea = (event) => {
    const element = event.target;
    element.style.height = "auto";
    element.style.height = element.scrollHeight + "px";
  };

  const isRefusalMessage =
    role === "assistant" && message === chatQueryRefusalResponse(workspace);

  if (completeDelete) return null;

  if (!!error) {
    return (
      <div key={uuid} className="flex justify-start w-full">
        <div className="py-4 pl-0 pr-4 flex flex-col md:max-w-[80%]">
          <div className="p-2 rounded-lg bg-red-50 text-red-500">
            <span className="inline-block">
              <Warning className="h-4 w-4 mb-1 inline-block" /> Could not
              respond to message.
            </span>
            <p className="text-xs font-mono mt-2 border-l-2 border-red-300 pl-2 bg-red-200 p-2 rounded-sm">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (role === "user") {
    if (isEditing) {
      return (
        <div key={uuid} className="flex justify-end w-full py-1.5 px-4">
          <EditMessageForm
            role={role}
            chatId={chatId}
            message={message}
            attachments={attachments}
            adjustTextArea={adjustTextArea}
            saveChanges={saveEditedMessage}
          />
        </div>
      );
    }

    return (
      <div
        key={uuid}
        onAnimationEnd={onEndAnimation}
        className={`${isDeleted ? "animate-remove" : ""} flex justify-end w-full group`}
      >
        <div className="py-1.5 px-4 flex flex-col items-end">
          <div className="bg-zinc-800 light:bg-slate-100 rounded-[20px] rounded-br-none px-4 py-3.5 max-w-[600px] [&_p]:m-0">
            <TruncatableContent>
              <RenderChatContent
                role={role}
                message={message}
                messageId={uuid}
              />
              <ChatAttachments attachments={attachments} />
            </TruncatableContent>
          </div>
          {/* 始终占位，仅悬停显现，不改变排版 */}
          <div className="w-full flex justify-end items-center h-7 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
            <Actions
              message={message}
              feedbackScore={feedbackScore}
              chatId={chatId}
              slug={workspace?.slug}
              isLastMessage={isLastMessage}
              regenerateMessage={regenerateMessage}
              isEditing={isEditing}
              role={role}
              forkThread={forkThread}
              metrics={metrics}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      key={uuid}
      onAnimationEnd={onEndAnimation}
      className={`${isDeleted ? "animate-remove" : ""} flex justify-start w-full group`}
    >
      <div className="py-1.5 px-4 md:pl-0 flex flex-col w-full">
        {isEditing ? (
          <EditMessageForm
            role={role}
            chatId={chatId}
            message={message}
            attachments={attachments}
            adjustTextArea={adjustTextArea}
            saveChanges={saveEditedMessage}
          />
        ) : (
          <div className="break-words">
            <HistoricalClarifyingQuestions surveys={clarifyingQuestions} />
            <RenderChatContent
              role={role}
              message={message}
              messageId={uuid}
              sources={sources}
            />
            {isRefusalMessage && (
              <Link
                data-tooltip-id="query-refusal-info"
                data-tooltip-content={`${t("chat.refusal.tooltip-description")}`}
                className="!no-underline group !flex w-fit"
                to={paths.chatModes()}
                target="_blank"
              >
                <div className="flex flex-row items-center gap-x-1 group-hover:opacity-100 opacity-60 w-fit">
                  <Info className="text-theme-text-secondary" />
                  <p className="!m-0 !p-0 text-theme-text-secondary !no-underline text-xs cursor-pointer">
                    {t("chat.refusal.tooltip-title")}
                  </p>
                </div>
              </Link>
            )}
            <ChatAttachments attachments={attachments} />
            <HistoricalOutputs outputs={outputs} />
          </div>
        )}
        {/* 始终占位，仅悬停显现，不上下撑开排版 */}
        <div className="flex items-center gap-x-1 w-full h-7 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
          <TTSMessage
            slug={workspace?.slug}
            chatId={chatId}
            message={message}
          />
          <Actions
            message={message}
            feedbackScore={feedbackScore}
            chatId={chatId}
            slug={workspace?.slug}
            isLastMessage={isLastMessage}
            regenerateMessage={regenerateMessage}
            isEditing={isEditing}
            role={role}
            forkThread={forkThread}
            metrics={metrics}
          />
        </div>
        {supplement && (
          <HistoricalAISupplement content={supplement} />
        )}
        {relatedTopics && relatedTopics.length > 0 && (
          <HistoricalRelatedTopicsChips
            topics={relatedTopics}
            sendCommand={sendCommand}
          />
        )}
      </div>
    </div>
  );
};

export default memo(
  HistoricalMessage,
  // Skip re-render the historical message:
  // - if the content is the exact same
  // - AND (not streaming)
  // - the lastMessage status is the same (regen icon)
  // - the chatID matches between renders. (feedback icons)
  // - the metrics are the same (metrics are updated in real time)
  (prevProps, nextProps) => {
    return (
      prevProps.message === nextProps.message &&
      prevProps.isLastMessage === nextProps.isLastMessage &&
      prevProps.chatId === nextProps.chatId &&
      JSON.stringify(prevProps.metrics) === JSON.stringify(nextProps.metrics) &&
      JSON.stringify(prevProps.sources) === JSON.stringify(nextProps.sources) &&
      JSON.stringify(prevProps.clarifyingQuestions) ===
        JSON.stringify(nextProps.clarifyingQuestions) &&
      JSON.stringify(prevProps.supplement) ===
        JSON.stringify(nextProps.supplement) &&
      JSON.stringify(prevProps.relatedTopics) ===
        JSON.stringify(nextProps.relatedTopics)
    );
  }
);

/**
 * Collapsible section for AI supplement in historical messages.
 */
function HistoricalAISupplement({ content }) {
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
 * Clickable chips for related knowledge topics in historical messages.
 */
function HistoricalRelatedTopicsChips({ topics = [], sendCommand }) {
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
          key={`htopic-${idx}-${topic.title}`}
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

/**
 * Currently only renders image attachments as clickable thumbnails that open in the lightbox.
 * Other attachment types may be supported here in the future.
 */
function ChatAttachments({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      {attachments.map((item, index) => (
        <button
          type="button"
          key={item.name}
          onClick={() => openImageLightbox(attachments, index)}
          className="p-0 border-none bg-transparent cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img
            alt={`Attachment: ${item.name}`}
            src={item.contentString}
            className="w-[120px] h-[120px] object-cover rounded-lg"
          />
        </button>
      ))}
    </div>
  );
}

function TruncatableContent({ children }) {
  const contentRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const { t } = useTranslation();

  // useLayoutEffect (not useEffect) so collapse applies before paint — avoids a
  // one-frame flash of uncollapsed content on mount.
  useLayoutEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > 250);
    }
  }, []);

  const showTruncation = !isExpanded && isOverflowing;

  return (
    <>
      <div className="relative">
        <div
          ref={contentRef}
          className={showTruncation ? "max-h-[250px] overflow-hidden" : ""}
        >
          {children}
        </div>
        {showTruncation && (
          <>
            <div
              className="absolute bottom-0 left-0 right-0 h-[36px] light:hidden pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(39, 39, 42, 0.00) 0%, rgba(39, 39, 42, 0.65) 50%, #27272A 100%)",
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-[36px] hidden light:block pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(241, 245, 249, 0.00) 0%, rgba(241, 245, 249, 0.65) 50%, #F1F5F9 100%)",
              }}
            />
          </>
        )}
      </div>
      {isOverflowing && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-300 light:text-slate-700 hover:text-white light:hover:text-slate-900 text-xs font-medium leading-4 mt-2"
        >
          {isExpanded ? t("chat_window.see_less") : t("chat_window.see_more")}
        </button>
      )}
    </>
  );
}

const RenderChatContent = memo(
  ({ role, message, messageId, sources = [] }) => {
    // If the message is not from the assistant, we can render it directly
    // as normal since the user cannot think (lol)
    if (role !== "assistant")
      return (
        <div
          className="markdown prose-chat flex flex-col gap-y-1 text-white/90 light:text-slate-800"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(renderMarkdown(message)),
          }}
        />
      );
    let thoughtChain = null;
    let msgToRender = message;
    if (!message) return null;

    // If the message is a perfect thought chain, we can render it directly
    // Complete == open and close tags match perfectly.
    if (message.match(THOUGHT_REGEX_COMPLETE)) {
      thoughtChain = message.match(THOUGHT_REGEX_COMPLETE)?.[0];
      msgToRender = message.replace(THOUGHT_REGEX_COMPLETE, "");
    }

    // If the message is a thought chain but not a complete thought chain (matching opening tags but not closing tags),
    // we can render it as a thought chain if we can at least find a closing tag
    // This can occur when the assistant starts with <thinking> and then <response>'s later.
    if (
      message.match(THOUGHT_REGEX_OPEN) &&
      !message.match(THOUGHT_REGEX_CLOSE)
    ) {
      thoughtChain = message;
      msgToRender = "";
    }

    return (
      <div className="flex flex-col gap-y-3">
        {thoughtChain && (
          <ThoughtChainComponent content={thoughtChain} messageId={messageId} />
        )}
        <InlineCitedContent
          content={msgToRender}
          sources={sources}
          className="flex flex-col gap-y-1 prose-chat"
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.role === nextProps.role &&
      prevProps.message === nextProps.message &&
      prevProps.messageId === nextProps.messageId &&
      prevProps.sources === nextProps.sources
    );
  }
);
