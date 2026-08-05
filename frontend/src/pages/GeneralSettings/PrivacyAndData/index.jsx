import { useEffect, useState } from "react";
import SettingsPage from "@/components/SettingsSidebar/SettingsPage";
import showToast from "@/utils/toast";
import System from "@/models/system";
import PreLoader from "@/components/Preloader";
import { useTranslation } from "react-i18next";
import ProviderPrivacy from "@/components/ProviderPrivacy";
import Toggle from "@/components/lib/Toggle";

export default function PrivacyAndDataHandling() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const settings = await System.keys();
      setSettings(settings);
      setLoading(false);
    }
    fetchSettings();
  }, []);

  return (
    <SettingsPage
      title={t("privacy.title")}
      description={t("privacy.description")}
    >
      {loading ? (
        <div className="py-16 flex justify-center items-center">
          <PreLoader />
        </div>
      ) : (
        <div className="flex flex-col gap-y-6">
          <ProviderPrivacy />
          <TelemetryLogs settings={settings} />
        </div>
      )}
    </SettingsPage>
  );
}

function TelemetryLogs({ settings }) {
  const [telemetry, setTelemetry] = useState(
    settings?.DisableTelemetry !== "true"
  );
  const { t } = useTranslation();
  async function toggleTelemetry() {
    await System.updateSystem({
      DisableTelemetry: !telemetry ? "false" : "true",
    });
    setTelemetry(!telemetry);
    showToast(
      `已${!telemetry ? "开启" : "关闭"}匿名用量统计。`,
      "info",
      { clear: true }
    );
  }

  return (
    <div className="relative w-full max-h-full">
      <div className="relative rounded-lg">
        <div className="space-y-6 flex h-full w-full">
          <div className="w-full flex flex-col gap-y-4">
            <div className="">
              <Toggle
                size="lg"
                className="mb-4"
                label={t("privacy.anonymous")}
                enabled={telemetry}
                onChange={toggleTelemetry}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-left space-y-2">
          <p className="text-theme-text-secondary text-xs rounded-lg w-96 leading-relaxed">
            统计里不会记录 IP，也不包含可识别个人的内容、设置、对话或其他非用量信息。采集了哪些事件标签，可以在{" "}
            <a
              href="https://github.com/search?q=repo%3AMintplex-Labs%2Fanything-llm%20.sendTelemetry(&type=code"
              className="underline text-blue-400"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            上查看。
          </p>
          <p className="text-theme-text-secondary text-xs rounded-lg w-96 leading-relaxed">
            我们尊重隐私。关掉用量统计完全没问题；若愿意，也可以把使用感受发回来，方便把产品做得更好。{" "}
            <a
              href="mailto:team@mintplexlabs.com"
              className="underline text-blue-400"
              target="_blank"
              rel="noreferrer"
            >
              team@mintplexlabs.com
            </a>
            。
          </p>
        </div>
      </div>
    </div>
  );
}
