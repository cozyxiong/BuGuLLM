import React, { memo, useState } from "react";
import useCopyText from "@/hooks/useCopyText";
import {
  Check,
  ThumbsUp,
  ArrowsClockwise,
  Copy,
  DotsSixVertical,
} from "@phosphor-icons/react";
import Workspace from "@/models/workspace";
import { EditMessageAction } from "./EditMessage";
import RenderMetrics from "./RenderMetrics";
import ActionMenu from "./ActionMenu";
import { useTranslation } from "react-i18next";
import { ACTION_BTN_CLASS, ACTION_ICON_SIZE } from "./actionStyles";
import { setMarkdownDragData } from "@/utils/splitMarkdownBlocks";

const Actions = ({
  message,
  feedbackScore,
  chatId,
  slug,
  isLastMessage,
  regenerateMessage,
  forkThread,
  isEditing,
  role,
  metrics = {},
  sentAt = null,
}) => {
  const { t } = useTranslation();
  const [selectedFeedback, setSelectedFeedback] = useState(feedbackScore);
  const handleFeedback = async (newFeedback) => {
    const updatedFeedback =
      selectedFeedback === newFeedback ? null : newFeedback;
    await Workspace.updateChatFeedback(chatId, slug, updatedFeedback);
    setSelectedFeedback(updatedFeedback);
  };

  return (
    <div
      className={`flex w-full items-center gap-x-2 ${
        role === "user" ? "justify-end" : "justify-between"
      }`}
    >
      <div
        className={`flex items-center gap-x-1 ${
          role === "user" ? "flex-row-reverse" : ""
        }`}
      >
        {role !== "user" && !isEditing && (
          <DragWholeReply message={message} />
        )}
        <CopyMessage message={message} />
        {/* 助手操作：拖到文档 · 复制 · 喜欢 · 重新生成 · 更多；仅用户消息可修改 */}
        {role === "user" && (
          <EditMessageAction
            chatId={chatId}
            role={role}
            isEditing={isEditing}
          />
        )}
        {chatId && role !== "user" && !isEditing && (
          <FeedbackButton
            isSelected={selectedFeedback === true}
            handleFeedback={() => handleFeedback(true)}
            tooltipContent={t("chat_window.good_response")}
            IconComponent={ThumbsUp}
          />
        )}
        {role !== "user" && isLastMessage && !isEditing && (
          <RegenerateMessage
            regenerateMessage={regenerateMessage}
            chatId={chatId}
          />
        )}
        <ActionMenu
          chatId={chatId}
          forkThread={forkThread}
          isEditing={isEditing}
          role={role}
        />
      </div>
      {role !== "user" ? (
        <RenderMetrics metrics={metrics} sentAt={sentAt} />
      ) : null}
    </div>
  );
};

function FeedbackButton({ isSelected, handleFeedback, tooltipContent, IconComponent }) {
  return (
    <button
      type="button"
      onClick={handleFeedback}
      data-tooltip-id="feedback-button"
      data-tooltip-content={tooltipContent}
      className={ACTION_BTN_CLASS}
      aria-label={tooltipContent}
    >
      <IconComponent
        size={ACTION_ICON_SIZE}
        weight={isSelected ? "fill" : "regular"}
      />
    </button>
  );
}

function DragWholeReply({ message }) {
  if (!message) return null;
  return (
    <button
      type="button"
      draggable
      aria-label="拖动"
      data-tooltip-id="drag-assistant-text"
      data-tooltip-content="拖动"
      className={`${ACTION_BTN_CLASS} bagu-reply-drag-btn`}
      onClick={(event) => event.preventDefault()}
      onDragStart={(event) => {
        event.currentTarget.closest(".group")?.classList.add("bagu-reply-dragging");
        setMarkdownDragData(event, message);
      }}
      onDragEnd={(event) => {
        event.currentTarget
          .closest(".group")
          ?.classList.remove("bagu-reply-dragging");
      }}
    >
      <DotsSixVertical size={ACTION_ICON_SIZE} weight="bold" />
    </button>
  );
}

function CopyMessage({ message }) {
  const { copied, copyText } = useCopyText();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => copyText(message)}
      data-tooltip-id="copy-assistant-text"
      data-tooltip-content={t("chat_window.copy")}
      className={ACTION_BTN_CLASS}
      aria-label={t("chat_window.copy")}
    >
      {copied ? (
        <Check size={ACTION_ICON_SIZE} weight="regular" />
      ) : (
        <Copy size={ACTION_ICON_SIZE} weight="regular" />
      )}
    </button>
  );
}

function RegenerateMessage({ regenerateMessage, chatId }) {
  const { t } = useTranslation();
  if (!chatId) return null;
  return (
    <button
      type="button"
      onClick={() => regenerateMessage(chatId)}
      data-tooltip-id="regenerate-assistant-text"
      data-tooltip-content={t("chat_window.regenerate_response")}
      className={ACTION_BTN_CLASS}
      aria-label={t("chat_window.regenerate")}
    >
      <ArrowsClockwise size={ACTION_ICON_SIZE} weight="regular" />
    </button>
  );
}

export default memo(Actions);
