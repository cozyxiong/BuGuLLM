import React, { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, Link, NavLink } from "react-router-dom";
import Workspace, { WORKSPACE_UPDATED_EVENT } from "@/models/workspace";
import { FullScreenLoader } from "@/components/Preloader";
import {
  ArrowLeft,
  ChatText,
  Database,
  Robot,
  User,
  Wrench,
  GearSix,
} from "@phosphor-icons/react";
import paths from "@/utils/paths";
import GeneralAppearance from "./GeneralAppearance";
import ChatSettings from "./ChatSettings";
import VectorDatabase from "./VectorDatabase";
import Members from "./Members";
import WorkspaceAgentConfiguration from "./AgentConfig";
import useUser from "@/hooks/useUser";
import { useTranslation } from "react-i18next";
import System from "@/models/system";
import {
  SettingsHeaderSave,
  SettingsSaveProvider,
} from "./SettingsSaveBar";

const TABS = {
  "general-appearance": GeneralAppearance,
  "chat-settings": ChatSettings,
  "vector-database": VectorDatabase,
  members: Members,
  "agent-config": WorkspaceAgentConfiguration,
};

/**
 * 工作区设置 — 顶栏 + 横向导航 + 内容；保存在导航旁
 */
export default function WorkspaceSettings() {
  const { t } = useTranslation();
  const { slug, tab } = useParams();
  const { user } = useUser();
  const [workspace, setWorkspace] = useState(null);
  const [deletionProtected, setDeletionProtected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [multiUserMode, setMultiUserMode] = useState(false);

  useEffect(() => {
    async function getWorkspace() {
      if (!slug) return;
      setLoading(true);
      const _workspace = await Workspace.bySlug(slug);
      if (!_workspace) {
        setWorkspace(null);
        setLoading(false);
        return;
      }
      const _settings = await System.keys();
      setMultiUserMode(!!_settings?.MultiUserMode);
      setWorkspace({
        ..._workspace,
        vectorDB: _settings?.VectorDB,
      });
      setDeletionProtected(_settings?.WorkspaceDeletionProtection === true);
      setLoading(false);
    }
    getWorkspace();
  }, [slug]);

  /** 子页保存后同步顶栏名称等字段 */
  useEffect(() => {
    const onWorkspaceUpdated = (event) => {
      const updated = event?.detail?.workspace;
      if (!updated) return;
      const matchSlug = event?.detail?.slug || updated.slug;
      if (matchSlug !== slug && updated.slug !== slug) return;
      setWorkspace((prev) =>
        prev ? { ...prev, ...updated, name: updated.name ?? prev.name } : prev
      );
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
    return () =>
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, onWorkspaceUpdated);
  }, [slug]);

  const navItems = useMemo(() => {
    const all = [
      {
        id: "general-appearance",
        title: t("workspaces—settings.general"),
        icon: Wrench,
        to: paths.workspace.settings.generalAppearance(slug),
      },
      {
        id: "chat-settings",
        title: t("workspaces—settings.chat"),
        icon: ChatText,
        to: paths.workspace.settings.chatSettings(slug),
      },
      {
        id: "vector-database",
        title: t("workspaces—settings.vector"),
        icon: Database,
        to: paths.workspace.settings.vectorDatabase(slug),
      },
      {
        id: "members",
        title: t("workspaces—settings.members"),
        icon: User,
        to: paths.workspace.settings.members(slug),
        visible: ["admin", "manager"].includes(user?.role),
      },
      {
        id: "agent-config",
        title: t("workspaces—settings.agent"),
        icon: Robot,
        to: paths.workspace.settings.agentConfig(slug),
      },
    ];
    return all.filter((i) => i.visible !== false);
  }, [slug, t, user?.role]);

  if (loading) return <FullScreenLoader />;

  if (multiUserMode && user?.role === "default") {
    return <Navigate to={paths.workspace.chat(slug)} replace />;
  }

  const activeId = TABS[tab] ? tab : "general-appearance";
  const TabContent = TABS[activeId] || GeneralAppearance;

  return (
    <SettingsSaveProvider>
      <div className="h-full w-full flex flex-col min-h-0 bg-[#121214] light:bg-theme-bg-secondary">
        {/* 顶栏：返回 + 标题；保存紧跟在导航「代理设置」右侧 */}
        <header className="shrink-0 border-b border-white/[0.06] light:border-theme-modal-border bg-[#161618]/95 light:bg-theme-bg-secondary backdrop-blur-md">
          <div className="h-[52px] px-3 sm:px-5 flex items-center gap-2.5">
            <Link
              to={paths.workspace.chat(slug)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] light:text-theme-text-secondary light:hover:text-theme-text-primary light:hover:bg-black/[0.04] transition-colors"
              title="返回知识库"
              aria-label="返回知识库"
            >
              <ArrowLeft size={15} weight="bold" />
            </Link>
            <div className="w-px h-4 bg-white/[0.08] light:bg-theme-modal-border shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <GearSix
                size={15}
                weight="fill"
                className="text-white/35 light:text-theme-text-secondary shrink-0"
              />
              <span className="text-[13px] font-medium text-white/90 light:text-theme-text-primary tracking-tight">
                设置
              </span>
              <span className="text-white/20 light:text-theme-text-secondary/40">
                /
              </span>
              <span className="text-[13px] text-white/45 light:text-theme-text-secondary truncate max-w-[140px] sm:max-w-[220px]">
                {workspace?.name || slug}
              </span>
            </div>
          </div>

          {/* 横向导航 + 保存按钮（紧贴最后一个 tab） */}
          <div className="px-3 sm:px-5 flex items-end gap-2 min-w-0">
            <nav
              className="flex gap-0 overflow-x-auto no-scroll min-w-0"
              aria-label="设置分类"
            >
              {navItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={item.id === activeId}
                />
              ))}
            </nav>
            <SettingsHeaderSave />
          </div>
        </header>

        {/* 内容：左对齐、无外层圆角卡片；保存不在内容流内 */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="ws-settings-panel w-full max-w-2xl px-5 sm:px-8 py-6 sm:py-8 pb-10 text-left">
            <TabContent
              slug={slug}
              workspace={workspace}
              deletionProtected={deletionProtected}
            />
          </div>
        </main>

        <style>{`
        .ws-settings-panel {
          position: relative;
        }
        .ws-settings-panel form {
          width: 100% !important;
          max-width: none !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 1.5rem !important;
        }
        .ws-settings-panel > .relative,
        .ws-settings-panel > .w-full.relative,
        .ws-settings-panel > .w-full.relative.flex.flex-col {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .ws-settings-panel .input-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: rgba(255,255,255,0.9);
          margin-bottom: 0.25rem;
        }
        [data-theme="light"] .ws-settings-panel .input-label {
          color: var(--theme-text-primary);
        }
        .ws-settings-panel p.text-white.text-opacity-60,
        .ws-settings-panel .text-white.text-opacity-60,
        .ws-settings-panel p.text-theme-text-secondary {
          color: rgba(255,255,255,0.42) !important;
          opacity: 1 !important;
          font-size: 0.75rem !important;
          line-height: 1.5;
          margin-top: 0.1rem !important;
          margin-bottom: 0.65rem !important;
        }
        [data-theme="light"] .ws-settings-panel p.text-white.text-opacity-60,
        [data-theme="light"] .ws-settings-panel .text-white.text-opacity-60,
        [data-theme="light"] .ws-settings-panel p.text-theme-text-secondary {
          color: var(--theme-text-secondary) !important;
        }
        .ws-settings-panel input[type="text"],
        .ws-settings-panel input[type="number"],
        .ws-settings-panel input[type="password"],
        .ws-settings-panel textarea {
          border-radius: 0.65rem !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          background: rgba(0,0,0,0.22) !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        [data-theme="light"] .ws-settings-panel input[type="text"],
        [data-theme="light"] .ws-settings-panel input[type="number"],
        [data-theme="light"] .ws-settings-panel input[type="password"],
        [data-theme="light"] .ws-settings-panel textarea {
          background: var(--theme-settings-input-bg) !important;
          border-color: var(--theme-modal-border) !important;
        }
        /* 下拉框：统一高级样式 */
        .ws-settings-panel select {
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 2.75rem !important;
          margin-top: 0.5rem !important;
          padding: 0 2.5rem 0 0.875rem !important;
          border-radius: 0.75rem !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          background-color: rgba(0,0,0,0.28) !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='rgba(255,255,255,0.45)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 0.875rem center !important;
          background-size: 12px 12px !important;
          color: rgba(255,255,255,0.88) !important;
          font-size: 0.8125rem !important;
          font-weight: 500 !important;
          letter-spacing: -0.01em !important;
          line-height: 1.25 !important;
          cursor: pointer !important;
          transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        .ws-settings-panel select:hover {
          border-color: rgba(255,255,255,0.14) !important;
          background-color: rgba(0,0,0,0.34) !important;
        }
        /* 聚焦/激活：中性白边，去掉 primary 蓝色描边 */
        .ws-settings-panel input[type="text"],
        .ws-settings-panel input[type="number"],
        .ws-settings-panel input[type="password"],
        .ws-settings-panel select,
        .ws-settings-panel textarea {
          outline: none !important;
          outline-color: transparent !important;
          --tw-ring-color: transparent !important;
        }
        .ws-settings-panel input[type="text"]:focus,
        .ws-settings-panel input[type="number"]:focus,
        .ws-settings-panel input[type="password"]:focus,
        .ws-settings-panel input[type="text"]:focus-visible,
        .ws-settings-panel input[type="number"]:focus-visible,
        .ws-settings-panel input[type="password"]:focus-visible,
        .ws-settings-panel input[type="text"]:active,
        .ws-settings-panel input[type="number"]:active,
        .ws-settings-panel input[type="password"]:active,
        .ws-settings-panel select:focus,
        .ws-settings-panel select:focus-visible,
        .ws-settings-panel select:active,
        .ws-settings-panel textarea:focus,
        .ws-settings-panel textarea:focus-visible,
        .ws-settings-panel textarea:active {
          border-color: rgba(255,255,255,0.18) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.05) !important;
          outline: none !important;
          outline-color: transparent !important;
        }
        .ws-settings-panel select:focus {
          background-color: rgba(0,0,0,0.34) !important;
        }
        .ws-settings-panel select option {
          background: #1c1c1f;
          color: rgba(255,255,255,0.9);
          padding: 0.5rem;
        }
        [data-theme="light"] .ws-settings-panel select {
          border-color: var(--theme-modal-border) !important;
          background-color: var(--theme-settings-input-bg) !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='rgba(0,0,0,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
          color: var(--theme-text-primary) !important;
        }
        [data-theme="light"] .ws-settings-panel select:hover {
          border-color: color-mix(in srgb, var(--theme-text-primary) 22%, transparent) !important;
        }
        [data-theme="light"] .ws-settings-panel input[type="text"]:focus,
        [data-theme="light"] .ws-settings-panel input[type="number"]:focus,
        [data-theme="light"] .ws-settings-panel input[type="password"]:focus,
        [data-theme="light"] .ws-settings-panel input[type="text"]:focus-visible,
        [data-theme="light"] .ws-settings-panel input[type="number"]:focus-visible,
        [data-theme="light"] .ws-settings-panel input[type="password"]:focus-visible,
        [data-theme="light"] .ws-settings-panel select:focus,
        [data-theme="light"] .ws-settings-panel select:focus-visible,
        [data-theme="light"] .ws-settings-panel textarea:focus,
        [data-theme="light"] .ws-settings-panel textarea:focus-visible {
          border-color: color-mix(in srgb, var(--theme-text-primary) 28%, transparent) !important;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.06) !important;
          outline: none !important;
        }
        [data-theme="light"] .ws-settings-panel select option {
          background: #fff;
          color: var(--theme-text-primary);
        }
        .ws-settings-panel form > div + div,
        .ws-settings-panel > .relative > form + div,
        .ws-settings-panel > .w-full > form + div,
        .ws-settings-panel > .relative.flex > form + div {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 1.5rem;
        }
        [data-theme="light"] .ws-settings-panel form > div + div,
        [data-theme="light"] .ws-settings-panel > .relative > form + div,
        [data-theme="light"] .ws-settings-panel > .w-full > form + div {
          border-top-color: var(--theme-modal-border);
        }
        .ws-settings-panel button[class*="bg-red"] {
          border-radius: 0.65rem !important;
        }
      `}</style>
      </div>
    </SettingsSaveProvider>
  );
}

function NavItem({ item, active }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={[
        "relative flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors shrink-0",
        active
          ? "text-white light:text-theme-text-primary"
          : "text-white/40 light:text-theme-text-secondary hover:text-white/75 light:hover:text-theme-text-primary",
      ].join(" ")}
    >
      <Icon
        size={14}
        weight={active ? "fill" : "regular"}
        className={
          active
            ? "text-white/90 light:text-theme-text-primary"
            : "text-white/30 light:text-theme-text-secondary"
        }
      />
      <span>{item.title}</span>
      {active && (
        <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-white/80 light:bg-theme-text-primary" />
      )}
    </NavLink>
  );
}
