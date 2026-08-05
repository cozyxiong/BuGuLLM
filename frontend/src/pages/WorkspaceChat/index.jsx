import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { default as WorkspaceChatContainer } from "@/components/WorkspaceChat";
import Workspace, { WORKSPACE_UPDATED_EVENT } from "@/models/workspace";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";
import { FileEditor } from "@/components/Library/FileEditor";
import FloatingChat from "@/components/FloatingChat";
import FloatingLearning from "@/components/FloatingLearning";
import { FileText } from "@phosphor-icons/react";
import useMainWorkspaceRoute from "@/hooks/useMainWorkspaceRoute";

/**
 * 工作区主内容（知识库阅读 / 全屏对话）。
 * 侧栏由 WorkspaceLayout 提供；本组件由 Layout 常驻挂载，进设置/学习时仅 hidden。
 */
export default function WorkspaceChat() {
  return <MainWorkspacePane />;
}

function MainWorkspacePane() {
  const { slug } = useMainWorkspaceRoute();
  const { selectedFile, chatMode } = useWorkspaceUI();
  const [workspace, setWorkspace] = useState(null);
  const [loadedSlug, setLoadedSlug] = useState(null);

  useEffect(() => {
    async function getWorkspace() {
      if (!slug) return;
      const _workspace = await Workspace.bySlug(slug);
      if (!_workspace) {
        setWorkspace(null);
        setLoadedSlug(slug);
        return;
      }
      const { showAgentCommand } = await Workspace.agentCommandAvailable(slug);
      setWorkspace({
        ..._workspace,
        showAgentCommand,
      });
      setLoadedSlug(slug);
      localStorage.setItem(
        LAST_VISITED_WORKSPACE,
        JSON.stringify({
          slug: _workspace.slug,
          name: _workspace.name,
        })
      );
    }
    getWorkspace();
  }, [slug]);

  // 设置页改名等更新后同步主区 workspace
  useEffect(() => {
    const onWorkspaceUpdated = (e) => {
      const updated = e?.detail?.workspace;
      const matchSlug = e?.detail?.slug || updated?.slug;
      if (!matchSlug || matchSlug !== slug || !updated) return;
      setWorkspace((prev) =>
        prev ? { ...prev, ...updated, name: updated.name ?? prev.name } : prev
      );
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    return () =>
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
  }, [slug]);

  const loadingWs = loadedSlug !== slug;
  const showDoc = !!selectedFile;
  const showEmpty = !selectedFile && chatMode !== "full";

  return (
    <div className="relative flex-1 min-w-0 h-full flex flex-col">
      <div className="flex-1 min-h-0 h-full relative">
        {/*
          文档编辑器在全屏对话时只隐藏、不卸载。
          否则缩小对话会 remount FileEditor → 重新 readFile，表现为「刷新文档」。
        */}
        {showDoc && (
          <div
            className={
              chatMode === "full"
                ? "hidden"
                : "absolute inset-0 h-full w-full"
            }
            aria-hidden={chatMode === "full"}
          >
            <FileEditor
              key={selectedFile.path}
              slug={slug}
              file={selectedFile}
              onFileUpdate={() => {}}
            />
          </div>
        )}

        {showEmpty && (
          <EmptyKnowledgeState workspaceName={workspace?.name} />
        )}

        {chatMode === "full" && (
          <div className="absolute inset-0 h-full w-full">
            <WorkspaceChatContainer
              loading={loadingWs}
              workspace={workspace}
              fillPane
            />
          </div>
        )}
      </div>

      {chatMode !== "full" && <FloatingLearning />}
      <FloatingChat loading={loadingWs} workspace={workspace} />
    </div>
  );
}

function EmptyKnowledgeState({ workspaceName }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-theme-bg-secondary px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 light:bg-slate-100 flex items-center justify-center mb-5">
          <FileText
            size={32}
            className="text-zinc-400 light:text-slate-400"
            weight="duotone"
          />
        </div>
        <h2 className="text-lg font-semibold text-theme-text-primary mb-2">
          {workspaceName || "知识库"}
        </h2>
        <p className="text-sm text-theme-text-secondary leading-relaxed">
          从左侧选择文档开始阅读，或打开对话向知识库提问。
        </p>
      </div>
    </div>
  );
}

/** 旧的 /library 路由重定向入口 */
export function LibraryRedirect() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/" replace />;
  return <Navigate to={`/workspace/${slug}`} replace />;
}
