import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isMobile } from "react-device-detect";
import {
  ArrowsInSimple,
  ArrowsOutSimple,
  Cube,
} from "@phosphor-icons/react";
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

export default function WorkspaceModelPicker({
  workspaceSlug = null,
  variant = "full",
}) {
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
  const showCollapse = chatMode === "full" || chatMode === "compose";
  const docked = chatMode === "compose";
  const iconOnly = variant === "icon";
  const controlsOnly = variant === "controls";
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 320 });

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
  if (iconOnly && !canPickModel) return null;
  if (!canPickModel && !showCollapse && !iconOnly) return null;

  const openIconMenu = () => {
    const next = !showSelector;
    if (next && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = Math.min(340, Math.max(280, window.innerWidth - 24));
      let left = r.left;
      if (left + width > window.innerWidth - 10)
        left = Math.max(10, window.innerWidth - width - 10);
      if (left < 10) left = 10;
      setMenuPos({ top: r.bottom + 8, left, width });
    }
    setShowSelector(next);
  };

  const setupModal = (
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
  );

  if (iconOnly) {
    return (
      <>
        <button
          ref={btnRef}
          type="button"
          onClick={openIconMenu}
          title={modelName || t("chat_window.select_model")}
          aria-label={modelName || t("chat_window.select_model")}
          className={`group border-none cursor-pointer flex items-center justify-center w-[35px] h-[35px] rounded-full transition-all ${
            showSelector
              ? "bg-zinc-700 light:bg-slate-200"
              : "hover:bg-zinc-700 light:hover:bg-slate-200"
          }`}
        >
          <Cube
            size={18}
            className={
              showSelector
                ? "text-white light:text-slate-800"
                : "text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-800"
            }
          />
        </button>
        {showSelector
          ? createPortal(
              <>
                <div
                  className="fixed inset-0 z-[70]"
                  onClick={() => setShowSelector(false)}
                />
                <div
                  className="fixed z-[80] rounded-2xl border border-zinc-700/80 light:border-slate-200 bg-zinc-800 light:bg-white shadow-[0_16px_48px_rgba(0,0,0,0.28)] overflow-hidden"
                  style={{
                    top: menuPos.top,
                    left: menuPos.left,
                    width: menuPos.width,
                  }}
                >
                  <LLMSelectorModal
                    key={refreshKey}
                    compact
                    workspaceSlug={slug}
                    initialProvider={config.provider?.value}
                  />
                </div>
              </>,
              document.body
            )
          : null}
        {setupModal}
      </>
    );
  }

  if (controlsOnly) {
    return (
      <>
        <div className="hidden md:flex items-center gap-1 absolute top-2 right-2 z-30">
          <button
            type="button"
            onClick={() => setChatMode("full")}
            className="border-none cursor-pointer flex items-center justify-center w-[35px] h-[35px] rounded-full text-zinc-300 light:text-slate-600 hover:bg-zinc-700 light:hover:bg-slate-200 hover:text-white light:hover:text-slate-800 transition-all"
            title="全屏对话"
            aria-label="全屏对话"
          >
            <ArrowsOutSimple size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setChatMode("fab")}
            className="border-none cursor-pointer flex items-center justify-center w-[35px] h-[35px] rounded-full text-zinc-300 light:text-slate-600 hover:bg-zinc-700 light:hover:bg-slate-200 hover:text-white light:hover:text-slate-800 transition-all"
            title="缩小对话"
            aria-label="缩小对话"
          >
            <ArrowsInSimple size={16} weight="bold" />
          </button>
        </div>
        {setupModal}
      </>
    );
  }

  return (
    <>
      {showSelector && canPickModel && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowSelector(false)}
        />
      )}
      <div
        className={`hidden md:flex items-center gap-1.5 absolute z-30 transition-all duration-500 top-2 ${
          showCollapse ? "left-3" : sidebarOpen ? "left-3" : "left-11"
        }`}
      >
        {canPickModel && (
          <button
            type="button"
            onClick={() => setShowSelector(!showSelector)}
            title={modelName || t("chat_window.select_model")}
            aria-label={modelName || t("chat_window.select_model")}
            className={`group border-none cursor-pointer flex items-center rounded-full transition-all px-2.5 py-1 ${
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
            onClick={() => setChatMode("compose")}
            className="border-none cursor-pointer px-2.5 py-1 flex items-center gap-1 rounded-full text-xs text-zinc-500 light:text-slate-500 hover:bg-zinc-700 light:hover:bg-slate-200 hover:text-white light:hover:text-slate-800 transition-all"
            title="缩小到侧栏"
            aria-label="缩小到侧栏"
          >
            <ArrowsInSimple size={14} weight="bold" />
            缩小
          </button>
        )}

        {showSelector && canPickModel && (
          <div className="absolute left-0 top-full mt-1 bg-zinc-800 light:bg-white border border-zinc-700 light:border-slate-300 rounded-xl shadow-lg overflow-hidden w-[620px]">
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
