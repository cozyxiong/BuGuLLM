import React, { useEffect, useState, useRef } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import {
  SettingsPageHeader,
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";
import OpenAiLogo from "@/media/llmprovider/openai.png";
import DeepgramLogo from "@/media/ttsproviders/deepgram.png";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import LemonadeLogo from "@/media/llmprovider/lemonade.png";
import GenericOpenAiLogo from "@/media/llmprovider/generic-openai.png";
import GroqLogo from "@/media/llmprovider/groq.png";

import BrowserNative from "@/components/SpeechToText/BrowserNative";
import OpenAiSTTOptions from "@/components/SpeechToText/OpenAiOptions";
import DeepgramSTTOptions from "@/components/SpeechToText/DeepgramOptions";
import LemonadeSTTOptions from "@/components/SpeechToText/LemonadeOptions";
import GenericOpenAiSTTOptions from "@/components/SpeechToText/GenericOpenAiOptions";
import GroqSTTOptions from "@/components/SpeechToText/GroqOptions";

const PROVIDERS = [
  {
    name: "浏览器自带",
    value: "native",
    logo: AnythingLLMIcon,
    options: (settings) => <BrowserNative settings={settings} />,
    description: "用浏览器自带的语音识别（若支持）。",
  },
  {
    name: "OpenAI",
    value: "openai",
    logo: OpenAiLogo,
    options: (settings) => <OpenAiSTTOptions settings={settings} />,
    description: "用 OpenAI Whisper API 把语音转成文字。",
  },
  {
    name: "Lemonade",
    value: "lemonade",
    logo: LemonadeLogo,
    options: (settings) => <LemonadeSTTOptions settings={settings} />,
    description: "通过本机 Lemonade 做语音转写。",
  },
  {
    name: "Deepgram",
    value: "deepgram",
    logo: DeepgramLogo,
    options: (settings) => <DeepgramSTTOptions settings={settings} />,
    description: "使用 Deepgram 的 Nova 模型转写。",
  },
  {
    name: "Groq",
    value: "groq",
    logo: GroqLogo,
    options: (settings) => <GroqSTTOptions settings={settings} />,
    description: "使用 Groq 托管模型做转写。",
  },
  {
    name: "OpenAI 兼容接口",
    value: "generic-openai",
    logo: GenericOpenAiLogo,
    options: (settings) => <GenericOpenAiSTTOptions settings={settings} />,
    description:
      "自行填写地址，接入 OpenAI 兼容的语音识别接口。",
  },
];

export default function SpeechToTextProvider({ settings }) {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(
    settings?.SpeechToTextProvider || "native"
  );
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = { SpeechToTextProvider: selectedProvider };
    const formData = new FormData(form);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`保存失败：${error}`, "error");
    } else {
      showToast("语音识别设置已保存。", "success");
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
    const filtered = PROVIDERS.filter((provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProviders(filtered);
  }, [searchQuery, selectedProvider]);

  const selectedProviderObject = PROVIDERS.find(
    (provider) => provider.value === selectedProvider
  );

  return (
    <form
      id="stt-preference-form"
      onSubmit={handleSubmit}
      className="flex w-full"
    >
      <div className="flex flex-col w-full">
        <SettingsPageHeader
          title="语音识别"
          description="聊天时对着麦克风说话，实时变成输入文字。"
          headerRight={
            hasChanges ? (
              <SettingsSaveBtn
                onClick={() =>
                  document
                    .getElementById("stt-preference-form")
                    ?.requestSubmit()
                }
                disabled={saving}
              >
                {saving ? "保存中…" : "保存更改"}
              </SettingsSaveBtn>
            ) : null
          }
        />
        <div className="text-sm font-semibold text-theme-text-primary mb-3">
          语音识别服务
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
                    name="stt-provider-search"
                    autoComplete="off"
                    placeholder="搜索语音识别服务"
                    className="border-none -ml-4 my-2 bg-transparent z-20 pl-12 h-[38px] w-full px-4 py-1 text-sm outline-none text-theme-text-primary placeholder:text-theme-text-primary placeholder:font-medium"
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
  );
}
