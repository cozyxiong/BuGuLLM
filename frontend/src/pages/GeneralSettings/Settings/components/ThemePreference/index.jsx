import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/SettingsSidebar/SettingsPage";

export default function ThemePreference() {
  const { t } = useTranslation();
  const { theme, setTheme, availableThemes } = useTheme();

  return (
    <SettingsRow
      title={t("customization.items.theme.title")}
      description={t("customization.items.theme.description")}
    >
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="min-w-[160px] bg-theme-settings-input-bg border border-theme-modal-border text-theme-text-primary text-[13px] rounded-xl outline-none py-2 px-3"
      >
        {Object.entries(availableThemes).map(([key, value]) => (
          <option key={key} value={key}>
            {value}
          </option>
        ))}
      </select>
    </SettingsRow>
  );
}
