import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { PlusCircle } from "@phosphor-icons/react";
import Admin from "@/models/admin";
import ApiKeyRow from "./ApiKeyRow";
import NewApiKeyModal from "./NewApiKeyModal";
import paths from "@/utils/paths";
import { userFromStorage } from "@/utils/request";
import System from "@/models/system";
import ModalWrapper from "@/components/ModalWrapper";
import { useModal } from "@/hooks/useModal";
import { useTranslation } from "react-i18next";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";

export default function AdminApiKeys() {
  const { isOpen, openModal, closeModal } = useModal();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState([]);

  const fetchExistingKeys = async () => {
    const user = userFromStorage();
    const Model = !!user ? Admin : System;
    const { apiKeys: foundKeys } = await Model.getApiKeys();
    setApiKeys(foundKeys);
    setLoading(false);
  };

  useEffect(() => {
    fetchExistingKeys();
  }, []);

  const removeApiKey = (id) => {
    setApiKeys((prevKeys) => prevKeys.filter((apiKey) => apiKey.id !== id));
  };

  return (
    <SettingsPage
      wide
      title={t("api.title")}
      description={t("api.description")}
      headerRight={
        <SettingsSaveBtn onClick={openModal}>
          <span className="inline-flex items-center gap-1">
            <PlusCircle className="h-3.5 w-3.5" weight="bold" />
            {t("api.generate")}
          </span>
        </SettingsSaveBtn>
      }
    >
          <a
            href={paths.apiDocs()}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-theme-text-secondary hover:text-theme-text-primary hover:underline -mt-4 mb-6 inline-block"
          >
            {t("api.link")} →
          </a>
          <div className="overflow-x-auto">
            {loading ? (
              <Skeleton.default
                height="80vh"
                width="100%"
                highlightColor="var(--theme-bg-primary)"
                baseColor="var(--theme-bg-secondary)"
                count={1}
                className="w-full p-4 rounded-b-2xl rounded-tr-2xl rounded-tl-sm"
                containerClassName="flex w-full"
              />
            ) : (
              <table className="w-full text-xs text-left rounded-lg min-w-[720px] border-spacing-0 md:mt-6 mt-0">
                <thead className="text-theme-text-secondary text-xs leading-[18px] font-bold uppercase border-white/10 border-b">
                  <tr>
                    <th scope="col" className="px-6 py-3 rounded-tl-lg">
                      {t("api.table.name")}
                    </th>
                    <th scope="col" className="px-6 py-3">
                      {t("api.table.key")}
                    </th>
                    <th scope="col" className="px-6 py-3">
                      {t("api.table.by")}
                    </th>
                    <th scope="col" className="px-6 py-3">
                      {t("api.table.created")}
                    </th>
                    <th scope="col" className="px-6 py-3 rounded-tr-lg">
                      {t("api.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.length === 0 ? (
                    <tr className="bg-transparent text-theme-text-secondary text-sm font-medium">
                      <td colSpan="5" className="px-6 py-4 text-center">
                        {t("api.empty")}
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((apiKey) => (
                      <ApiKeyRow
                        key={apiKey.id}
                        apiKey={apiKey}
                        removeApiKey={removeApiKey}
                      />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        <ModalWrapper isOpen={isOpen}>
          <NewApiKeyModal
            closeModal={closeModal}
            onSuccess={fetchExistingKeys}
          />
        </ModalWrapper>
    </SettingsPage>
  );
}
