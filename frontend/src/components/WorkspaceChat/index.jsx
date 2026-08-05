import React, { useEffect, useRef, useState } from "react";
import Workspace from "@/models/workspace";
import LoadingChat from "./LoadingChat";
import ChatContainer from "./ChatContainer";
import paths from "@/utils/paths";
import ModalWrapper from "../ModalWrapper";
import { useNavigate } from "react-router-dom";
import {
  DnDFileUploaderProvider,
  DndUploaderContext,
  PASTE_ATTACHMENT_EVENT,
} from "./ChatContainer/DnDWrapper";
import { WarningCircle } from "@phosphor-icons/react";
import {
  TTSProvider,
  useWatchForAutoPlayAssistantTTSResponse,
} from "../contexts/TTSProvider";
import {
  PENDING_HOME_MESSAGE,
  setLastWorkspaceThread,
  getLastWorkspaceThread,
  clearLastWorkspaceThread,
} from "@/utils/constants";
import useMainWorkspaceRoute from "@/hooks/useMainWorkspaceRoute";

function pickLatestThreadSlug(threads = []) {
  if (!Array.isArray(threads) || threads.length === 0) return null;
  const sorted = [...threads].sort((a, b) => {
    const ta = new Date(a.lastUpdatedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.lastUpdatedAt || b.updatedAt || 0).getTime();
    if (tb !== ta) return tb - ta;
    return (b.id || 0) - (a.id || 0);
  });
  return sorted[0]?.slug || null;
}

export default function WorkspaceChat({ loading, workspace, fillPane = false }) {
  useWatchForAutoPlayAssistantTTSResponse();
  const { threadSlug = null, isOverlay } = useMainWorkspaceRoute();
  const navigate = useNavigate();
  // Stores { key, workspace, history } currently rendered. Lags the props so
  // the previous chat stays mounted until the next one's history is ready,
  // avoiding a skeleton/loader flash on workspace/thread switches.
  const [loaded, setLoaded] = useState(null);
  const [dragging, setDragging] = useState(false);
  const pendingFilesRef = useRef([]);

  // When the thread becomes available and we have pending files, trigger upload
  useEffect(() => {
    if (loaded?.threadSlug && pendingFilesRef.current.length > 0) {
      const files = pendingFilesRef.current;
      pendingFilesRef.current = [];
      window.dispatchEvent(
        new CustomEvent(PASTE_ATTACHMENT_EVENT, { detail: { files } })
      );
    }
  }, [loaded?.threadSlug]);

  async function handleDropWithoutThread(acceptedFiles) {
    setDragging(false);
    pendingFilesRef.current = acceptedFiles;
    const { thread } = await Workspace.threads.new(workspace.slug);
    if (thread) navigate(paths.workspace.thread(workspace.slug, thread.slug));
  }

  useEffect(() => {
    async function getHistory() {
      // 设置/学习覆盖层：不要根据 URL 重拉/跳转 thread
      if (isOverlay) return;
      if (loading) return;
      if (!workspace?.slug) {
        setLoaded({ key: "none", workspace: null, history: [] });
        return false;
      }

      // 产品以 thread 为主，不再使用/展示「默认对话」(thread_id=null)。
      // 根路径仅作为跳板：有最近 thread 则跳转，否则进入空欢迎页（发消息时再建 thread）。
      if (!threadSlug) {
        let threads = [];
        try {
          const listed = await Workspace.threads.all(workspace.slug);
          threads = Array.isArray(listed?.threads) ? listed.threads : [];
        } catch {
          threads = [];
        }
        const existingSlugs = new Set(
          threads.map((t) => t.slug).filter(Boolean)
        );

        const remembered = getLastWorkspaceThread(workspace.slug);
        if (remembered && existingSlugs.has(remembered)) {
          navigate(paths.workspace.thread(workspace.slug, remembered), {
            replace: true,
          });
          return;
        }
        if (remembered && !existingSlugs.has(remembered)) {
          clearLastWorkspaceThread(workspace.slug);
        }

        const latest = pickLatestThreadSlug(threads);
        if (latest) {
          navigate(paths.workspace.thread(workspace.slug, latest), {
            replace: true,
          });
          return;
        }

        setLoaded({
          key: `${workspace.slug}:empty`,
          workspace,
          threadSlug: null,
          history: [],
        });
        return;
      }

      const { history, notFound } = await Workspace.threads.chatHistory(
        workspace.slug,
        threadSlug
      );

      // 失效 thread（删除/过期）：清缓存并回到可聊天状态
      if (notFound) {
        clearLastWorkspaceThread(workspace.slug);
        navigate(paths.workspace.chat(workspace.slug), { replace: true });
        return;
      }

      setLastWorkspaceThread(workspace.slug, threadSlug);
      setLoaded({
        key: `${workspace.slug}:${threadSlug}`,
        workspace,
        threadSlug,
        history,
      });
    }
    getHistory();
  }, [workspace, loading, threadSlug, navigate, isOverlay]);

  const hasPendingMessage = !!sessionStorage.getItem(PENDING_HOME_MESSAGE);
  if (loaded === null) {
    if (hasPendingMessage) {
      return (
        <div
          className={
            fillPane
              ? "relative bg-theme-bg-secondary w-full h-full"
              : "transition-all duration-500 relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full"
          }
        />
      );
    }
    return <LoadingChat />;
  }
  if (!loading && !workspace) {
    return (
      <>
        {loading === false && !workspace && (
          <ModalWrapper isOpen={true}>
            <div className="w-full max-w-2xl bg-theme-bg-secondary rounded-lg shadow border-2 border-theme-modal-border overflow-hidden">
              <div className="relative p-6 border-b rounded-t border-theme-modal-border">
                <div className="w-full flex gap-x-2 items-center">
                  <WarningCircle
                    className="text-red-500 w-6 h-6"
                    weight="fill"
                  />
                  <h3 className="text-xl font-semibold text-red-500 overflow-hidden overflow-ellipsis whitespace-nowrap">
                    Workspace not found
                  </h3>
                </div>
              </div>
              <div className="py-7 px-9 space-y-2 flex-col">
                <p className="text-white text-sm">
                  The workspace you're looking for is not available. It may have
                  been deleted or you may not have access to it.
                </p>
              </div>
              <div className="flex w-full justify-end items-center p-6 space-x-2 border-t border-theme-modal-border rounded-b">
                <a
                  href={paths.home()}
                  className="transition-all duration-300 bg-white text-black hover:opacity-60 px-4 py-2 rounded-lg text-sm"
                >
                  Return to homepage
                </a>
              </div>
            </div>
          </ModalWrapper>
        )}
        <LoadingChat />
      </>
    );
  }

  setEventDelegatorForCodeSnippets();

  // 合并最新 workspace 字段（如改名），避免设置页改完仍用历史快照
  const liveWorkspace =
    loaded.workspace && workspace?.slug === loaded.workspace.slug
      ? { ...loaded.workspace, ...workspace }
      : loaded.workspace;

  return (
    <TTSProvider>
      <DnDWrapper
        loaded={loaded}
        opts={{
          files: [],
          ready: true,
          dragging,
          setDragging,
          onDrop: handleDropWithoutThread,
          parseAttachments: () => [],
        }}
      >
        <ChatContainer
          key={loaded.key}
          workspace={liveWorkspace}
          threadSlug={loaded.threadSlug}
          knownHistory={loaded.history}
          fillPane={fillPane}
        />
      </DnDWrapper>
    </TTSProvider>
  );
}

function DnDWrapper({ children, loaded, opts }) {
  if (!loaded?.threadSlug) {
    return (
      <DndUploaderContext.Provider value={opts}>
        {children}
      </DndUploaderContext.Provider>
    );
  }
  return (
    <DnDFileUploaderProvider
      workspace={loaded.workspace}
      threadSlug={loaded.threadSlug}
    >
      {children}
    </DnDFileUploaderProvider>
  );
}

// Enables us to safely markdown and sanitize all responses without risk of injection
// but still be able to attach a handler to copy code snippets on all elements
// that are code snippets.
function copyCodeSnippet(uuid) {
  const target = document.querySelector(`[data-code="${uuid}"]`);
  if (!target) return false;
  const markdown =
    target.parentElement?.parentElement?.querySelector(
      "pre:first-of-type"
    )?.innerText;
  if (!markdown) return false;

  window.navigator.clipboard.writeText(markdown);
  target.classList.add("text-green-500");
  const originalText = target.innerHTML;
  target.innerText = "Copied!";
  target.setAttribute("disabled", true);

  setTimeout(() => {
    target.classList.remove("text-green-500");
    target.innerHTML = originalText;
    target.removeAttribute("disabled");
  }, 2500);
}

// Listens and hunts for all data-code-snippet clicks.
let _codeSnippetDelegatorRegistered = false;
export function setEventDelegatorForCodeSnippets() {
  if (_codeSnippetDelegatorRegistered) return;
  _codeSnippetDelegatorRegistered = true;
  document?.addEventListener("click", function (e) {
    const target = e.target.closest("[data-code-snippet]");
    const uuidCode = target?.dataset?.code;
    if (!uuidCode) return false;
    copyCodeSnippet(uuidCode);
  });
}
