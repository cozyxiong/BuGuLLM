import React, { useEffect, useState } from "react";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";
import PreLoader from "@/components/Preloader";
import Admin from "@/models/admin";
import showToast from "@/utils/toast";
import { numberWithCommas } from "@/utils/numbers";
import { useTranslation } from "react-i18next";
import { useModal } from "@/hooks/useModal";
import ModalWrapper from "@/components/ModalWrapper";
import ChangeWarningModal from "@/components/ChangeWarning";

function isNullOrNaN(value) {
  if (value === null) return true;
  return isNaN(value);
}

export default function EmbeddingTextSplitterPreference() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    if (
      Number(form.get("text_splitter_chunk_overlap")) >=
      Number(form.get("text_splitter_chunk_size"))
    ) {
      showToast(
        "Chunk overlap cannot be larger or equal to chunk size.",
        "error"
      );
      return;
    }

    openModal();
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const form = new FormData(
        document.getElementById("text-splitter-chunking-form")
      );
      await Admin.updateSystemPreferences({
        text_splitter_chunk_size: isNullOrNaN(
          form.get("text_splitter_chunk_size")
        )
          ? 1000
          : Number(form.get("text_splitter_chunk_size")),
        text_splitter_chunk_overlap: isNullOrNaN(
          form.get("text_splitter_chunk_overlap")
        )
          ? 1000
          : Number(form.get("text_splitter_chunk_overlap")),
      });
      setHasChanges(false);
      closeModal();
      showToast("Text chunking strategy settings saved.", "success");
    } catch {
      showToast("Failed to save text chunking strategy settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      const _settings = (
        await Admin.systemPreferencesByFields([
          "text_splitter_chunk_size",
          "text_splitter_chunk_overlap",
          "max_embed_chunk_size",
        ])
      )?.settings;
      setSettings(_settings ?? {});
      setLoading(false);
    }
    fetchSettings();
  }, []);

  return (
    <SettingsPage
      title={t("text.title")}
      description={`${t("text.desc-start")} ${t("text.desc-end")}`}
      headerRight={
        hasChanges && !loading ? (
          <SettingsSaveBtn
            onClick={() =>
              document
                .getElementById("text-splitter-chunking-form")
                ?.requestSubmit()
            }
            disabled={saving}
          >
            {saving ? t("common.saving") : t("common.save")}
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
            onSubmit={handleSubmit}
            onChange={() => setHasChanges(true)}
            className="flex w-full"
            id="text-splitter-chunking-form"
          >
            <div className="flex flex-col w-full">
              <div className="flex flex-col gap-y-4">
                <div className="flex flex-col max-w-[300px]">
                  <div className="flex flex-col gap-y-2 mb-4">
                    <label className="text-white text-sm font-semibold block">
                      {t("text.size.title")}
                    </label>
                    <p className="text-xs text-white/60">
                      {t("text.size.description")}
                    </p>
                  </div>
                  <input
                    type="number"
                    name="text_splitter_chunk_size"
                    min={1}
                    max={settings?.max_embed_chunk_size || 1000}
                    onWheel={(e) => e?.currentTarget?.blur()}
                    className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                    placeholder="向量化文本的最大长度"
                    defaultValue={
                      isNullOrNaN(settings?.text_splitter_chunk_size)
                        ? 1000
                        : Number(settings?.text_splitter_chunk_size)
                    }
                    required={true}
                    autoComplete="off"
                  />
                  <p className="text-xs text-white/40 mt-2">
                    {t("text.size.recommend")}{" "}
                    {numberWithCommas(settings?.max_embed_chunk_size || 1000)}.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-y-4 mt-8">
                <div className="flex flex-col max-w-[300px]">
                  <div className="flex flex-col gap-y-2 mb-4">
                    <label className="text-white text-sm font-semibold block">
                      {t("text.overlap.title")}
                    </label>
                    <p className="text-xs text-white/60">
                      {t("text.overlap.description")}
                    </p>
                  </div>
                  <input
                    type="number"
                    name="text_splitter_chunk_overlap"
                    min={0}
                    onWheel={(e) => e?.currentTarget?.blur()}
                    className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                    placeholder="向量化文本的最大长度"
                    defaultValue={
                      isNullOrNaN(settings?.text_splitter_chunk_overlap)
                        ? 20
                        : Number(settings?.text_splitter_chunk_overlap)
                    }
                    required={true}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </form>
      )}

      <ModalWrapper isOpen={isOpen}>
        <ChangeWarningModal
          warningText="Changing text splitter settings will clear any previously cached documents.\n\nThese new settings will be applied to all documents when embedding them into a workspace."
          onClose={closeModal}
          onConfirm={handleSaveSettings}
        />
      </ModalWrapper>
    </SettingsPage>
  );
}
