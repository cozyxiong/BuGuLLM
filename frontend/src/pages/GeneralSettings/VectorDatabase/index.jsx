import React, { useState, useEffect, useRef } from "react";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { useModal } from "@/hooks/useModal";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import PreLoader from "@/components/Preloader";
import ChangeWarningModal from "@/components/ChangeWarning";
import ModalWrapper from "@/components/ModalWrapper";
import VectorDBItem from "@/components/VectorDBSelection/VectorDBItem";

import LanceDbLogo from "@/media/vectordbs/lancedb.png";
import ChromaLogo from "@/media/vectordbs/chroma.png";
import PineconeLogo from "@/media/vectordbs/pinecone.png";
import WeaviateLogo from "@/media/vectordbs/weaviate.png";
import QDrantLogo from "@/media/vectordbs/qdrant.png";
import MilvusLogo from "@/media/vectordbs/milvus.png";
import ZillizLogo from "@/media/vectordbs/zilliz.png";
import AstraDBLogo from "@/media/vectordbs/astraDB.png";
import PGVectorLogo from "@/media/vectordbs/pgvector.png";

import LanceDBOptions from "@/components/VectorDBSelection/LanceDBOptions";
import ChromaDBOptions from "@/components/VectorDBSelection/ChromaDBOptions";
import ChromaCloudOptions from "@/components/VectorDBSelection/ChromaCloudOptions";
import PineconeDBOptions from "@/components/VectorDBSelection/PineconeDBOptions";
import WeaviateDBOptions from "@/components/VectorDBSelection/WeaviateDBOptions";
import QDrantDBOptions from "@/components/VectorDBSelection/QDrantDBOptions";
import MilvusDBOptions from "@/components/VectorDBSelection/MilvusDBOptions";
import ZillizCloudOptions from "@/components/VectorDBSelection/ZillizCloudOptions";
import AstraDBOptions from "@/components/VectorDBSelection/AstraDBOptions";
import PGVectorOptions from "@/components/VectorDBSelection/PGVectorOptions";

const VECTOR_DBS = [
  {
    name: "LanceDB",
    value: "lancedb",
    logo: LanceDbLogo,
    options: (_) => <LanceDBOptions />,
    description:
      "完全本地的向量数据库，和本系统跑在一起。",
  },
  {
    name: "PGVector",
    value: "pgvector",
    logo: PGVectorLogo,
    options: (settings) => <PGVectorOptions settings={settings} />,
    description: "基于 PostgreSQL 的向量检索。",
  },
  {
    name: "Chroma",
    value: "chroma",
    logo: ChromaLogo,
    options: (settings) => <ChromaDBOptions settings={settings} />,
    description:
      "开源向量数据库，可自建也可上云。",
  },
  {
    name: "Chroma Cloud",
    value: "chromacloud",
    logo: ChromaLogo,
    options: (settings) => <ChromaCloudOptions settings={settings} />,
    description:
      "Chroma 的托管云服务。",
  },
  {
    name: "Pinecone",
    value: "pinecone",
    logo: PineconeLogo,
    options: (settings) => <PineconeDBOptions settings={settings} />,
    description: "纯云端向量数据库，偏企业场景。",
  },
  {
    name: "Zilliz Cloud",
    value: "zilliz",
    logo: ZillizLogo,
    options: (settings) => <ZillizCloudOptions settings={settings} />,
    description:
      "面向企业的云端向量数据库（含 SOC 2）。",
  },
  {
    name: "QDrant",
    value: "qdrant",
    logo: QDrantLogo,
    options: (settings) => <QDrantDBOptions settings={settings} />,
    description: "开源向量数据库，可本机也可分布式部署。",
  },
  {
    name: "Weaviate",
    value: "weaviate",
    logo: WeaviateLogo,
    options: (settings) => <WeaviateDBOptions settings={settings} />,
    description:
      "开源多模态向量数据库，支持本机或云端。",
  },
  {
    name: "Milvus",
    value: "milvus",
    logo: MilvusLogo,
    options: (settings) => <MilvusDBOptions settings={settings} />,
    description: "开源、可扩展、检索很快。",
  },
  {
    name: "AstraDB",
    value: "astra",
    logo: AstraDBLogo,
    options: (settings) => <AstraDBOptions settings={settings} />,
    description: "面向实际生成式 AI 场景的向量检索。",
  },
];

export default function GeneralVectorDatabase() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasEmbeddings, setHasEmbeddings] = useState(false);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVDBs, setFilteredVDBs] = useState([]);
  const [selectedVDB, setSelectedVDB] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { isOpen, openModal, closeModal } = useModal();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedVDB !== settings?.VectorDB && hasChanges && hasEmbeddings) {
      openModal();
    } else {
      await handleSaveSettings();
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const form = document.getElementById("vectordb-form");
    const settingsData = {};
    const formData = new FormData(form);
    settingsData.VectorDB = selectedVDB;
    for (var [key, value] of formData.entries()) settingsData[key] = value;

    const { error } = await System.updateSystem(settingsData);
    if (error) {
      showToast(`Failed to save vector database settings: ${error}`, "error");
      setHasChanges(true);
    } else {
      showToast("Vector database preferences saved successfully.", "success");
      setHasChanges(false);
    }
    setSaving(false);
    closeModal();
  };

  const updateVectorChoice = (selection) => {
    setSearchQuery("");
    setSelectedVDB(selection);
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
      setSelectedVDB(_settings?.VectorDB || "lancedb");
      setHasEmbeddings(_settings?.HasExistingEmbeddings || false);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  useEffect(() => {
    const filtered = VECTOR_DBS.filter((vdb) =>
      vdb.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredVDBs(filtered);
  }, [searchQuery, selectedVDB]);

  const selectedVDBObject =
    VECTOR_DBS.find((vdb) => vdb.value === selectedVDB) ?? VECTOR_DBS[0];

  return (
    <SettingsPage
      title={t("vector.title")}
      description={t("vector.description")}
      headerRight={
        hasChanges && !loading ? (
          <SettingsSaveBtn
            onClick={() =>
              document.getElementById("vectordb-form")?.requestSubmit()
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
            id="vectordb-form"
            onSubmit={handleSubmit}
            className="flex w-full"
          >
            <div className="flex flex-col w-full">
              <div className="text-sm font-semibold text-theme-text-primary mb-3">
                {t("vector.provider.title")}
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
                          name="vdb-search"
                          autoComplete="off"
                          placeholder="搜索向量数据库"
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
                        {filteredVDBs.map((vdb) => (
                          <VectorDBItem
                            key={vdb.name}
                            name={vdb.name}
                            value={vdb.value}
                            image={vdb.logo}
                            description={vdb.description}
                            checked={selectedVDB === vdb.value}
                            onClick={() => updateVectorChoice(vdb.value)}
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
                        src={selectedVDBObject.logo}
                        alt={`${selectedVDBObject.name} logo`}
                        className="w-10 h-10 rounded-md"
                      />
                      <div className="flex flex-col text-left">
                        <div className="text-sm font-semibold text-theme-text-primary">
                          {selectedVDBObject.name}
                        </div>
                        <div className="mt-1 text-xs text-theme-text-secondary">
                          {selectedVDBObject.description}
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
                {selectedVDB &&
                  VECTOR_DBS.find((vdb) => vdb.value === selectedVDB)?.options(
                    settings
                  )}
              </div>
            </div>
          </form>
      )}
      <ModalWrapper isOpen={isOpen}>
        <ChangeWarningModal
          warningText="Switching the vector database will reset all previously embedded documents in all workspaces.\n\nConfirming will clear all embeddings from your vector database and remove all documents from your workspaces. Your uploaded documents will not be deleted, they will be available for re-embedding."
          onClose={closeModal}
          onConfirm={handleSaveSettings}
        />
      </ModalWrapper>
    </SettingsPage>
  );
}
