import SettingsPage, {
  SettingsCard,
} from "@/components/SettingsSidebar/SettingsPage";
import { useTranslation } from "react-i18next";
import AutoSubmit from "../components/AutoSubmit";
import AutoSpeak from "../components/AutoSpeak";
import SpellCheck from "../components/SpellCheck";
import ShowScrollbar from "../components/ShowScrollbar";
import ChatRenderHTML from "../components/ChatRenderHTML";

export default function ChatSettings() {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t("customization.chat.title")}
      description={t("customization.chat.description")}
    >
      <SettingsCard className="py-2">
        <AutoSubmit />
        <AutoSpeak />
        <SpellCheck />
        <ShowScrollbar />
        <ChatRenderHTML />
      </SettingsCard>
    </SettingsPage>
  );
}
