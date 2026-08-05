import { useEffect, useState, useRef, Fragment } from "react";
import { getWorkspaceSystemPrompt } from "@/utils/chat";
import { useTranslation } from "react-i18next";
import SystemPromptVariable from "@/models/systemPromptVariable";
import Highlighter from "react-highlight-words";
import { Link, useSearchParams } from "react-router-dom";
import paths from "@/utils/paths";
import ChatPromptHistory from "./ChatPromptHistory";
import PublishEntityModal from "@/components/CommunityHub/PublishEntityModal";
import { useModal } from "@/hooks/useModal";
import System from "@/models/system";
import { ClockCounterClockwise } from "@phosphor-icons/react";

export default function ChatPromptSettings({
  workspace,
  setHasChanges,
  hasChanges,
}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Prompt state
  const initialPrompt = getWorkspaceSystemPrompt(workspace);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [savedPrompt, setSavedPrompt] = useState(initialPrompt);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState("");

  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [availableVariables, setAvailableVariables] = useState([]);

  // Refs
  const promptRef = useRef(null);
  const promptHistoryRef = useRef(null);
  const historyButtonRef = useRef(null);

  // Modals
  const {
    isOpen: showPublishModal,
    closeModal: closePublishModal,
    openModal: openPublishModal,
  } = useModal();

  // Derived state
  const isDirty = prompt !== savedPrompt;
  const hasBeenModified = savedPrompt?.trim() !== initialPrompt?.trim();
  const showPublishButton =
    !isEditing && prompt?.trim().length >= 10 && (isDirty || hasBeenModified);

  // Load variables and handle focus on mount
  useEffect(() => {
    async function setupVariableHighlighting() {
      const { variables } = await SystemPromptVariable.getAll();
      setAvailableVariables(variables);
    }
    setupVariableHighlighting();
    if (searchParams.get("action") === "focus-system-prompt")
      setIsEditing(true);
  }, [searchParams]);

  // Update saved prompt when parent clears hasChanges
  useEffect(() => {
    if (!hasChanges) setSavedPrompt(prompt);
  }, [hasChanges, prompt]);

  // Auto-focus textarea when editing
  useEffect(() => {
    if (isEditing && promptRef.current) {
      promptRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    System.fetchDefaultSystemPrompt().then(({ defaultSystemPrompt }) =>
      setDefaultSystemPrompt(defaultSystemPrompt)
    );
  }, []);

  // Handle click outside for history panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        promptHistoryRef.current &&
        !promptHistoryRef.current.contains(event.target) &&
        historyButtonRef.current &&
        !historyButtonRef.current.contains(event.target)
      ) {
        setShowPromptHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRestoreFromHistory = (historicalPrompt) => {
    setPrompt(historicalPrompt);
    setShowPromptHistory(false);
    setHasChanges(true);
  };

  const handlePublishFromHistory = (historicalPrompt) => {
    openPublishModal();
    setShowPromptHistory(false);
    setTimeout(() => setPrompt(historicalPrompt), 0);
  };

  // Restore to default system prompt, if no default system prompt is set
  const handleRestoreToDefaultSystemPrompt = () => {
    System.fetchDefaultSystemPrompt().then(({ defaultSystemPrompt }) => {
      setPrompt(defaultSystemPrompt);
      setHasChanges(true);
    });
  };

  return (
    <>
      <ChatPromptHistory
        ref={promptHistoryRef}
        workspaceSlug={workspace.slug}
        show={showPromptHistory}
        onRestore={handleRestoreFromHistory}
        onPublishClick={handlePublishFromHistory}
        onClose={() => setShowPromptHistory(false)}
      />
      <div className="flex flex-col gap-y-[8px]">
        <div className="flex flex-col gap-y-[8px]">
          <div className="flex items-center justify-between">
            <label htmlFor="name" className="block input-label">
              {t("chat.prompt.title")}
            </label>
          </div>
          <p className="text-white text-opacity-60 text-xs font-medium">
            {t("chat.prompt.description")}
          </p>
        </div>

        {/* 变量说明 + 历史按钮；与下方输入框紧�?*/}
        <div className="flex flex-col gap-y-0">
          <div className="flex items-start justify-between gap-3">
            <p
              className="text-white text-opacity-60 text-xs font-medium min-w-0 flex-1 leading-relaxed"
              style={{ marginTop: 0, marginBottom: 0 }}
            >
              可以插入{" "}
              <Link
                to={paths.settings.systemPromptVariables()}
                className="text-primary-button"
              >
                系统提示变量
              </Link>
              ，例如：{" "}
              {availableVariables.slice(0, 3).map((v, i) => (
                <Fragment key={v.key}>
                  <span className="bg-theme-settings-input-bg px-1 py-0.5 rounded">
                    {`{${v.key}}`}
                  </span>
                  {i < availableVariables.length - 1 &&
                    i < 2 &&
                    "、"}
                </Fragment>
              ))}
              {availableVariables.length > 3 && (
                <Link
                  to={paths.settings.systemPromptVariables()}
                  className="text-primary-button"
                >
                  还有 {availableVariables.length - 3} 个…
                </Link>
              )}
            </p>
            <button
              ref={historyButtonRef}
              type="button"
              className={[
                "shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer",
                showPromptHistory
                  ? "border-white/15 bg-white/[0.08] text-white light:border-theme-modal-border light:bg-black/[0.05] light:text-theme-text-primary"
                  : "border-white/[0.08] bg-transparent text-white/50 hover:text-white/85 hover:bg-white/[0.04] light:border-theme-modal-border light:text-theme-text-secondary light:hover:text-theme-text-primary light:hover:bg-black/[0.03]",
              ].join(" ")}
              onClick={(e) => {
                e.preventDefault();
                setShowPromptHistory(!showPromptHistory);
              }}
            >
              <ClockCounterClockwise size={13} weight="regular" />
              {showPromptHistory ? "收起历史" : "查看历史"}
            </button>
          </div>

          <input type="hidden" name="openAiPrompt" value={prompt} />
          <div className="relative w-full flex flex-col items-end">
            <div className="relative w-full">
              {isEditing ? (
                <textarea
                  ref={promptRef}
                  autoFocus={true}
                  rows={5}
                  onFocus={(e) => {
                    const length = e.target.value.length;
                    e.target.setSelectionRange(length, length);
                  }}
                  onBlur={(e) => {
                    setIsEditing(false);
                    setPrompt(e.target.value);
                  }}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setHasChanges(true);
                  }}
                  onPaste={(e) => {
                    setPrompt(e.target.value);
                    setHasChanges(true);
                  }}
                  style={{
                    resize: "vertical",
                    overflowY: "scroll",
                    minHeight: "150px",
                  }}
                  defaultValue={prompt}
                  className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg focus:outline-none active:outline-none outline-none block w-full p-2.5 mt-0"
                />
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  style={{
                    resize: "vertical",
                    overflowY: "scroll",
                    minHeight: "150px",
                  }}
                  className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg focus:outline-none active:outline-none outline-none block w-full p-2.5 mt-0"
                >
                  <Highlighter
                    className="whitespace-pre-wrap"
                    highlightClassName="bg-cta-button p-0.5 rounded-md"
                    searchWords={availableVariables.map((v) => `{${v.key}}`)}
                    autoEscape={true}
                    caseSensitive={true}
                    textToHighlight={prompt}
                  />
                </div>
              )}
            </div>
            <div className="w-full flex flex-row items-center justify-between pt-2">
              {prompt !== defaultSystemPrompt && (
                <button
                  type="button"
                  onClick={handleRestoreToDefaultSystemPrompt}
                  className="text-theme-text-primary hover:text-white light:hover:text-black text-xs font-medium"
                >
                  恢复为默认
                </button>
              )}
              <PublishPromptCTA
                hidden={!showPublishButton}
                onClick={openPublishModal}
              />
            </div>
          </div>
        </div>
      </div>
      <PublishEntityModal
        show={showPublishModal}
        onClose={closePublishModal}
        entityType="system-prompt"
        entity={prompt}
      />
    </>
  );
}

function PublishPromptCTA({ hidden = false, onClick }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-none text-primary-button hover:text-white light:hover:text-black text-xs font-medium"
    >
      发布到社区
    </button>
  );
}
