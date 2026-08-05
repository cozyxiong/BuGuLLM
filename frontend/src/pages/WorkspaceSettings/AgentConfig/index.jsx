import System from "@/models/system";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import { castToType } from "@/utils/types";
import { useEffect, useRef, useState } from "react";
import AgentLLMSelection from "./AgentLLMSelection";
import Admin from "@/models/admin";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import paths from "@/utils/paths";
import useUser from "@/hooks/useUser";
import SettingsSaveBar from "../SettingsSaveBar";
import { Link } from "react-router-dom";

export default function WorkspaceAgentConfiguration({ workspace }) {
  const { user } = useUser();
  const [settings, setSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const formEl = useRef(null);

  useEffect(() => {
    async function fetchSettings() {
      const _settings = await System.keys();
      setSettings(_settings ?? {});
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      workspace: {},
      system: {},
      env: {},
    };

    const form = new FormData(formEl.current);
    for (var [key, value] of form.entries()) {
      if (key.startsWith("system::")) {
        const [_, label] = key.split("system::");
        data.system[label] = String(value);
        continue;
      }

      if (key.startsWith("env::")) {
        const [_, label] = key.split("env::");
        data.env[label] = String(value);
        continue;
      }

      data.workspace[key] = castToType(key, value);
    }

    const { workspace: updatedWorkspace, message } = await Workspace.update(
      workspace.slug,
      data.workspace
    );
    await Admin.updateSystemPreferences(data.system);
    await System.updateSystem(data.env);

    if (!!updatedWorkspace) {
      showToast("修改成功", "success", { clear: true });
    } else {
      showToast(`Error: ${message}`, "error", { clear: true });
    }

    setSaving(false);
    setHasChanges(false);
  };

  if (!workspace || loading) return <LoadingSkeleton />;
  return (
    <div id="workspace-agent-settings-container">
      <form
        ref={formEl}
        onSubmit={handleUpdate}
        onChange={() => setHasChanges(true)}
        id="agent-settings-form"
        className="w-full flex flex-col gap-y-6"
      >
        <AgentLLMSelection
          settings={settings}
          workspace={workspace}
          setHasChanges={setHasChanges}
        />
        {(!user || user?.role === "admin") && (
          <div className="flex flex-col gap-y-2">
            <Link
              to={paths.settings.agentSkills()}
              className="inline-flex w-fit items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium no-underline transition-colors border border-white/15 bg-white/[0.06] text-white/90 hover:bg-white/[0.1] hover:text-white light:border-theme-modal-border light:bg-black/[0.04] light:text-theme-text-primary light:hover:bg-black/[0.07]"
            >
              {"\u914d\u7f6e\u4ee3\u7406\u6280\u80fd"}
            </Link>
            <p className="text-white text-opacity-60 text-xs font-medium m-0">
              {"\u6309\u9700\u5f00\u5173\u4ee3\u7406\u53ef\u7528\u7684\u6280\u80fd\uff08\u68c0\u7d22\u3001\u8bfb\u6587\u6863\u3001\u8054\u7f51\u7b49\uff09\u3002\u8fd9\u4e9b\u80fd\u529b\u5728\u672c\u673a\u5168\u5c40\u751f\u6548\u3002"}
            </p>
          </div>
        )}
      </form>
      <SettingsSaveBar
        visible={hasChanges}
        saving={saving}
        formId="agent-settings-form"
        label="保存更改"
        savingLabel="保存中…"
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div id="workspace-agent-settings-container">
      <div className="w-1/2 flex flex-col gap-y-6">
        <Skeleton.default
          height={100}
          width="100%"
          count={2}
          highlightColor="var(--theme-bg-primary)"
          baseColor="var(--theme-bg-secondary)"
          enableAnimation={true}
          containerClassName="flex flex-col gap-y-1"
        />
        <div className="bg-white/10 h-[1px] w-full" />
        <Skeleton.default
          height={100}
          width="100%"
          count={2}
          highlightColor="var(--theme-bg-primary)"
          baseColor="var(--theme-bg-secondary)"
          enableAnimation={true}
          containerClassName="flex flex-col gap-y-1 mt-4"
        />
      </div>
    </div>
  );
}
