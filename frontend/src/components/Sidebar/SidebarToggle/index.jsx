import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarSimple } from "@phosphor-icons/react";
import paths from "@/utils/paths";
const SIDEBAR_TOGGLE_STORAGE_KEY = "anythingllm_sidebar_toggle";
export const SIDEBAR_TOGGLE_EVENT = "sidebar-toggle";

/**
 * Returns the previous state of the sidebar from localStorage.
 * If the sidebar was closed, returns false.
 * If the sidebar was open, returns true.
 * If the sidebar state is not set, returns true.
 * @returns {boolean}
 */
function previousSidebarState() {
  const previousState = window.localStorage.getItem(SIDEBAR_TOGGLE_STORAGE_KEY);
  if (previousState === "closed") return false;
  return true;
}

/** 首页 + 工作区壳层（对话/设置/学习）均可 hide/show 侧栏 */
function canToggleOnPath(pathname) {
  if (pathname === paths.home()) return true;
  // /workspace/:slug 及其子路径：settings、learning、t/:thread 等
  return /^\/workspace\/[^/]+(\/.*)?$/.test(pathname);
}

export function useSidebarToggle() {
  const { pathname } = useLocation();
  const [showSidebar, setShowSidebar] = useState(previousSidebarState());
  const [canToggleSidebar, setCanToggleSidebar] = useState(() =>
    canToggleOnPath(window.location.pathname)
  );

  useEffect(() => {
    setCanToggleSidebar(canToggleOnPath(pathname));
  }, [pathname]);

  useEffect(() => {
    function toggleSidebar(e) {
      if (!canToggleSidebar) return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "s"
      ) {
        setShowSidebar((prev) => {
          const newState = !prev;
          window.localStorage.setItem(
            SIDEBAR_TOGGLE_STORAGE_KEY,
            newState ? "open" : "closed"
          );
          return newState;
        });
      }
    }
    window.addEventListener("keydown", toggleSidebar);
    return () => {
      window.removeEventListener("keydown", toggleSidebar);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_TOGGLE_STORAGE_KEY,
      showSidebar ? "open" : "closed"
    );
    window.dispatchEvent(
      new CustomEvent(SIDEBAR_TOGGLE_EVENT, {
        detail: { open: showSidebar },
      })
    );
  }, [showSidebar]);

  return { showSidebar, setShowSidebar, canToggleSidebar };
}

/** 放在 Tab 轨顶栏内，与轨底按钮一样随轨固定（不 absolute 飘） */
export function ToggleSidebarButton({ showSidebar, setShowSidebar }) {
  return (
    <button
      type="button"
      className="ft-rail-header-btn hidden md:flex border-none bg-transparent outline-none ring-0 items-center justify-center"
      onClick={() => setShowSidebar((prev) => !prev)}
      aria-label={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
    >
      <SidebarSimple
        className="text-theme-text-secondary hover:text-theme-text-primary transition-colors"
        size={20}
        weight="bold"
      />
    </button>
  );
}
