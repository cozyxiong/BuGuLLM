import { useState } from "react";
import { useTranslation } from "react-i18next";

/** 显示名称字数上限 */
export const WORKSPACE_NAME_MAX_LENGTH = 20;

export default function WorkspaceName({ workspace, setHasChanges }) {
  const { t } = useTranslation();
  const initial = String(workspace?.name || "").slice(
    0,
    WORKSPACE_NAME_MAX_LENGTH
  );
  const [name, setName] = useState(initial);

  return (
    <div className="flex flex-col gap-y-[8px]">
      <div className="flex flex-col gap-y-[8px]">
        <label htmlFor="workspace-name" className="block input-label">
          {t("common.workspaces-name")}
        </label>
        <p className="text-white text-opacity-60 text-xs font-medium">
          {t("general.names.description")}
        </p>
      </div>
      <div className="relative w-full max-w-[320px]">
        <input
          id="workspace-name"
          name="name"
          type="text"
          minLength={2}
          maxLength={WORKSPACE_NAME_MAX_LENGTH}
          value={name}
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-none active:outline-none outline-none block w-full py-2.5 pl-2.5 pr-11"
          placeholder="My Workspace"
          required={true}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value.slice(0, WORKSPACE_NAME_MAX_LENGTH);
            setName(next);
            setHasChanges(true);
          }}
        />
        <span
          className="pointer-events-none absolute right-2.5 bottom-2 text-[11px] leading-none tabular-nums text-white/35 light:text-theme-text-secondary"
          aria-hidden
        >
          {name.length}/{WORKSPACE_NAME_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
