import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  SlidersHorizontal,
  Plus,
  CircleNotch,
  ChatCircleDots,
  Check,
  Trash,
} from "@phosphor-icons/react";
import useLoginMode from "@/hooks/useLoginMode";
import TextSizeRow from "./TextSize";
import MemoriesRow from "./Memories";
import CopyLinkToChatRow from "./CopyLinkToChat";
import ExportRow from "./Export";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { setLastWorkspaceThread } from "@/utils/constants";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";
import WorkspaceModelPicker from "../WorkspaceModelPicker";

export default function ChatSettingsMenu({
  history = [],
  workspace = null,
  threadSlug = null,
}) {
  const mode = useLoginMode();
  const navigate = useNavigate();
  const { chatMode } = useWorkspaceUI();
  const docked = chatMode === "compose";
  const { slug: urlSlug } = useParams();
  const workspaceSlug = workspace?.slug || urlSlug;
  const [showMenu, setShowMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  // 打开菜单时拉取历史对话列表
  useEffect(() => {
    if (!showMenu || !workspaceSlug) return;
    let cancelled = false;
    (async () => {
      setLoadingThreads(true);
      try {
        // 产品以 thread 为主，历史列表不展示「默认对话」(thread_id=null)
        const { threads: list } = await Workspace.threads.all(workspaceSlug);
        if (cancelled) return;
        const sorted = [...(list || [])].sort((a, b) => {
          const ta = new Date(a.lastUpdatedAt || a.updatedAt || 0).getTime();
          const tb = new Date(b.lastUpdatedAt || b.updatedAt || 0).getTime();
          if (tb !== ta) return tb - ta;
          return (b.id || 0) - (a.id || 0);
        });
        setThreads(sorted);
      } catch {
        if (!cancelled) {
          setThreads([]);
        }
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showMenu, workspaceSlug, threadSlug]);

  const hasUserIcon = mode !== null;

  const startNewThread = async () => {
    if (!workspaceSlug || creating) return;
    setCreating(true);
    const { thread, error } = await Workspace.threads.new(workspaceSlug);
    if (error || !thread?.slug) {
      showToast(error || "无法创建新对话", "error", { clear: true });
      setCreating(false);
      return;
    }
    setLastWorkspaceThread(workspaceSlug, thread.slug);
    setShowMenu(false);
    navigate(paths.workspace.thread(workspaceSlug, thread.slug));
    setCreating(false);
  };

  const openThread = (slug) => {
    if (!workspaceSlug || !slug) return;
    setShowMenu(false);
    setLastWorkspaceThread(workspaceSlug, slug);
    navigate(paths.workspace.thread(workspaceSlug, slug));
  };

  const deleteThread = async (e, thread) => {
    e.preventDefault();
    e.stopPropagation();
    if (!thread?.slug || !workspaceSlug) return;
    const ok = await Workspace.threads.delete(workspaceSlug, thread.slug);
    if (!ok) {
      showToast("删除对话失败", "error");
      return;
    }
    setThreads((prev) => prev.filter((t) => t.slug !== thread.slug));
    if (threadSlug === thread.slug) {
      navigate(paths.workspace.chat(workspaceSlug), { replace: true });
    }
  };

  return (
    <div
      className={`absolute z-30 flex items-center gap-1.5 ${
        docked
          ? "top-2 left-2"
          : `top-3 md:top-5 ${
              hasUserIcon ? "right-[55px] md:right-[67px]" : "right-4 md:right-6"
            }`
      }`}
    >
      {/* 开启新对话 — 在设置按钮左侧 */}
      <button
        type="button"
        onClick={startNewThread}
        disabled={creating || !workspaceSlug}
        className="group border-none cursor-pointer flex items-center gap-1 px-2.5 h-[35px] rounded-full transition-all hover:bg-zinc-700 light:hover:bg-slate-200 disabled:opacity-50"
        title="开启新对话"
        aria-label="开启新对话"
      >
        {creating ? (
          <CircleNotch
            size={16}
            className="animate-spin text-zinc-300 light:text-slate-600"
          />
        ) : (
          <Plus
            size={16}
            weight="bold"
            className="text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-800"
          />
        )}
        <span className="text-xs text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-800">
          新对话
        </span>
      </button>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={`group border-none cursor-pointer flex items-center justify-center w-[35px] h-[35px] rounded-full transition-all ${
          showMenu
            ? "bg-zinc-700 light:bg-slate-200"
            : "hover:bg-zinc-700 light:hover:bg-slate-200"
        }`}
        title="对话设置与历史"
        aria-label="对话设置与历史"
      >
        <SlidersHorizontal
          size={18}
          className={
            showMenu
              ? "text-white light:text-slate-800"
              : "text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-800"
          }
        />
      </button>
      {docked ? (
        <WorkspaceModelPicker variant="icon" workspaceSlug={workspaceSlug} />
      ) : null}

      {showMenu && (
        <div
          ref={menuRef}
          className={`absolute top-[42px] z-50 bg-zinc-800 light:bg-white border border-zinc-700/80 light:border-slate-200 rounded-2xl p-3 w-[260px] flex flex-col gap-2 shadow-[0_16px_48px_rgba(0,0,0,0.28)] overflow-visible ${
            docked ? "left-0" : "right-0"
          }`}
        >
          {/* 历史对话：仅此处滚动，避免 overflow 裁切左侧子菜单 */}
          <div className="flex flex-col min-h-0 max-h-[200px] overflow-hidden rounded-md">
            <div className="flex items-center gap-1.5 px-1 pb-1.5 border-b border-zinc-700/80 light:border-slate-200 shrink-0">
              <ChatCircleDots
                size={14}
                className="text-zinc-400 light:text-slate-500"
              />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 light:text-slate-500">
                历史对话
              </p>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 py-1.5 flex flex-col gap-0.5">
              {loadingThreads ? (
                <p className="text-xs text-zinc-500 light:text-slate-500 px-2 py-2 animate-pulse">
                  加载中…
                </p>
              ) : (
                <>
                  {threads.map((t) => (
                    <ThreadMenuRow
                      key={t.slug}
                      name={t.name || "未命名对话"}
                      active={threadSlug === t.slug}
                      onClick={() => openThread(t.slug)}
                      onDelete={(e) => deleteThread(e, t)}
                    />
                  ))}
                  {threads.length === 0 && (
                    <p className="text-xs text-zinc-500 light:text-slate-500 px-2 py-2">
                      暂无历史对话
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 设置项：overflow 可见，左侧子菜单（字号/导出）可完整显示 */}
          <div className="border-t border-zinc-700/80 light:border-slate-200 pt-1.5 flex flex-col gap-1.5 overflow-visible relative z-[60]">
            <TextSizeRow />
            <MemoriesRow onClose={() => setShowMenu(false)} />
            <ExportRow
              history={history}
              workspace={workspace}
              threadSlug={threadSlug}
              onClose={() => setShowMenu(false)}
            />
            <CopyLinkToChatRow />
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadMenuRow({ name, active, onClick, onDelete }) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-md ${
        active
          ? "bg-zinc-700/90 light:bg-slate-200"
          : "hover:bg-zinc-700/50 light:hover:bg-slate-200/80"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left px-2 py-1.5 border-none bg-transparent cursor-pointer flex items-center gap-1.5"
      >
        {active ? (
          <Check
            size={12}
            weight="bold"
            className="shrink-0 text-blue-400 light:text-blue-600"
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span
          className={`text-xs truncate ${
            active
              ? "text-white light:text-slate-900 font-medium"
              : "text-zinc-300 light:text-slate-700"
          }`}
        >
          {name}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1.5 mr-0.5 border-none bg-transparent cursor-pointer text-zinc-500 hover:text-red-400 transition-opacity"
          title="删除对话"
          aria-label="删除对话"
        >
          <Trash size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
