import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isMobile } from "react-device-detect";
import { ArrowsInSimple } from "@phosphor-icons/react";
import useUser from "@/hooks/useUser";
import { useModal } from "@/hooks/useModal";
import LLMSelectorModal from "../PromptInput/LLMSelector/index";
import SetupProvider from "../PromptInput/LLMSelector/SetupProvider";
import {
  SAVE_LLM_SELECTOR_EVENT,
  PROVIDER_SETUP_EVENT,
} from "../PromptInput/LLMSelector/action";
import Workspace from "@/models/workspace";
import System from "@/models/system";
import ModelRouterAPI from "@/models/modelRouter";
import { SIDEBAR_TOGGLE_EVENT } from "@/components/Sidebar/SidebarToggle";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";

async function resolveModelName(workspace, systemSettings, t) {
  const effectiveProvider =
    workspace.chatProvider ?? systemSettings?.LLMProvider;

  if (effectiveProvider !== "anythingllm-router")
    return workspace.chatModel ?? systemSettings?.LLMModel ?? "";

  const routerId = workspace.router_id || systemSettings?.ModelRouterId;
  if (!routerId) return t("model-router.metrics.model-router-default");

  const { router } = await ModelRouterAPI.get(routerId);
  if (!router?.name) return t("model-router.metrics.model-router-default");

  return router.name;
}

async function fetchModelName(slug, setModelName, t) {
  if (!slug) return;
  const [workspace, systemSettings] = await Promise.all([
    Workspace.bySlug(slug),
    System.keys(),
  ]);
  setModelName(await resolveModelName(workspace, systemSettings, t));
}

export default function WorkspaceModelPicker({ workspaceSlug = null }) {
  const { t } = useTranslation();
  const { slug: urlSlug } = useParams();
  const slug = urlSlug ?? workspaceSlug;
  const { user } = useUser();
  const { chatMode, setChatMode } = useWorkspaceUI();
  const [showSelector, setShowSelector] = useState(false);
  const [modelName, setModelName] = useState("");
  const {
    isOpen: isSetupProviderOpen,
    openModal: openSetupProviderModal,
    closeModal: closeSetupProviderModal,
  } = useModal();
  const [config, setConfig] = useState({ settings: {}, provider: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.localStorage.getItem("anythingllm_sidebar_toggle") !== "closed"
  );
  const showCollapse = chatMode === "full";

  useEffect(() => {
    const handleToggle = (e) => setSidebarOpen(e.detail.open);
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleToggle);
  }, []);

  // Fetch current model name for display
  useEffect(() => {
    fetchModelName(slug, setModelName, t);
  }, [slug]);

  // Close selector and refresh model name when model is saved
  useEffect(() => {
    function handleSave() {
      setShowSelector(false);
      fetchModelName(slug, setModelName, t);
    }
    window.addEventListener(SAVE_LLM_SELECTOR_EVENT, handleSave);
    return () =>
      window.removeEventListener(SAVE_LLM_SELECTOR_EVENT, handleSave);
  }, [slug]);

  // Handle provider setup request
  useEffect(() => {
    function handleProviderSetup(e) {
      const { provider, settings } = e.detail;
      setConfig({ settings, provider });
      setTimeout(() => openSetupProviderModal(), 300);
    }
    window.addEventListener(PROVIDER_SETUP_EVENT, handleProviderSetup);
    return () =>
      window.removeEventListener(PROVIDER_SETUP_EVENT, handleProviderSetup);
  }, []);

  // 非 admin 不显示型号选择，但仍可能需要「缩小」按钮
  const canPickModel = !user || user.role === "admin";
  if (!slug || isMobile) return null;
  if (!canPickModel && !showCollapse) return null;

  return (
    <>
      {showSelector && canPickModel && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowSelector(false)}
        />
      )}
      <div
        className={`hidden md:flex items-center gap-1.5 absolute top-2 z-30 transition-all duration-500 ${
          // fillPane 全屏对话时模型选择在内容区左上，不再跟侧栏折叠偏移
          showCollapse ? "left-3" : sidebarOpen ? "left-3" : "left-11"
        }`}
      >
        {canPickModel && (
          <button
            type="button"
            onClick={() => setShowSelector(!showSelector)}
            className={`group border-none cursor-pointer px-2.5 py-1 flex items-center rounded-full transition-all ${
              showSelector
                ? "bg-zinc-700 light:bg-slate-200"
                : "hover:bg-zinc-700 light:hover:bg-slate-200"
            }`}
          >
            <span
              className={`text-xs ${
                showSelector
                  ? "text-white light:text-slate-800"
                  : "text-zinc-500 light:text-slate-500 group-hover:text-white light:group-hover:text-slate-800"
              }`}
            >
              {modelName || t("chat_window.select_model")}
            </span>
          </button>
        )}

        {showCollapse && (
          <button
            type="button"
            onClick={() => setChatMode("fab")}
            className="border-none cursor-pointer px-2.5 py-1 flex items-center gap-1 rounded-full text-xs text-zinc-500 light:text-slate-500 hover:bg-zinc-700 light:hover:bg-slate-200 hover:text-white light:hover:text-slate-800 transition-all"
            title="缩小对话"
            aria-label="缩小对话"
          >
            <ArrowsInSimple size={14} weight="bold" />
            缩小
          </button>
        )}

        {showSelector && canPickModel && (
          <div className="absolute left-0 top-full mt-1 bg-zinc-800 light:bg-white border border-zinc-700 light:border-slate-300 rounded-xl shadow-lg w-[620px] overflow-hidden">
            <LLMSelectorModal
              key={refreshKey}
              workspaceSlug={slug}
              initialProvider={config.provider?.value}
            />
          </div>
        )}
      </div>

      <SetupProvider
        isOpen={isSetupProviderOpen}
        closeModal={closeSetupProviderModal}
        postSubmit={() => {
          closeSetupProviderModal();
          setRefreshKey((k) => k + 1);
        }}
        settings={config.settings}
        llmProvider={config.provider}
      />
    </>
  );
}
