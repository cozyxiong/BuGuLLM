import React, { useEffect, useRef, useState } from "react";
import { List } from "@phosphor-icons/react";
import ActiveWorkspaces from "./ActiveWorkspaces";
import useLogo from "@/hooks/useLogo";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import { useSidebarToggle, ToggleSidebarButton } from "./SidebarToggle";
import { createPortal } from "react-dom";
import { Tooltip } from "react-tooltip";

/** 左侧工作区 Tab 竖轨宽度（Hide 后仍保留，与 CSS --ft-tab-w 一致） */
const SIDEBAR_RAIL_W = 52;
const SIDEBAR_FULL_W = 304;

/**
 * 贴左竖向文件夹弧形 Tab + 圆角知识库面板
 * Hide Sidebar：只收起右侧内容面板，保留最左 Tab 列
 */
export default function Sidebar() {
  const { logo } = useLogo();
  const { showSidebar, setShowSidebar, canToggleSidebar } = useSidebarToggle();

  const logoSlot = showSidebar ? (
    <Link
      to={paths.home()}
      aria-label="Home"
      className="flex items-center min-w-0"
    >
      <img
        src={logo}
        alt="Logo"
        className="rounded max-h-[22px] object-contain"
      />
    </Link>
  ) : null;

  const railHeader =
    canToggleSidebar ? (
      <ToggleSidebarButton
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
      />
    ) : null;

  return (
    <>
      <div
        style={{
          width: showSidebar ? `${SIDEBAR_FULL_W}px` : `${SIDEBAR_RAIL_W}px`,
        }}
        className="relative transition-all duration-500 h-full shrink-0"
      >
        <div
          className={`h-full min-h-0 pl-0 pb-2 ${
            showSidebar ? "pr-2" : "pr-0"
          }`}
        >
          <ActiveWorkspaces
            panelVisible={showSidebar}
            panelLogo={logoSlot}
            railHeader={railHeader}
          />
        </div>
      </div>
      <WorkspaceAndThreadTooltips />
    </>
  );
}

export function SidebarMobileHeader() {
  const { logo } = useLogo();
  const sidebarRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBgOverlay, setShowBgOverlay] = useState(false);

  useEffect(() => {
    if (showSidebar) {
      const t = setTimeout(() => setShowBgOverlay(true), 280);
      return () => clearTimeout(t);
    }
    setShowBgOverlay(false);
  }, [showSidebar]);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center px-4 py-2 bg-theme-bg-sidebar light:bg-white shadow-lg h-14">
        <button
          onClick={() => setShowSidebar(true)}
          className="rounded-md p-2 flex items-center justify-center text-theme-text-secondary"
          aria-label="打开导航"
        >
          <List className="h-6 w-6" />
        </button>
        <img
          src={logo}
          alt="Logo"
          className="h-6 w-auto object-contain"
        />
        <div className="w-10" />
      </div>
      <div
        style={{
          transform: showSidebar ? "translateX(0)" : "translateX(-100%)",
        }}
        className="z-99 fixed inset-0 transition-transform duration-400"
      >
        <div
          className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${
            showBgOverlay ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setShowSidebar(false)}
        />
        <div
          ref={sidebarRef}
          className="relative h-full w-[88%] max-w-[320px] bg-theme-bg-sidebar shadow-2xl flex flex-col pt-3"
        >
          <div className="px-3 pb-2">
            <img src={logo} alt="Logo" className="max-h-[24px] object-contain" />
          </div>
          <div className="flex-1 min-h-0">
            <ActiveWorkspaces />
          </div>
        </div>
      </div>
    </>
  );
}

function WorkspaceAndThreadTooltips() {
  // 侧栏主交互已去掉悬浮提示；仅保留线程名等仍在使用的 id（若无引用可整体删除）
  return createPortal(
    <Tooltip
      id="workspace-thread-name"
      place="right"
      delayShow={350}
      className="tooltip !text-xs z-99"
    />,
    document.body
  );
}
