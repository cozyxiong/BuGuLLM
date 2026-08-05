import React from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import PasswordModal, { usePasswordModal } from "@/components/Modals/Password";
import { isMobile } from "react-device-detect";
import { FullScreenLoader } from "@/components/Preloader";
import WorkspaceChat from "@/pages/WorkspaceChat";
import { isWorkspaceOverlayPath } from "@/hooks/useMainWorkspaceRoute";

/**
 * 工作区壳层：侧栏常驻；主内容（文档/对话）在进设置/学习时只隐藏不卸载，
 * 避免返回后 FileEditor remount 重新拉文档。
 */
export default function WorkspaceLayout() {
  const { loading, requiresAuth, mode } = usePasswordModal();
  const { pathname } = useLocation();
  const { slug } = useParams();
  const isOverlay = isWorkspaceOverlayPath(pathname);

  if (loading) return <FullScreenLoader />;
  if (requiresAuth !== false) {
    return <>{requiresAuth !== null && <PasswordModal mode={mode} />}</>;
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {isMobile ? <SidebarMobileHeader /> : <Sidebar />}
      <div className="relative flex-1 min-w-0 h-full flex flex-col">
        {/* 主工作区：始终挂载（按 slug 区分），覆盖层时 hidden */}
        <div
          className={
            isOverlay
              ? "hidden"
              : "relative flex-1 min-w-0 h-full flex flex-col"
          }
          aria-hidden={isOverlay}
        >
          <WorkspaceChat key={slug || "ws"} />
        </div>

        {/* 设置 / 学习：覆盖在右侧 */}
        {isOverlay && (
          <div className="relative flex-1 min-w-0 h-full flex flex-col">
            <Outlet />
          </div>
        )}
      </div>
    </div>
  );
}
