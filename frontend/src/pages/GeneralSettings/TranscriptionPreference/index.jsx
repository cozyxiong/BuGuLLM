import React, { useEffect, useState, useRef } from "react";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";
import System from "@/models/system";
import showToast from "@/utils/toast";
import PreLoader from "@/components/Preloader";
import OpenAiLogo from "@/media/llmprovider/openai.png";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import OpenAiWhisperOptions from "@/components/TranscriptionSelection/OpenAiOptions";
import NativeTranscriptionOptions from "@/components/TranscriptionSelection/NativeTranscriptionOptions";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

const PROVIDERS = [
  {
    name: "OpenAI",
    value: "openai",
    logo: OpenAiLogo,
    options: (settings) => <OpenAiWhisperOptions settings={settings} />,
    description: "用 OpenAI Whisper-large 做转写。",
  },
  {
    name: "AnythingLLM Built-In",
    value: "local",
    logo: AnythingLLMIcon,
    options: (settings) => <NativeTranscriptionOptions settings={settings} />,
    description: "使用本机内置的 Whisper，数据不出本机。",
  },
];

export default function TranscriptionModelPreference() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = { WhisperProvider: selectedProvider };
    const formData = new FormData(form);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`Failed to save preferences: ${error}`, "error");
    } else {
      showToast("Transcription preferences saved successfully.", "success");
    }
    setSaving(false);
    setHasChanges(!!error);
  };

  const updateProviderChoice = (selection) => {
    setSearchQuery("");
    setSelectedProvider(selection);
    setSearchMenuOpen(false);
    setHasChanges(true);
  };

  const handleXButton = () => {
    if (searchQuery.length > 0) {
      setSearchQuery("");
      if (searchInputRef.current) searchInputRef.current.value = "";
    } else {
      setSearchMenuOpen(!searchMenuOpen);
    }
  };

  useEffect(() => {
    async function fetchKeys() {
      const _settings = await System.keys();
      setSettings(_settings);
      setSelectedProvider(_settings?.WhisperProvider || "local");
      setLoading(false);
    }
    fetchKeys();
  }, []);

  useEffect(() => {
    const filtered = PROVIDERS.filter((provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProviders(filtered);
  }, [searchQuery, selectedProvider]);

  const selectedProviderObject = PROVIDERS.find(
    (provider) => provider.value === selectedProvider
  );

  return (
    <SettingsPage
      title={t("transcription.title")}
      description={t("transcription.description")}
      headerRight={
        hasChanges && !loading ? (
          <SettingsSaveBtn
            onClick={() =>
              document
                .getElementById("transcription-preference-form")
                ?.requestSubmit()
            }
            disabled={saving}
          >
            {saving ? "保存中…" : "保存更改"}
          </SettingsSaveBtn>
        ) : null
      }
    >
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <PreLoader />
        </div>
      ) : (
        <form
          id="transcription-preference-form"
          onSubmit={handleSubmit}
          className="flex w-full"
        >
          <div className="flex flex-col w-full">
              <div className="text-sm font-semibold text-theme-text-primary mb-3">
                {t("transcription.provider")}
              </div>
              <div className="relative">
                {searchMenuOpen && (
                  <div
                    className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 backdrop-blur-sm z-10"
                    onClick={() => setSearchMenuOpen(false)}
                  />
                )}
                {searchMenuOpen ? (
                  <div className="absolute top-0 left-0 w-full max-w-[640px] max-h-[310px] min-h-[64px] bg-theme-settings-input-bg rounded-lg flex flex-col justify-between cursor-pointer border-2 border-primary-button z-20">
                    <div className="w-full flex flex-col gap-y-1">
                      <div className="flex items-center sticky top-0 z-10 border-b border-[#9CA3AF] mx-4 bg-theme-settings-input-bg">
                        <MagnifyingGlass
                          size={20}
                          weight="bold"
                          className="absolute left-4 z-30 text-theme-text-primary -ml-4 my-2"
                        />
                        <input
                          type="text"
                          name="provider-search"
                          autoComplete="off"
                          placeholder="搜索转写服务"
                          className="border-none -ml-4 my-2 bg-transparent z-20 pl-12 h-[38px] w-full px-4 py-1 text-sm outline-none focus:outline-primary-button active:outline-primary-button outline-none text-theme-text-primary placeholder:text-theme-text-primary placeholder:font-medium"
                          onChange={(e) => setSearchQuery(e.target.value)}
                          ref={searchInputRef}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                          }}
                        />
                        <X
                          size={20}
                          weight="bold"
                          className="cursor-pointer text-white hover:text-x-button"
                          onClick={handleXButton}
                        />
                      </div>
                      <div className="flex-1 pl-4 pr-2 flex flex-col gap-y-1 overflow-y-auto white-scrollbar pb-4 max-h-[245px]">
                        {filteredProviders.map((provider) => (
                          <LLMItem
                            key={provider.name}
                            name={provider.name}
                            value={provider.value}
                            image={provider.logo}
                            description={provider.description}
                            checked={selectedProvider === provider.value}
                            onClick={() => updateProviderChoice(provider.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full h-[64px] bg-theme-settings-input-bg rounded-xl flex items-center p-[14px] justify-between cursor-pointer border border-theme-modal-border hover:border-theme-button-primary/50 transition-all duration-200"
                    type="button"
                    onClick={() => setSearchMenuOpen(true)}
                  >
                    <div className="flex gap-x-4 items-center">
                      <img
                        src={selectedProviderObject.logo}
                        alt={`${selectedProviderObject.name} logo`}
                        className="w-10 h-10 rounded-md"
                      />
                      <div className="flex flex-col text-left">
                        <div className="text-sm font-semibold text-theme-text-primary">
                          {selectedProviderObject.name}
                        </div>
                        <div className="mt-1 text-xs text-theme-text-secondary">
                          {selectedProviderObject.description}
                        </div>
                      </div>
                    </div>
                    <CaretUpDown
                      size={20}
                      weight="bold"
                      className="text-theme-text-secondary"
                    />
                  </button>
                )}
              </div>
              <div
                onChange={() => setHasChanges(true)}
                className="mt-4 flex flex-col gap-y-1"
              >
                {selectedProvider &&
                  PROVIDERS.find(
                    (provider) => provider.value === selectedProvider
                  )?.options(settings)}
              </div>
            </div>
          </form>
      )}
    </SettingsPage>
  );
}
