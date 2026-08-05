import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

function normalizeMode(mode) {
  if (mode === "chat") return "query";
  if (mode === "automatic") return "assistant";
  if (mode === "assistant" || mode === "query") return mode;
  return "query";
}

export default function ChatModeSelection({ workspace, setHasChanges }) {
  const { t } = useTranslation();
  const [chatMode, setChatMode] = useState(
    normalizeMode(workspace?.chatMode || "query")
  );

  return (
    <div className="flex flex-col gap-y-[8px]">
      <div className="flex flex-col gap-y-[8px]">
        <label htmlFor="chatMode" className="block input-label">
          {t("chat.mode.title")}
        </label>
      </div>

      <div className="flex flex-col gap-y-[8px]">
        <div className="w-fit flex gap-x-1 items-center p-1 rounded-lg bg-theme-settings-input-bg ">
          <input type="hidden" name="chatMode" value={chatMode} />
          <button
            type="button"
            disabled={chatMode === "query"}
            onClick={() => {
              setChatMode("query");
              setHasChanges(true);
            }}
            className="border-none transition-bg duration-200 px-6 py-1 text-md text-white/60 disabled:text-white bg-transparent disabled:bg-[#687280] rounded-md hover:bg-white/10 light:hover:bg-black/10"
          >
            {t("chat.mode.query.title")}
          </button>
          <button
            type="button"
            disabled={chatMode === "assistant"}
            onClick={() => {
              setChatMode("assistant");
              setHasChanges(true);
            }}
            className="border-none transition-bg duration-200 px-6 py-1 text-md text-white/60 disabled:text-white bg-transparent disabled:bg-[#687280] rounded-md hover:bg-white/10 light:hover:bg-black/10"
          >
            {t("chat.mode.assistant.title")}
          </button>
        </div>
        <ChatModeExplanation chatMode={chatMode} />
      </div>
    </div>
  );
}

/**
 * @param {'assistant' | 'query'} chatMode
 */
function ChatModeExplanation({ chatMode = "query" }) {
  const { t } = useTranslation();
  const key = chatMode === "assistant" ? "assistant" : "query";
  return (
    <p className="text-sm text-white/60">
      <b>{t(`chat.mode.${key}.title`)}</b>{" "}
      <Trans
        i18nKey={`chat.mode.${key}.description`}
        components={{ b: <b />, br: <br /> }}
      />
    </p>
  );
}
