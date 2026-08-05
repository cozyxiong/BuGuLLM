import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import debounce from "lodash.debounce";
import { ArrowUp, CaretDown, Check } from "@phosphor-icons/react";
import StopGenerationButton from "./StopGenerationButton";
import SpeechToText from "./SpeechToText";
import { Tooltip } from "react-tooltip";
import AttachmentManager from "./Attachments";
import AttachItem from "./AttachItem";
import {
  ATTACHMENTS_PROCESSED_EVENT,
  ATTACHMENTS_PROCESSING_EVENT,
  PASTE_ATTACHMENT_EVENT,
} from "../DnDWrapper";
import useTextSize from "@/hooks/useTextSize";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import usePromptInputStorage from "@/hooks/usePromptInputStorage";
import ToolsMenu, { TOOLS_MENU_KEYBOARD_EVENT } from "./ToolsMenu";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";

const CHAT_MODE_OPTIONS = [
  { value: "query", labelKey: "chat.mode.query.title" },
  { value: "assistant", labelKey: "chat.mode.assistant.title" },
];

export const PROMPT_INPUT_ID = "primary-prompt-input";
export const PROMPT_INPUT_EVENT = "set_prompt_input";
const MAX_EDIT_STACK_SIZE = 100;

/**
 * @param {Workspace} props.workspace - workspace object
 * @param {function} props.submit - form submit handler
 * @param {boolean} props.isStreaming - disables input while streaming response
 * @param {function} props.sendCommand - handler for slash commands and agent mentions
 * @param {Array} [props.attachments] - file attachments array
 * @param {boolean} [props.centered] - renders in centered layout mode (for home page)
 * @param {string} [props.workspaceSlug] - workspace slug for home page context
 * @param {string} [props.threadSlug] - thread slug for home page context
 */
export default function PromptInput({
  workspace = {},
  submit,
  isStreaming,
  sendCommand,
  attachments = [],
  centered = false,
  workspaceSlug = null,
  threadSlug = null,
}) {
  const { t } = useTranslation();
  const { isDisabled } = useIsDisabled();
  const [promptInput, setPromptInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const autoOpenedToolsRef = useRef(false);
  const toolsHighlightRef = useRef(-1);
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const [_, setFocused] = useState(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const { textSizeClass } = useTextSize();

  // Synchronizes prompt input value with localStorage, scoped to the current thread.
  usePromptInputStorage({
    promptInput,
    setPromptInput,
  });

  /**
   * To prevent too many re-renders we remotely listen for updates from the parent
   * via an event cycle. Otherwise, using message as a prop leads to a re-render every
   * change on the input.
   * @param {{detail: {messageContent: string, writeMode: 'replace' | 'append'}}} e
   */
  function handlePromptUpdate(e) {
    const { messageContent, writeMode = "replace" } = e?.detail ?? {};
    if (writeMode === "append") setPromptInput((prev) => prev + messageContent);
    else if (writeMode === "prepend")
      setPromptInput((prev) => messageContent + " " + prev);
    else setPromptInput(messageContent ?? "");
  }

  useEffect(() => {
    if (!!window)
      window.addEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
    return () =>
      window?.removeEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
  }, []);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) textareaRef.current.focus();
    resetTextAreaHeight();
  }, [isStreaming]);

  /**
   * Save the current state before changes
   * @param {number} adjustment
   */
  function saveCurrentState(adjustment = 0) {
    if (undoStack.current.length >= MAX_EDIT_STACK_SIZE)
      undoStack.current.shift();
    undoStack.current.push({
      value: promptInput,
      cursorPositionStart: textareaRef.current.selectionStart + adjustment,
      cursorPositionEnd: textareaRef.current.selectionEnd + adjustment,
    });
  }
  const debouncedSaveState = debounce(saveCurrentState, 250);

  function handleSubmit(e) {
    // Ignore submits from portaled modals (slash command preset forms)
    if (e.target !== e.currentTarget) return;
    setFocused(false);
    setShowTools(false);
    submit(e);
  }

  function resetTextAreaHeight() {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
  }

  /**
   * Capture enter key press to handle submission, redo, or undo
   * via keyboard shortcuts
   * @param {KeyboardEvent} event
   */
  function captureEnterOrUndo(event) {
    // Forward keyboard events to the ToolsMenu when open
    if (showTools) {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(TOOLS_MENU_KEYBOARD_EVENT, {
            detail: { key: event.key },
          })
        );
        return;
      }
      // When an item is highlighted via arrow keys, Enter selects it.
      // Otherwise, Enter falls through to submit the form normally.
      if (event.key === "Enter" && toolsHighlightRef.current >= 0) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(TOOLS_MENU_KEYBOARD_EVENT, {
            detail: { key: "Enter" },
          })
        );
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setShowTools(false);
        textareaRef.current?.focus();
        return;
      }
    }

    // "/" toggles the Tools menu only when the input is empty
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      promptInput.trim() === ""
    ) {
      setShowTools((prev) => {
        autoOpenedToolsRef.current = !prev;
        return !prev;
      });
      return;
    }

    // Is simple enter key press w/o shift key
    if (event.keyCode === 13 && !event.shiftKey) {
      event.preventDefault();
      if (isStreaming || isDisabled) return; // Prevent submission if streaming or disabled
      setShowTools(false);
      return submit(event);
    }

    // Is undo with Ctrl+Z or Cmd+Z + Shift key = Redo
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      event.shiftKey
    ) {
      event.preventDefault();
      if (redoStack.current.length === 0) return;

      const nextState = redoStack.current.pop();
      if (!nextState) return;

      undoStack.current.push({
        value: promptInput,
        cursorPositionStart: textareaRef.current.selectionStart,
        cursorPositionEnd: textareaRef.current.selectionEnd,
      });
      setPromptInput(nextState.value);
      setTimeout(() => {
        textareaRef.current.setSelectionRange(
          nextState.cursorPositionStart,
          nextState.cursorPositionEnd
        );
      }, 0);
    }

    // Undo with Ctrl+Z or Cmd+Z
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      !event.shiftKey
    ) {
      if (undoStack.current.length === 0) return;
      const lastState = undoStack.current.pop();
      if (!lastState) return;

      redoStack.current.push({
        value: promptInput,
        cursorPositionStart: textareaRef.current.selectionStart,
        cursorPositionEnd: textareaRef.current.selectionEnd,
      });
      setPromptInput(lastState.value);
      setTimeout(() => {
        textareaRef.current.setSelectionRange(
          lastState.cursorPositionStart,
          lastState.cursorPositionEnd
        );
      }, 0);
    }
  }

  function adjustTextArea(event) {
    const element = event.target;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  function handlePasteEvent(e) {
    e.preventDefault();
    if (e.clipboardData.items.length === 0) return false;

    // paste any clipboard items that are images.
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        window.dispatchEvent(
          new CustomEvent(PASTE_ATTACHMENT_EVENT, {
            detail: { files: [file] },
          })
        );
        continue;
      }

      // handle files specifically that are not images as uploads
      if (item.kind === "file") {
        const file = item.getAsFile();
        window.dispatchEvent(
          new CustomEvent(PASTE_ATTACHMENT_EVENT, {
            detail: { files: [file] },
          })
        );
        continue;
      }
    }

    const pasteText = e.clipboardData.getData("text/plain");
    if (pasteText) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newPromptInput =
        promptInput.substring(0, start) +
        pasteText +
        promptInput.substring(end);
      setPromptInput(newPromptInput);

      // Set the cursor position after the pasted text
      // we need to use setTimeout to prevent the cursor from being set to the end of the text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          start + pasteText.length;
        adjustTextArea({ target: textarea });
      }, 0);
    }
    return;
  }

  function handleChange(e) {
    debouncedSaveState(-1);
    adjustTextArea(e);
    const value = e.target.value;
    setPromptInput(value);

    // Auto-dismiss the tools menu when the "/" that opened it is modified
    if (autoOpenedToolsRef.current && showTools && value !== "/") {
      setShowTools(false);
      autoOpenedToolsRef.current = false;
    }
  }

  return (
    <div
      id="prompt-input-wrapper"
      className={
        centered
          ? "w-full relative flex justify-center items-center"
          : "w-full fixed md:absolute bottom-0 left-0 z-10 flex justify-center items-center pwa:pb-5"
      }
    >
      <form
        onSubmit={handleSubmit}
        className={
          centered
            ? "flex flex-col gap-y-1 rounded-t-lg w-full items-center"
            : "flex flex-col gap-y-1 rounded-t-lg md:w-full w-full mx-auto max-w-[750px] items-center"
        }
      >
        <div
          className={`flex items-center rounded-lg md:w-full ${centered ? "mb-0" : "mb-4"}`}
        >
          <div className="relative w-[95vw] md:w-[750px]">
            <ToolsMenu
              workspace={workspace}
              showing={showTools}
              setShowing={setShowTools}
              sendCommand={sendCommand}
              promptRef={textareaRef}
              centered={centered}
              highlightedIndexRef={toolsHighlightRef}
            />
            <div
              className={[
                "rounded-[22px] pwa:rounded-3xl flex flex-col px-4 sm:px-5 overflow-hidden",
                "bg-[var(--theme-bg-chat-input,#27282a)] light:bg-white",
                "border border-white/[0.08] light:border-slate-200/90",
                "shadow-[0_8px_32px_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,255,255,0.02)_inset]",
                "light:shadow-[0_8px_28px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.03)_inset]",
              ].join(" ")}
            >
              <AttachmentManager attachments={attachments} />
              <div className="flex items-center">
                <textarea
                  id={PROMPT_INPUT_ID}
                  ref={textareaRef}
                  onChange={handleChange}
                  onKeyDown={captureEnterOrUndo}
                  onPaste={(e) => {
                    saveCurrentState();
                    handlePasteEvent(e);
                  }}
                  required={true}
                  onFocus={() => setFocused(true)}
                  onBlur={(e) => {
                    setFocused(false);
                    adjustTextArea(e);
                  }}
                  value={promptInput}
                  spellCheck={Appearance.get("enableSpellCheck")}
                  className={`border-none cursor-text max-h-[50vh] md:max-h-[350px] md:min-h-[40px] pt-[18px] w-full leading-6 text-white/95 light:text-slate-700 bg-transparent placeholder:text-white/35 light:placeholder:text-slate-400/80 resize-none active:outline-none focus:outline-none flex-grow pwa:!text-[16px] ${textSizeClass}`}
                  placeholder={t("chat_window.send_message")}
                />
              </div>
              <div className="flex justify-between items-center pt-2.5 pb-2.5">
                <div className="flex items-center gap-x-0.5">
                  <div className="flex items-center gap-x-1">
                    <AttachItem
                      workspaceSlug={workspaceSlug}
                      workspaceThreadSlug={threadSlug}
                    />
                  </div>
                  <ToolsButton
                    showTools={showTools}
                    setShowTools={setShowTools}
                    textareaRef={textareaRef}
                    autoOpenedToolsRef={autoOpenedToolsRef}
                  />
                  <ChatModeButton
                    workspace={workspace}
                    disabled={isStreaming}
                  />
                </div>
                <div className="flex gap-x-2 items-center">
                  <SpeechToText sendCommand={sendCommand} />
                  {isStreaming ? (
                    <StopGenerationButton />
                  ) : (
                    <SendPromptButton
                      formRef={formRef}
                      promptInput={promptInput}
                      isDisabled={isDisabled}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function ToolsButton({
  showTools,
  setShowTools,
  textareaRef,
  autoOpenedToolsRef,
}) {
  const { t } = useTranslation();

  return (
    <button
      id="tools-btn"
      type="button"
      onClick={() => {
        autoOpenedToolsRef.current = false;
        setShowTools(!showTools);
        textareaRef.current?.focus();
      }}
      className={`group border-none cursor-pointer flex items-center justify-center h-7 px-2.5 rounded-full transition-colors ${
        showTools
          ? "bg-white/10 light:bg-slate-200"
          : "hover:bg-white/8 light:hover:bg-slate-100"
      }`}
    >
      <span
        className={`text-[13px] font-medium ${
          showTools
            ? "text-white light:text-slate-800"
            : "text-white/55 light:text-slate-500 group-hover:text-white/85 light:group-hover:text-slate-700"
        }`}
      >
        {t("chat_window.tools")}
      </span>
    </button>
  );
}

function normalizeChatMode(mode) {
  if (mode === "chat") return "query";
  if (mode === "automatic") return "assistant";
  if (mode === "assistant" || mode === "query") return mode;
  return "query";
}

/**
 * 工具按钮右侧：问答 / 助手模式切换（写入 workspace.chatMode）
 * 菜单用 portal 挂到 body，避免输入框 overflow-hidden 裁切。
 */
function ChatModeButton({ workspace, disabled = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(() =>
    normalizeChatMode(workspace?.chatMode || "query")
  );
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (workspace?.chatMode)
      setMode(normalizeChatMode(workspace.chatMode));
  }, [workspace?.chatMode]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuHeight = menuEl?.offsetHeight || 120;
      const menuWidth = menuEl?.offsetWidth || 120;
      const gap = 6;
      // 优先在按钮上方；空间不够则翻到下方
      let top = rect.top - menuHeight - gap;
      if (top < 8) top = rect.bottom + gap;
      let left = rect.left;
      // 右边界防溢出
      if (left + menuWidth > window.innerWidth - 8) {
        left = Math.max(8, rect.right - menuWidth);
      }
      setMenuPos({ top, left });
    }

    updatePosition();
    // 菜单渲染后量一次真实高度再校正
    requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (
        menuRef.current?.contains(e.target) ||
        buttonRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current =
    CHAT_MODE_OPTIONS.find((o) => o.value === mode) || CHAT_MODE_OPTIONS[0];
  const slug = workspace?.slug;

  async function selectMode(next) {
    if (!slug || next === mode || saving) {
      setOpen(false);
      return;
    }
    const prev = mode;
    setMode(next);
    setOpen(false);
    setSaving(true);
    try {
      const { workspace: updated, message } = await Workspace.update(slug, {
        chatMode: next,
      });
      if (message || !updated) {
        setMode(prev);
        showToast(message || "模式切换失败", "error", { clear: true });
      }
    } catch (e) {
      setMode(prev);
      showToast(e?.message || "模式切换失败", "error", { clear: true });
    } finally {
      setSaving(false);
    }
  }

  if (!slug) return null;

  const menu = open
    ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[200]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(false)}
          />
          <div
            ref={menuRef}
            role="listbox"
            aria-label={t("chat.mode.title")}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[201] min-w-[108px] py-1 rounded-lg bg-zinc-800 light:bg-white border border-zinc-700 light:border-slate-300 shadow-lg"
          >
            {CHAT_MODE_OPTIONS.map((opt) => {
              const selected = opt.value === mode;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectMode(opt.value)}
                  className={`border-none w-full flex items-center justify-between gap-x-3 px-3 py-1.5 text-left text-sm cursor-pointer ${
                    selected
                      ? "bg-zinc-700/80 text-white light:bg-slate-100 light:text-slate-900"
                      : "text-zinc-300 light:text-slate-700 hover:bg-zinc-700/50 light:hover:bg-slate-100"
                  }`}
                >
                  <span className="font-medium">{t(opt.labelKey)}</span>
                  {selected && (
                    <Check
                      size={14}
                      weight="bold"
                      className="text-emerald-400 light:text-emerald-600 shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        id="chat-mode-btn"
        type="button"
        disabled={disabled || saving}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("chat.mode.title")}
        data-tooltip-id="chat-mode-tooltip"
        data-tooltip-content={t("chat.mode.title")}
        className={`group border-none cursor-pointer flex items-center justify-center gap-x-0.5 h-7 px-2.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "bg-white/10 light:bg-slate-200"
            : "hover:bg-white/8 light:hover:bg-slate-100"
        }`}
      >
        <span
          className={`text-[13px] font-medium ${
            open
              ? "text-white light:text-slate-800"
              : "text-white/55 light:text-slate-500 group-hover:text-white/85 light:group-hover:text-slate-700"
          }`}
        >
          {t(current.labelKey)}
        </span>
        <CaretDown
          size={11}
          weight="bold"
          className={
            open
              ? "text-white light:text-slate-800"
              : "text-white/35 light:text-slate-400 group-hover:text-white/70 light:group-hover:text-slate-600"
          }
        />
      </button>
      <Tooltip
        id="chat-mode-tooltip"
        place="top"
        delayShow={350}
        className="tooltip !text-xs z-99"
      />
      {menu}
    </>
  );
}

function SendPromptButton({ formRef, promptInput, isDisabled }) {
  const { t } = useTranslation();

  return (
    <>
      <button
        ref={formRef}
        type="submit"
        disabled={isDisabled || !promptInput.trim().length}
        className={`border-none flex justify-center items-center rounded-full w-8 h-8 transition-all duration-200 ${
          promptInput.trim().length && !isDisabled
            ? "cursor-pointer bg-white text-zinc-900 hover:bg-white/90 light:bg-slate-900 light:text-white light:hover:bg-slate-700 shadow-sm"
            : "cursor-not-allowed bg-white/10 light:bg-slate-200 text-white/30"
        }`}
        data-tooltip-id="send-prompt"
        data-tooltip-content={
          isDisabled
            ? t("chat_window.attachments_processing")
            : t("chat_window.send")
        }
        aria-label={t("chat_window.send")}
      >
        <ArrowUp
          className="w-[18px] h-[18px] pointer-events-none text-zinc-800 light:text-white"
          weight="bold"
        />
        <span className="sr-only">{t("chat_window.send")}</span>
      </button>
      <Tooltip
        id="send-prompt"
        place="bottom"
        delayShow={300}
        className="tooltip !text-xs z-99"
      />
    </>
  );
}

/**
 * Handle event listeners to prevent the send button from being used
 * for whatever reason that may we may want to prevent the user from sending a message.
 */
function useIsDisabled() {
  const [isDisabled, setIsDisabled] = useState(false);

  /**
   * Handle attachments processing and processed events
   * to prevent the send button from being clicked when attachments are processing
   * or else the query may not have relevant context since RAG is not yet ready.
   */
  useEffect(() => {
    if (!window) return;
    const onProcessing = () => setIsDisabled(true);
    const onProcessed = () => setIsDisabled(false);

    window.addEventListener(ATTACHMENTS_PROCESSING_EVENT, onProcessing);
    window.addEventListener(ATTACHMENTS_PROCESSED_EVENT, onProcessed);

    return () => {
      window.removeEventListener(ATTACHMENTS_PROCESSING_EVENT, onProcessing);
      window.removeEventListener(ATTACHMENTS_PROCESSED_EVENT, onProcessed);
    };
  }, []);

  return { isDisabled };
}
