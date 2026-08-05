import { useTranslation } from "react-i18next";
import SettingsPage, {
  SettingsCard,
} from "@/components/SettingsSidebar/SettingsPage";
import LanguagePreference from "../components/LanguagePreference";
import ThemePreference from "../components/ThemePreference";

export default function InterfaceSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t("customization.interface.title")}
      description={t("customization.interface.description")}
    >
      <SettingsCard>
        <ThemePreference />
        <LanguagePreference />
      </SettingsCard>
    </SettingsPage>
  );
}
