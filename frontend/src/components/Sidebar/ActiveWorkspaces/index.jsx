import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Workspace, { WORKSPACE_UPDATED_EVENT } from "@/models/workspace";
import paths from "@/utils/paths";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import {
  GearSix,
  Plus,
  Wrench,
  ArrowUUpLeft,
} from "@phosphor-icons/react";
import useUser from "@/hooks/useUser";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";
import { productCopy } from "@/utils/product";
import NewWorkspaceModal, {
  useNewWorkspaceModal,
} from "../../Modals/NewWorkspace";
import WorkspaceLibraryTree from "./WorkspaceLibraryTree";
import "./folderTabs.css";

/**
 * 原站角标 SVG（用户提供）
 * image-b4d61677 = right corner → 竖版下角
 * image-7f68e23f = left corner  → 竖版上角
 *
 * 竖版 path：原横版 (x,y)→(y,x)，直边贴 active Tab
 */
function TabCorner({ side }) {
  const isTop = side === "top";
  return (
    <span
      className={`ft-tab-corner ${isTop ? "is-top" : "is-bottom"}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 59 61"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {isTop ? (
          /* 7f68e23f left → 上角，直边 y=61 贴 active 顶 */
          <path
            d="M0 61 L59 61 L59 0 C59 0 58.242 34.597 23 42.01 C4 46.008 0 61 0 61 Z"
            fill="currentColor"
          />
        ) : (
          /* b4d61677 right → 下角，直边 y=0 贴 active 底 */
          <path
            d="M0 0 L59 0 L59 61 C59 61 58.242 26.418 23 19 C4 15 0 0 0 0 Z"
            fill="currentColor"
          />
        )}
      </svg>
    </span>
  );
}

/**
 * @param {{ panelVisible?: boolean, panelLogo?: React.ReactNode, railHeader?: React.ReactNode }} props
 * railHeader：Tab 轨顶栏固定区（折叠钮），与轨底 footer 对称
 */
export default function ActiveWorkspaces({
  panelVisible = true,
  panelLogo = null,
  railHeader = null,
}) {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  /** 指针拖拽换序（约束在竖轨内，移出仍按 Y 换位） */
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const railRef = useRef(null);
  /** 拖拽结束后吞掉紧随其后的 click，避免误跳转 */
  const skipClickRef = useRef(false);
  const dragStateRef = useRef({
    /** 按下但尚未超过阈值 */
    pending: false,
    /** 已进入拖拽换序 */
    active: false,
    fromIndex: -1,
    startY: 0,
    moved: false,
    workspaceId: null,
    pointerId: null,
  });
  const {
    showing: showingNewWs,
    showModal: showNewWsModal,
    hideModal: hideNewWsModal,
  } = useNewWorkspaceModal();
  const { user } = useUser();

  const isInWorkspaceSettings = /\/workspace\/[^/]+\/settings\//.test(pathname);
  const isInAppSettings = pathname.startsWith("/settings");
  const isHomePage = pathname === "/";

  useEffect(() => {
    async function getWorkspaces() {
      const list = await Workspace.all();
      setLoading(false);
      setWorkspaces(Workspace.orderWorkspaces(list));
    }
    getWorkspaces();
  }, []);

  /** 设置页改名等更新后，同步侧栏工作区名称，无需整页刷新 */
  useEffect(() => {
    const onWorkspaceUpdated = (event) => {
      const updated = event?.detail?.workspace;
      if (!updated?.id && !updated?.slug) return;
      setWorkspaces((prev) => {
        const idx = prev.findIndex(
          (w) =>
            (updated.id != null && w.id === updated.id) ||
            (updated.slug && w.slug === updated.slug) ||
            (event?.detail?.slug && w.slug === event.detail.slug)
        );
        if (idx === -1) {
          // 新建工作区：追加后按本地顺序偏好排列
          return Workspace.orderWorkspaces([...prev, updated]);
        }
        const next = Array.from(prev);
        next[idx] = { ...next[idx], ...updated };
        return next;
      });
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    return () =>
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
  }, []);

  /** 根据指针 Y，映射到竖轨内目标 index（移出轨外仍按高度计算） */
  const indexFromClientY = useCallback((clientY) => {
    const rail = railRef.current;
    if (!rail) return -1;
    const tabs = rail.querySelectorAll("[data-ft-tab-index]");
    if (!tabs.length) return -1;

    // 在列表上方 → 0；下方 → last
    const first = tabs[0].getBoundingClientRect();
    const last = tabs[tabs.length - 1].getBoundingClientRect();
    if (clientY < first.top) return 0;
    if (clientY > last.bottom) return tabs.length - 1;

    for (let i = 0; i < tabs.length; i++) {
      const rect = tabs[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return i;
    }
    return tabs.length - 1;
  }, []);

  /** 拖拽换序：写入 localStorage，刷新后保持 */
  const reorderWorkspaces = useCallback((fromIndex, toIndex) => {
    if (
      fromIndex == null ||
      toIndex == null ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0
    )
      return;
    setWorkspaces((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = Array.from(prev);
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      Workspace.storeWorkspaceOrder(next.map((w) => w.id));
      return next;
    });
  }, []);

  const endPointerDrag = useCallback(() => {
    const st = dragStateRef.current;
    st.pending = false;
    st.active = false;
    st.fromIndex = -1;
    st.workspaceId = null;
    st.pointerId = null;
    setDraggingId(null);
    setDragOverIndex(null);
    document.body.classList.remove("ft-tab-dragging");
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const st = dragStateRef.current;
      if (!st.pending && !st.active) return;

      const dy = Math.abs(e.clientY - st.startY);
      // 超过阈值才进入拖拽，单击仍可切换工作区
      if (st.pending && !st.active) {
        if (dy < 6) return;
        st.active = true;
        st.moved = true;
        setDraggingId(st.workspaceId);
        setDragOverIndex(st.fromIndex);
        document.body.classList.add("ft-tab-dragging");
      }

      if (!st.active) return;
      e.preventDefault();
      st.moved = true;

      // 仅按 Y 映射 index：鼠标移出竖条也不禁止，列表项在轨内跟高度走
      const toIndex = indexFromClientY(e.clientY);
      if (toIndex < 0) return;
      setDragOverIndex(toIndex);

      if (toIndex !== st.fromIndex) {
        reorderWorkspaces(st.fromIndex, toIndex);
        st.fromIndex = toIndex;
      }
    };

    const onUp = () => {
      const st = dragStateRef.current;
      if (!st.pending && !st.active) return;
      if (st.moved) skipClickRef.current = true;
      endPointerDrag();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [indexFromClientY, reorderWorkspaces, endPointerDrag]);

  const onTabPointerDown = useCallback((e, index, workspaceId) => {
    if (e.button != null && e.button !== 0) return;
    dragStateRef.current = {
      pending: true,
      active: false,
      fromIndex: index,
      startY: e.clientY,
      moved: false,
      workspaceId,
      pointerId: e.pointerId,
    };
  }, []);

  if (loading) {
    return (
      <div className="ft-shell p-2">
        <Skeleton.default
          height={88}
          width={48}
          count={3}
          baseColor="var(--theme-sidebar-item-default)"
          highlightColor="var(--theme-sidebar-item-hover)"
          enableAnimation
          className="my-1"
        />
      </div>
    );
  }

  const virtualActiveSlug = (() => {
    if (!isHomePage || workspaces.length === 0) return null;
    const lastVisited = safeJsonParse(
      localStorage.getItem(LAST_VISITED_WORKSPACE)
    );
    if (
      lastVisited?.slug &&
      workspaces.some((ws) => ws.slug === lastVisited.slug)
    )
      return lastVisited.slug;
    return workspaces[0]?.slug ?? null;
  })();

  const activeWorkspace =
    workspaces.find((w) =>
      slug ? w.slug === slug : w.slug === virtualActiveSlug
    ) || workspaces[0];

  const activeIndex = workspaces.findIndex(
    (w) => w.id === activeWorkspace?.id
  );
  const canManage = !user || user?.role !== "default";
  const panelSlug = activeWorkspace?.slug;

  return (
    <div className={`ft-shell${panelVisible ? "" : " is-rail-only"}`}>
      <div className="ft-row">
        <div className="ft-rail-col">
          {/* 轨顶固定区：与轨底 footer 对称，滚动时不跟着走 */}
          {railHeader && (
            <div className="ft-rail-header">{railHeader}</div>
          )}
          <div
            ref={railRef}
            className="ft-rail"
            role="tablist"
            aria-label={productCopy.knowledgeBases}
            aria-orientation="vertical"
          >
            {workspaces.map((workspace, index) => {
              const tabActive = slug
                ? workspace.slug === slug
                : workspace.slug === virtualActiveSlug ||
                  (!virtualActiveSlug && index === 0);
              const isFirst = index === 0;
              const isLast = index === workspaces.length - 1;
              // 原站：首项只有 right 角，末项只有 left 角，中间两个都有
              const showTop = panelVisible && !isFirst;
              const showBottom = panelVisible && !isLast;
              const isDragging = draggingId === workspace.id;

              return (
                <Link
                  key={workspace.id}
                  to={paths.workspace.chat(workspace.slug)}
                  role="tab"
                  data-ft-tab-index={index}
                  aria-selected={tabActive}
                  aria-current={tabActive ? "page" : undefined}
                  aria-label={workspace.name}
                  // 禁用浏览器原生拖拽，改用指针约束在竖轨内换序
                  draggable={false}
                  onPointerDown={(e) =>
                    onTabPointerDown(e, index, workspace.id)
                  }
                  onClick={(e) => {
                    if (skipClickRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      skipClickRef.current = false;
                    }
                  }}
                  className={[
                    "ft-tab",
                    tabActive ? "is-active" : "",
                    isFirst ? "is-first" : "",
                    isLast ? "is-last" : "",
                    isDragging ? "is-dragging" : "",
                    dragOverIndex === index && !isDragging
                      ? "is-drag-over"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {showTop && <TabCorner side="top" />}
                  {showBottom && <TabCorner side="bottom" />}
                  <span className="ft-tab-label">{workspace.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="ft-rail-footer">
            {canManage && (
              <button
                type="button"
                onClick={showNewWsModal}
                aria-label={productCopy.newKnowledgeBase}
              >
                <Plus size={17} weight="bold" />
              </button>
            )}
            {canManage &&
              (isInAppSettings ? (
                <Link to={paths.home()} aria-label="返回工作区">
                  <ArrowUUpLeft size={17} weight="fill" />
                </Link>
              ) : (
                <Link to={paths.settings.root()} aria-label="打开设置">
                  <Wrench size={17} weight="fill" />
                </Link>
              ))}
          </div>
        </div>

        {/* hide 时仅用 CSS 隐藏，不卸载树，保留展开/选中 */}
        {activeWorkspace && (
          <div
            className={[
              "ft-panel",
              activeIndex === 0 ? "is-first-active" : "",
              panelVisible ? "" : "is-hidden",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden={!panelVisible}
          >
            {panelLogo && (
              <div className="ft-panel-logo">{panelLogo}</div>
            )}
            <div className="ft-panel-head">
              <p className="ft-panel-title" title={activeWorkspace.name}>
                {activeWorkspace.name}
              </p>
              {canManage && (
                <div className="ft-panel-actions">
                  <button
                    type="button"
                    className={`ft-icon-btn ${
                      isInWorkspaceSettings && activeWorkspace.slug === slug
                        ? "is-active"
                        : ""
                    }`}
                    aria-label="知识库设置"
                    aria-pressed={
                      isInWorkspaceSettings && activeWorkspace.slug === slug
                    }
                    onClick={() => {
                      navigate(
                        isInWorkspaceSettings
                          ? paths.workspace.chat(activeWorkspace.slug)
                          : paths.workspace.settings.generalAppearance(
                              activeWorkspace.slug
                            )
                      );
                    }}
                  >
                    <GearSix
                      size={17}
                      weight={
                        isInWorkspaceSettings && activeWorkspace.slug === slug
                          ? "fill"
                          : "regular"
                      }
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="ft-panel-body">
              <WorkspaceLibraryTree workspaceSlug={panelSlug} />
            </div>
          </div>
        )}
      </div>

      {showingNewWs && <NewWorkspaceModal hideModal={hideNewWsModal} />}
    </div>
  );
}
