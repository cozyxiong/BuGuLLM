import { PencilSimple } from "@phosphor-icons/react";
import { useRef, useEffect } from "react";
import Appearance from "@/models/appearance";
import { useTranslation } from "react-i18next";
import {
  useMessageActionsContext,
  EDIT_EVENT,
} from "@/components/WorkspaceChat/ChatContainer/ChatHistory/MessageActionsContext";
import { ACTION_BTN_CLASS, ACTION_ICON_SIZE } from "../actionStyles";

export function useEditMessage({ chatId, role }) {
  const context = useMessageActionsContext();
  const isEditing = context?.isEditing(chatId, role) ?? false;
  return { isEditing };
}

export function EditMessageAction({ chatId = null, role, isEditing }) {
  const { t } = useTranslation();
  function handleEditClick() {
    window.dispatchEvent(
      new CustomEvent(EDIT_EVENT, { detail: { chatId, role } })
    );
  }

  if (!chatId || isEditing) return null;
  const label =
    role === "user"
      ? t("chat_window.edit_prompt")
      : t("chat_window.edit_response");
  return (
    <button
      type="button"
      onClick={handleEditClick}
      data-tooltip-id="edit-input-text"
      data-tooltip-content={label}
      className={ACTION_BTN_CLASS}
      aria-label={label}
    >
      <PencilSimple size={ACTION_ICON_SIZE} weight="regular" />
    </button>
  );
}

export function EditMessageForm({
  role,
  chatId,
  message,
  attachments = [],
  adjustTextArea,
  saveChanges,
}) {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const isUser = role === "user";

  function handleSubmit(e) {
    e.preventDefault();
    const editedMessage = formRef.current.value;
    saveChanges({ editedMessage, chatId, role, attachments });
    window.dispatchEvent(
      new CustomEvent(EDIT_EVENT, { detail: { chatId, role, attachments } })
    );
  }

  function handleSave() {
    const editedMessage = formRef.current.value;
    saveChanges({
      editedMessage,
      chatId,
      role,
      attachments,
      saveOnly: true,
    });
    window.dispatchEvent(
      new CustomEvent(EDIT_EVENT, { detail: { chatId, role, attachments } })
    );
  }

  function cancelEdits() {
    window.dispatchEvent(
      new CustomEvent(EDIT_EVENT, { detail: { chatId, role, attachments } })
    );
  }

  useEffect(() => {
    if (!formRef?.current) return;
    const el = formRef.current;
    el.focus();
    const len = el.value?.length ?? 0;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
    adjustTextArea({ target: el });
  }, []);

  const btnGhost =
    "border-none bg-transparent cursor-pointer h-8 px-3 rounded-full text-[13px] font-medium text-white/55 light:text-slate-500 hover:text-white/85 light:hover:text-slate-800 hover:bg-white/5 light:hover:bg-slate-100 transition-colors";
  const btnPrimary =
    "border-none cursor-pointer h-8 px-4 rounded-full text-[13px] font-semibold bg-white text-zinc-900 hover:bg-white/90 light:bg-zinc-900 light:text-white light:hover:bg-zinc-800 transition-colors shadow-sm";

  if (isUser) {
    // 用户消息修改：按钮放在气泡框内右下角
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex flex-col items-end w-full max-w-[600px]"
      >
        <div className="w-full bg-zinc-800 light:bg-slate-100 rounded-[20px] rounded-br-none px-4 pt-3 pb-2.5 border border-white/10 light:border-slate-200/80 focus-within:border-white/20 light:focus-within:border-slate-300 transition-colors">
          <textarea
            ref={formRef}
            name="editedMessage"
            spellCheck={Appearance.get("enableSpellCheck")}
            rows={1}
            className="w-full min-h-[24px] max-h-[40vh] bg-transparent border-none outline-none resize-none overflow-y-auto text-[15px] leading-6 text-white light:text-slate-800 p-0 m-0 focus:ring-0 focus:outline-none"
            defaultValue={message}
            onChange={adjustTextArea}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEdits();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button type="button" onClick={cancelEdits} className={btnGhost}>
              {t("chat_window.cancel")}
            </button>
            <button type="submit" className={btnPrimary}>
              {t("chat_window.save")}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col w-full max-w-[750px]"
    >
      <div className="w-full rounded-2xl px-3.5 pt-2.5 pb-2 border border-white/10 light:border-slate-200/80 bg-white/[0.03] light:bg-black/[0.02] focus-within:border-white/20 light:focus-within:border-slate-300 transition-colors">
        <textarea
          ref={formRef}
          name="editedMessage"
          spellCheck={Appearance.get("enableSpellCheck")}
          rows={2}
          className="w-full min-h-[48px] max-h-[50vh] bg-transparent border-none outline-none resize-none overflow-y-auto text-[15px] leading-6 text-white/90 light:text-slate-800 p-0 m-0 focus:ring-0 focus:outline-none"
          defaultValue={message}
          onChange={adjustTextArea}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEdits();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button type="button" onClick={cancelEdits} className={btnGhost}>
            {t("chat_window.cancel")}
          </button>
          <button type="submit" className={btnPrimary}>
            {t("chat_window.save")}
          </button>
        </div>
      </div>
    </form>
  );
}
