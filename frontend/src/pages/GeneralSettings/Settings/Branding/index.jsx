import SettingsPage from "@/components/SettingsSidebar/SettingsPage";
import FooterCustomization from "../components/FooterCustomization";
import SupportEmail from "../components/SupportEmail";
import CustomLogo from "../components/CustomLogo";
import { useTranslation } from "react-i18next";
import CustomAppName from "../components/CustomAppName";
import CustomSiteSettings from "../components/CustomSiteSettings";

export default function BrandingSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t("customization.branding.title")}
      description={t("customization.branding.description")}
    >
      <div className="flex flex-col gap-4">
        <CustomAppName />
        <CustomLogo />
        <FooterCustomization />
        <SupportEmail />
        <CustomSiteSettings />
      </div>
    </SettingsPage>
  );
}
