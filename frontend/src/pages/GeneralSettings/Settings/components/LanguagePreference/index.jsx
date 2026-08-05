import { useLanguageOptions } from "@/hooks/useLanguageOptions";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/SettingsSidebar/SettingsPage";

export default function LanguagePreference() {
  const { t } = useTranslation();
  const {
    currentLanguage,
    supportedLanguages,
    getLanguageName,
    changeLanguage,
  } = useLanguageOptions();

  return (
    <SettingsRow
      title={t("customization.items.display-language.title")}
      description={t("customization.items.display-language.description")}
    >
      <select
        name="userLang"
        className="min-w-[160px] bg-theme-settings-input-bg border border-theme-modal-border text-theme-text-primary text-[13px] rounded-xl outline-none py-2 px-3"
        defaultValue={currentLanguage || "en"}
        onChange={(e) => changeLanguage(e.target.value)}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {getLanguageName(lang)}
          </option>
        ))}
      </select>
    </SettingsRow>
  );
}
