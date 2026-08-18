import React from "react";
import { Outlet, Link, useParams, useLocation, NavLink } from "react-router-dom";
import paths from "@/utils/paths";
import {
  ArrowLeft,
  GraduationCap,
  TreeStructure,
  Cards,
  Question,
  Brain,
  Trash,
  GearSix,
} from "@phosphor-icons/react";
import { LearningProvider } from "./LearningContext";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";

const NAV = [
  { key: "", title: "首页", end: true },
  { key: "mindmap", title: "导图", icon: TreeStructure },
  { key: "cards", title: "卡片", icon: Cards },
  { key: "quiz", title: "测试", icon: Question },
  { key: "review", title: "复习", icon: Brain },
  { key: "trash", title: "回收站", icon: Trash },
  { key: "settings", title: "设置", icon: GearSix },
];

/**
 * 学习模块壳：与知识库右侧内容区同风格（圆角面板 + 顶栏）
 */
export default function LearningContainer() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const { selectedFile, multiSelectPaths, multiSelectMode } = useWorkspaceUI();

  const ctxValue = {
    slug,
    tree: null,
    selectedFile,
    multiSelectPaths,
    multiSelectMode,
    refreshTree: () => {},
  };

  const isHome =
    pathname === `/workspace/${slug}/learning` ||
    pathname === `/workspace/${slug}/learning/`;

  return (
    <LearningProvider value={ctxValue}>
      {/* 与全屏对话一致：直角铺满，无外边距/圆角卡片 */}
      <div className="relative flex-1 min-w-0 h-full w-full flex flex-col min-h-0 bg-theme-bg-secondary overflow-hidden">
          {/* 顶栏 */}
          <header className="shrink-0 border-b border-theme-modal-border bg-theme-bg-primary">
            <div className="flex items-center gap-2 px-3 sm:px-4 h-12">
              <Link
                to={paths.workspace.chat(slug)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors"
                title="返回知识库"
                aria-label="返回知识库"
              >
                <ArrowLeft size={16} weight="bold" />
              </Link>
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-theme-button-primary/10 text-theme-button-primary shrink-0">
                  <GraduationCap size={16} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-theme-text-primary leading-tight">
                    学习
                  </p>
                  {!isHome && (
                    <p className="text-[10px] text-theme-text-secondary truncate max-w-[140px] sm:max-w-[220px]">
                      {selectedFile?.name ||
                        (multiSelectMode
                          ? `已选 ${multiSelectPaths?.length || 0} 项`
                          : "未选文档")}
                    </p>
                  )}
                </div>
              </div>

              <nav className="ml-auto flex items-center gap-0.5 overflow-x-auto no-scroll max-w-[55%] sm:max-w-none">
                {NAV.map(({ key, title, icon: Icon, end }) => {
                  const to = paths.workspace.learning(slug, key || undefined);
                  return (
                    <NavLink
                      key={key || "home"}
                      to={to}
                      end={!!end}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors",
                          isActive
                            ? "bg-white/10 text-white light:bg-slate-200 light:text-slate-900"
                            : "text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover",
                        ].join(" ")
                      }
                    >
                      {Icon ? (
                        <Icon className="w-3.5 h-3.5 hidden sm:block" weight="duotone" />
                      ) : null}
                      {title}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </div>
      </div>
    </LearningProvider>
  );
}
