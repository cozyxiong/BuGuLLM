import { useState } from "react";
import { useTranslation } from "react-i18next";

const MODELS = [
  { value: "Xenova/whisper-small", label: "Whisper Small", size: "250 MB" },
  { value: "Xenova/whisper-large", label: "Whisper Large", size: "1.56 GB" },
];

export default function NativeTranscriptionOptions({ settings }) {
  const { t } = useTranslation();
  const [model, setModel] = useState(
    settings?.WhisperModelPref || MODELS[0].value
  );
  const selected = MODELS.find((m) => m.value === model) || MODELS[0];

  return (
    <div className="w-full flex flex-col gap-y-3">
      <div className="flex flex-col w-60">
        <label className="text-sm font-semibold text-white light:text-slate-900 mb-2">
          {t("common.selection")}
        </label>
        <select
          name="WhisperModelPref"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border-none bg-theme-settings-input-bg text-white light:text-slate-900 text-sm rounded-lg block w-full p-2.5"
        >
          {MODELS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="max-w-[640px] flex flex-col gap-1">
        <p className="text-xs leading-5 text-zinc-400 light:text-slate-600">
          {t("transcription.warn-start")} {t("transcription.warn-recommend")}
        </p>
        <p className="text-xs leading-5 text-zinc-500 light:text-slate-500">
          {t("transcription.warn-end", { size: selected.size })}
        </p>
      </div>
    </div>
  );
}
