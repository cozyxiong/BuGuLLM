import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isMobile } from "react-device-detect";
import { CircleNotch } from "@phosphor-icons/react";
import Telegram from "@/models/telegram";
import ConnectedView from "./ConnectedView";
import SetupView from "./SetupView";
import { useTranslation } from "react-i18next";
import System from "@/models/system";
import paths from "@/utils/paths";
import SettingsPage from "@/components/SettingsSidebar/SettingsPage";

export default function TelegramBotSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const [isMultiUserMode, configRes] = await Promise.all([
        System.isMultiUserMode(),
        Telegram.getConfig(),
      ]);

      if (isMultiUserMode) navigate(paths.home());
      setConfig(configRes?.config || null);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleConnected = (newConfig) => setConfig(newConfig);
  const handleDisconnected = () => setConfig(null);

  if (loading) {
    return (
      <ConnectionsLayout>
        <div className="flex items-center justify-center h-full">
          <CircleNotch className="h-8 w-8 text-zinc-400 light:text-slate-400 animate-spin" />
        </div>
      </ConnectionsLayout>
    );
  }

  const hasConfig = config?.active && config?.bot_username;
  if (!hasConfig) {
    return (
      <ConnectionsLayout fullPage={true}>
        <SetupView onConnected={handleConnected} />
      </ConnectionsLayout>
    );
  }

  return (
    <ConnectionsLayout fullPage={true}>
      <ConnectedView
        config={config}
        onDisconnected={handleDisconnected}
        onReconnected={handleConnected}
      />
    </ConnectionsLayout>
  );
}

function ConnectionsLayout({ children, fullPage = false }) {
  const { t } = useTranslation();
  if (!fullPage) return children;
  return (
    <SettingsPage
      title={t("telegram.title")}
      description={t("telegram.description")}
    >
      <a
        href={paths.docs("/channels/telegram")}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-theme-text-secondary hover:text-theme-text-primary underline w-fit -mt-4 mb-6 inline-block"
      >
        查看文档
      </a>
      {children}
    </SettingsPage>
  );
}
