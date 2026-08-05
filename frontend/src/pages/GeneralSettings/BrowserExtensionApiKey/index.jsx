import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { PlusCircle } from "@phosphor-icons/react";
import BrowserExtensionApiKey from "@/models/browserExtensionApiKey";
import BrowserExtensionApiKeyRow from "./BrowserExtensionApiKeyRow";
import NewBrowserExtensionApiKeyModal from "./NewBrowserExtensionApiKeyModal";
import ModalWrapper from "@/components/ModalWrapper";
import { useModal } from "@/hooks/useModal";
import { fullApiUrl } from "@/utils/constants";
import { Tooltip } from "react-tooltip";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";

export default function BrowserExtensionApiKeys() {
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState([]);
  const [error, setError] = useState(null);
  const { isOpen, openModal, closeModal } = useModal();
  const [isMultiUser, setIsMultiUser] = useState(false);

  useEffect(() => {
    fetchExistingKeys();
  }, []);

  const fetchExistingKeys = async () => {
    const result = await BrowserExtensionApiKey.getAll();
    if (result.success) {
      setApiKeys(result.apiKeys);
      setIsMultiUser(result.apiKeys.some((key) => key.user !== null));
    } else {
      setError(result.error || "加载失败");
    }
    setLoading(false);
  };

  const removeApiKey = (id) => {
    setApiKeys((prevKeys) => prevKeys.filter((apiKey) => apiKey.id !== id));
  };

  return (
    <SettingsPage
      wide
      title="浏览器扩展"
      description="管理用于连接本机的浏览器扩展密钥。"
      headerRight={
        <SettingsSaveBtn onClick={openModal}>
          <span className="inline-flex items-center gap-1">
            <PlusCircle className="h-3.5 w-3.5" weight="bold" />
            生成密钥
          </span>
        </SettingsSaveBtn>
      }
    >
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
            ) : error ? (
              <div className="text-red-500 mt-6">{error}</div>
            ) : (
              <table className="w-full text-xs text-left rounded-lg min-w-[640px] border-spacing-0 md:mt-6 mt-0">
                <thead className="text-theme-text-secondary text-xs leading-[18px] font-bold uppercase border-white/10 border-b">
                  <tr>
                    <th scope="col" className="px-6 py-2 rounded-tl-lg">
                      API Key
                    </th>
                    {isMultiUser && (
                      <th scope="col" className="px-6 py-2">
                        创建者
                      </th>
                    )}
                    <th scope="col" className="px-6 py-2">
                      创建时间
                    </th>
                    <th scope="col" className="px-6 py-2 rounded-tr-lg">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.length === 0 ? (
                    <tr className="bg-transparent text-theme-text-secondary text-sm font-medium">
                      <td
                        colSpan={isMultiUser ? "4" : "3"}
                        className="px-6 py-4 text-center"
                      >
                        还没有密钥
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((apiKey) => (
                      <BrowserExtensionApiKeyRow
                        key={apiKey.id}
                        apiKey={apiKey}
                        removeApiKey={removeApiKey}
                        connectionString={`${fullApiUrl()}|${apiKey.key}`}
                        isMultiUser={isMultiUser}
                      />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
      <ModalWrapper isOpen={isOpen}>
        <NewBrowserExtensionApiKeyModal
          closeModal={closeModal}
          onSuccess={fetchExistingKeys}
          isMultiUser={isMultiUser}
        />
      </ModalWrapper>
      <Tooltip
        id="auto-connection"
        place="bottom"
        delayShow={300}
        className="allm-tooltip !allm-text-xs"
      />
      <Tooltip
        id="copy-connection-text"
        place="bottom"
        delayShow={300}
        className="allm-tooltip !allm-text-xs"
      />
    </SettingsPage>
  );
}
