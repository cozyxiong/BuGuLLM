import React, { useEffect, useState } from "react";
import paths from "@/utils/paths";
import {
  ArrowLeft,
  Brain,
  Database,
  Graph,
  Scissors,
  SpeakerHigh,
  Microphone,
  Monitor,
  PaintBrush,
  ChatCircleDots,
  ShieldCheck,
  LockSimple,
  List,
  Wrench,
  Robot,
  Key,
  Plugs,
  PuzzlePiece,
  BracketsCurly,
  GitBranch,
  ClockCountdown,
  TelegramLogo,
  SquaresFour,
  ChatText,
  ListBullets,
  Notepad,
} from "@phosphor-icons/react";
import useUser from "@/hooks/useUser";
import { isMobile } from "react-device-detect";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Option from "./MenuOption";
import "./settings.css";

/** 左侧品牌（返回 + 标识 + 标题） */
function SidebarBrand() {
  return (
    <div className="shrink-0 flex items-center gap-2.5 pr-3">
      <Link
        to={paths.home()}
        className="flex items-center justify-center w-8 h-8 rounded-xl text-theme-text-secondary hover:text-theme-text-primary bg-theme-sidebar-footer-icon hover:bg-theme-sidebar-footer-icon-hover transition-colors"
        title="返回知识库"
        aria-label="返回知识库"
      >
        <ArrowLeft size={15} weight="bold" />
      </Link>
      <div className="flex items-center min-w-0 gap-2">
        <Wrench
          size={15}
          weight="fill"
          className="text-white/35 light:text-theme-text-secondary shrink-0"
        />
        <span className="text-[13px] font-medium text-white/90 light:text-theme-text-primary tracking-tight">
          系统设置
        </span>
      </div>
    </div>
  );
}

export default function SettingsSidebar() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBgOverlay, setShowBgOverlay] = useState(false);

  useEffect(() => {
    document.body.classList.add("settings-app");
    return () => document.body.classList.remove("settings-app");
  }, []);

  useEffect(() => {
    if (showSidebar) {
      const timer = setTimeout(() => setShowBgOverlay(true), 180);
      return () => clearTimeout(timer);
    }
    setShowBgOverlay(false);
  }, [showSidebar]);

  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 h-12 bg-theme-bg-primary border-b border-theme-modal-border">
          <button
            type="button"
            onClick={() => setShowSidebar(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors"
            aria-label="打开设置菜单"
          >
            <List className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-theme-text-primary">
            系统设置
          </span>
        </div>
        <div
          style={{
            transform: showSidebar ? "translateX(0)" : "translateX(-100%)",
          }}
          className="z-50 fixed inset-0 transition-transform duration-300"
        >
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
              showBgOverlay ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setShowSidebar(false)}
          />
          <div className="relative h-full w-[82%] max-w-[280px] bg-theme-bg-primary border-r border-theme-modal-border flex flex-col">
            <div className="h-12 px-3 flex items-center border-b border-theme-modal-border">
              <SidebarBrand />
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3 no-scroll">
              <SidebarOptions user={user} t={t} />
            </nav>
          </div>
        </div>
      </>
    );
  }

  return (
    <aside className="h-full shrink-0 w-[240px] flex flex-col bg-theme-bg-primary border-r border-theme-modal-border">
      <div className="h-12 px-3 flex items-center border-b border-theme-modal-border">
        <SidebarBrand />
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3 no-scroll">
        <SidebarOptions user={user} t={t} />
      </nav>
    </aside>
  );
}

function GroupLabel({ children }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[11px] font-medium text-theme-text-secondary/80 first:pt-1">
      {children}
    </p>
  );
}

const ic = (Icon) => (
  <Icon className="h-3.5 w-3.5 flex-shrink-0" weight="duotone" />
);

const SidebarOptions = ({ user = null, t }) => (
  <>
    <GroupLabel>{t("settings.ai-providers")}</GroupLabel>
    <Option
      btnText={t("settings.llm")}
      href={paths.settings.llmPreference()}
      icon={ic(Brain)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.embedder")}
      href={paths.settings.embedder.modelPreference()}
      icon={ic(Graph)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.text-splitting")}
      href={paths.settings.embedder.chunkingPreference()}
      icon={ic(Scissors)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.vector-database")}
      href={paths.settings.vectorDatabase()}
      icon={ic(Database)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.voice-speech")}
      href={paths.settings.audioPreference()}
      icon={ic(SpeakerHigh)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.transcription")}
      href={paths.settings.transcriptionPreference()}
      icon={ic(Microphone)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.model-router")}
      href={paths.settings.modelRouters()}
      icon={ic(GitBranch)}
      user={user}
      flex
      roles={["admin"]}
    />

    <GroupLabel>{t("settings.agent-skills")}</GroupLabel>
    <Option
      btnText={t("settings.agent-skills")}
      href={paths.settings.agentSkills()}
      icon={ic(Robot)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.scheduled-jobs")}
      href={paths.settings.scheduledJobs()}
      icon={ic(ClockCountdown)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.default-system-prompt")}
      href={paths.settings.defaultSystemPrompt()}
      icon={ic(Notepad)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.system-prompt-variables")}
      href={paths.settings.systemPromptVariables()}
      icon={ic(BracketsCurly)}
      user={user}
      flex
      roles={["admin"]}
    />

    <GroupLabel>{t("settings.customization")}</GroupLabel>
    <Option
      btnText={t("settings.interface")}
      href={paths.settings.interface()}
      icon={ic(Monitor)}
      user={user}
      flex
      roles={["admin", "manager"]}
    />
    <Option
      btnText={t("settings.branding")}
      href={paths.settings.branding()}
      icon={ic(PaintBrush)}
      user={user}
      flex
      roles={["admin", "manager"]}
    />
    <Option
      btnText={t("settings.chat")}
      href={paths.settings.chat()}
      icon={ic(ChatCircleDots)}
      user={user}
      flex
      roles={["admin", "manager"]}
    />

    <GroupLabel>{t("settings.tools")}</GroupLabel>
    <Option
      btnText={t("settings.api-keys")}
      href={paths.settings.apiKeys()}
      icon={ic(Key)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.browser-extension")}
      href={paths.settings.browserExtension()}
      icon={ic(PuzzlePiece)}
      user={user}
      flex
      roles={["admin", "manager"]}
    />
    <Option
      btnText={t("settings.embeds")}
      href={paths.settings.embedChatWidgets()}
      icon={ic(Plugs)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.available-channels.telegram")}
      href={paths.settings.telegram()}
      icon={ic(TelegramLogo)}
      user={user}
      flex
      roles={["admin"]}
    />

    <GroupLabel>{t("settings.admin")}</GroupLabel>
    <Option
      btnText={t("settings.workspaces")}
      href={paths.settings.workspaces()}
      icon={ic(SquaresFour)}
      user={user}
      flex
      roles={["admin", "manager"]}
    />
    <Option
      btnText={t("settings.workspace-chats")}
      href={paths.settings.chats()}
      icon={ic(ChatText)}
      user={user}
      flex
      roles={["admin", "manager"]}
    />
    <Option
      btnText={t("settings.event-logs")}
      href={paths.settings.logs()}
      icon={ic(ListBullets)}
      user={user}
      flex
      roles={["admin"]}
    />
    <Option
      btnText={t("settings.security")}
      icon={ic(ShieldCheck)}
      href={paths.settings.security()}
      user={user}
      flex
      roles={["admin", "manager"]}
      hidden={user?.role}
    />
    <Option
      btnText={t("settings.privacy")}
      icon={ic(LockSimple)}
      href={paths.settings.privacy()}
      user={user}
      flex
      roles={["admin"]}
      hidden={user?.hasOwnProperty("role") && user.role !== "admin"}
    />
  </>
);
