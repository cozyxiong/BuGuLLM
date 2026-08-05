import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChatCircleDots, PaperPlaneRight, X } from "@phosphor-icons/react";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";
import {
  PENDING_HOME_MESSAGE,
  getLastWorkspaceThread,
  clearLastWorkspaceThread,
} from "@/utils/constants";
import paths from "@/utils/paths";
import Workspace from "@/models/workspace";

/**
 * 浮动对话（锚定右侧内容区）：
 * fab     — 右下角圆形入口
 * compose — 内容区正下方一行简洁毛玻璃输入条
 * full    — 由主内容区铺满渲染（本组件返回 null）
 */
export default function FloatingChat() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { chatMode, setChatMode } = useWorkspaceUI();
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  /** 单击延迟定时器；在窗口内再次点击视为双击进全屏 */
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);

  /**
   * 进入全屏对话：优先恢复本工作区最近 thread（历史在 thread 上，不在默认 workspace 根路径）
   */
  const goFullChat = async (pendingMessage = null) => {
    if (pendingMessage) {
      sessionStorage.setItem(
        PENDING_HOME_MESSAGE,
        JSON.stringify({ message: pendingMessage, attachments: [] })
      );
    }
    setChatMode("full");
    if (!slug) return;

    let threads = [];
    try {
      const listed = await Workspace.threads.all(slug);
      threads = Array.isArray(listed?.threads) ? listed.threads : [];
    } catch {
      threads = [];
    }
    const existingSlugs = new Set(threads.map((t) => t.slug).filter(Boolean));

    const remembered = getLastWorkspaceThread(slug);
    if (remembered && existingSlugs.has(remembered)) {
      navigate(paths.workspace.thread(slug, remembered), { replace: true });
      return;
    }
    if (remembered && !existingSlugs.has(remembered)) {
      clearLastWorkspaceThread(slug);
    }

    if (threads.length > 0) {
      const sorted = [...threads].sort((a, b) => {
        const ta = new Date(a.lastUpdatedAt || a.updatedAt || 0).getTime();
        const tb = new Date(b.lastUpdatedAt || b.updatedAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b.id || 0) - (a.id || 0);
      });
      const t = sorted[0];
      if (t?.slug) {
        navigate(paths.workspace.thread(slug, t.slug), { replace: true });
        return;
      }
    }

    navigate(paths.workspace.chat(slug), { replace: true });
  };

  useEffect(() => {
    if (chatMode === "compose") {
      const t = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
  }, [chatMode]);

  useEffect(() => {
    if (chatMode !== "compose") return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setChatMode("fab");
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatMode, setChatMode]);

  const openCompose = () => setChatMode("compose");
  /** 双击直接进入全屏对话（恢复最近 thread，避免历史空白） */
  const openFull = () => {
    setDraft("");
    goFullChat();
  };

  /**
   * 自管双击：系统 dblclick 在第一次 click 延迟打开 compose 后按钮已卸载，永远触发不了。
   * 第一次 click 启动延迟；窗口内第二次 click 取消延迟并 openFull。
   */
  const handleFabClick = (e) => {
    e.preventDefault();
    clickCountRef.current += 1;

    if (clickCountRef.current >= 2) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      clickCountRef.current = 0;
      openFull();
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      clickCountRef.current = 0;
      openCompose();
    }, 320);
  };

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);
  const collapse = () => {
    setChatMode("fab");
    setDraft("");
  };

  const submitCompose = (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    goFullChat(text);
  };

  // —— FAB（单击输入条 · 双击全屏对话）——
  if (chatMode === "fab") {
    return (
      <button
        type="button"
        onClick={handleFabClick}
        className="absolute z-40 bottom-6 right-6 w-12 h-12 rounded-full bg-theme-bg-secondary backdrop-blur border border-theme-modal-border text-theme-text-primary shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 outline-none"
        aria-label="打开对话"
        title="单击输入 · 双击全屏对话"
      >
        <ChatCircleDots size={22} weight="fill" />
      </button>
    );
  }

  // —— Compose：右侧内容区正下方，一行简洁输入条 ——
  if (chatMode === "compose") {
    return (
      <div className="absolute z-40 inset-x-0 bottom-0 flex justify-center px-4 sm:px-8 pb-5 pt-10 pointer-events-none">
        {/* 底部淡出渐变，让输入条更浮在内容上 */}
        <div className="fc-bar-fade absolute inset-x-0 bottom-0 h-28 pointer-events-none" />

        <form
          onSubmit={submitCompose}
          className="fc-bar pointer-events-auto relative w-full max-w-2xl"
        >
          <button
            type="button"
            onClick={collapse}
            className="fc-bar-btn fc-bar-close"
            title="收起 (Esc)"
            aria-label="收起"
          >
            <X size={16} weight="bold" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                collapse();
              }
            }}
            placeholder="想问问知识库什么..."
            className="fc-bar-input"
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={!draft.trim()}
            className="fc-bar-btn fc-bar-send"
            title="发送"
            aria-label="发送"
          >
            <PaperPlaneRight size={17} weight="fill" />
          </button>
        </form>

        <style>{composeStyles}</style>
      </div>
    );
  }

  // —— Full：由主内容区铺满渲染，此处不再叠一层 ——
  return null;
}

const composeStyles = `
  .fc-bar-fade {
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--theme-bg-secondary, #111) 75%, transparent) 0%,
      transparent 100%
    );
  }

  .fc-bar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 3.25rem;
    padding: 0.35rem 0.4rem 0.35rem 0.35rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--theme-bg-primary, #1e1e1e) 72%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-modal-border, #444) 70%, rgba(255,255,255,0.08));
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 12px 40px -10px rgba(0,0,0,0.4),
      0 4px 16px -4px rgba(37, 99, 235, 0.12);
    backdrop-filter: blur(18px) saturate(1.25);
    -webkit-backdrop-filter: blur(18px) saturate(1.25);
    animation: fcBarIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .fc-bar:focus-within {
    border-color: color-mix(in srgb, var(--theme-button-primary, #3b82f6) 45%, var(--theme-modal-border));
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.06) inset,
      0 0 0 3px color-mix(in srgb, var(--theme-button-primary, #3b82f6) 16%, transparent),
      0 14px 44px -10px rgba(0,0,0,0.42),
      0 4px 16px -4px rgba(37, 99, 235, 0.16);
  }

  @keyframes fcBarIn {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .fc-bar-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--theme-text-primary);
    padding: 0 0.5rem;
  }
  .fc-bar-input::placeholder {
    color: var(--theme-text-secondary);
    opacity: 0.55;
  }

  .fc-bar-btn {
    flex-shrink: 0;
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s, opacity 0.15s, transform 0.15s;
  }

  .fc-bar-close {
    color: var(--theme-text-secondary);
  }
  .fc-bar-close:hover {
    background: var(--theme-file-picker-hover);
    color: var(--theme-text-primary);
  }

  .fc-bar-send {
    color: #fff;
    background: linear-gradient(145deg, var(--theme-button-primary, #3b82f6), #2563eb);
    box-shadow: 0 4px 12px -2px rgba(37, 99, 235, 0.45);
  }
  .fc-bar-send:hover:not(:disabled) {
    transform: scale(1.05);
  }
  .fc-bar-send:active:not(:disabled) {
    transform: scale(0.96);
  }
  .fc-bar-send:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  [data-theme="light"] .fc-bar {
    background: color-mix(in srgb, #ffffff 78%, transparent);
    border-color: color-mix(in srgb, #e5e7eb 80%, transparent);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.7) inset,
      0 12px 40px -12px rgba(15, 23, 42, 0.16),
      0 4px 14px -4px rgba(37, 99, 235, 0.08);
  }
  [data-theme="light"] .fc-bar-fade {
    background: linear-gradient(
      to top,
      color-mix(in srgb, #f8fafc 80%, transparent) 0%,
      transparent 100%
    );
  }
`;
