import { useEffect, useState, Fragment } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Highlighter from "react-highlight-words";
import SystemPromptVariable from "@/models/systemPromptVariable";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";

export default function DefaultSystemPrompt() {
  const [systemPromptForm, setSystemPromptForm] = useState({
    value: "",
    default: "",
    isDirty: false,
    isSubmitting: false,
    isLoading: true,
    isEditing: false,
  });
  const [saneDefaultSystemPrompt, setSaneDefaultSystemPrompt] = useState("");
  const [availableVariables, setAvailableVariables] = useState([]);

  useEffect(() => {
    async function setupVariableHighlighting() {
      const { variables } = await SystemPromptVariable.getAll();
      setAvailableVariables(variables);
    }
    setupVariableHighlighting();
  }, []);

  useEffect(() => {
    async function fetchDefaultSystemPrompt() {
      setSystemPromptForm((prev) => ({
        ...prev,
        isLoading: true,
      }));
      const { defaultSystemPrompt, saneDefaultSystemPrompt } =
        await System.fetchDefaultSystemPrompt();
      setSaneDefaultSystemPrompt(saneDefaultSystemPrompt);
      if (!defaultSystemPrompt)
        return setSystemPromptForm((prev) => ({
          ...prev,
          isLoading: false,
        }));

      setSystemPromptForm((prev) => ({
        ...prev,
        default: defaultSystemPrompt,
        value: defaultSystemPrompt,
        isLoading: false,
      }));
    }
    fetchDefaultSystemPrompt();
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    const isDirty = value !== systemPromptForm.default;

    setSystemPromptForm((prev) => ({
      ...prev,
      value,
      isDirty,
      isSubmitting: false,
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSystemPromptForm((prev) => ({
      ...prev,
      isSubmitting: true,
    }));
    const newSystemPrompt = systemPromptForm.value.trim();
    await System.updateDefaultSystemPrompt(newSystemPrompt)
      .then(({ success, message }) => {
        if (!success) throw new Error(message);

        if (
          !newSystemPrompt ||
          newSystemPrompt.trim() === saneDefaultSystemPrompt
        ) {
          return setSystemPromptForm((prev) => ({
            ...prev,
            value: saneDefaultSystemPrompt,
            default: saneDefaultSystemPrompt,
            isDirty: false,
            isSubmitting: false,
          }));
        }

        showToast("已保存", "success");
        setSystemPromptForm((prev) => ({
          ...prev,
          default: newSystemPrompt,
          isDirty: false,
          isSubmitting: false,
        }));
      })
      .catch((error) => {
        showToast(error.message || "保存失败", "error");
        setSystemPromptForm((prev) => ({
          ...prev,
          isSubmitting: false,
        }));
      });
  };

  return (
    <SettingsPage
      title="默认系统提示"
      description="新建工作区时会套用这段提示。要改某个工作区，请到该工作区设置里改。"
      headerRight={
        systemPromptForm.isDirty && !systemPromptForm.isLoading ? (
          <SettingsSaveBtn
            onClick={handleSubmit}
            disabled={systemPromptForm.isSubmitting}
          >
            {systemPromptForm.isSubmitting ? "保存中…" : "保存更改"}
          </SettingsSaveBtn>
        ) : null
      }
    >
      {systemPromptForm.isLoading ? (
        <div className="flex flex-col gap-y-4">
          <Skeleton.default
            height={20}
            width={160}
            highlightColor="var(--theme-bg-primary)"
            baseColor="var(--theme-bg-secondary)"
          />
          <Skeleton.default
            height={120}
            width="100%"
            highlightColor="var(--theme-bg-primary)"
            baseColor="var(--theme-bg-secondary)"
            className="rounded-lg"
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-2">
          <label
            htmlFor="default-system-prompt"
            className="block input-label"
          >
            系统提示词
          </label>
          <p className="text-white text-opacity-60 text-xs font-medium">
            约束新建工作区 AI 的角色、语气与回答方式。写清楚期望，回答会更贴合你的需求。留空并保存，即可恢复为系统内置默认。
          </p>
          <p className="text-white text-opacity-60 text-xs font-medium">
            可以插入{" "}
            <Link
              to={paths.settings.systemPromptVariables()}
              className="text-primary-button"
            >
              系统提示变量
            </Link>
            ，例如：{" "}
            {availableVariables.slice(0, 3).map((v, i) => (
              <Fragment key={v.key}>
                <span className="bg-theme-settings-input-bg px-1 py-0.5 rounded">
                  {`{${v.key}}`}
                </span>
                {i < availableVariables.length - 1 && i < 2 && "、"}
              </Fragment>
            ))}
            {availableVariables.length > 3 && (
              <Link
                to={paths.settings.systemPromptVariables()}
                className="text-primary-button"
              >
                还有 {availableVariables.length - 3} 个…
              </Link>
            )}
          </p>

          {systemPromptForm.isEditing ? (
            <textarea
              id="default-system-prompt"
              autoFocus={true}
              value={systemPromptForm.value}
              onChange={handleChange}
              onBlur={() =>
                setSystemPromptForm((prev) => ({
                  ...prev,
                  isEditing: false,
                }))
              }
              placeholder="你是一个能回答问题、协助完成任务的 AI 助手。"
              rows={5}
              style={{
                resize: "vertical",
                overflowY: "scroll",
                minHeight: "150px",
              }}
              className="w-full border-none bg-theme-settings-input-bg placeholder:text-theme-settings-input-placeholder text-white text-sm rounded-lg focus:outline-none active:outline-none outline-none block p-2.5"
            />
          ) : (
            <div
              onClick={() =>
                setSystemPromptForm((prev) => ({
                  ...prev,
                  isEditing: true,
                }))
              }
              style={{
                resize: "vertical",
                overflowY: "scroll",
                minHeight: "150px",
              }}
              className="w-full border-none bg-theme-settings-input-bg text-white text-sm rounded-lg focus:outline-none active:outline-none outline-none block p-2.5 cursor-text"
            >
              <Highlighter
                className="whitespace-pre-wrap"
                highlightClassName="bg-cta-button p-0.5 rounded-md"
                searchWords={availableVariables.map((v) => `{${v.key}}`)}
                autoEscape={true}
                caseSensitive={true}
                textToHighlight={systemPromptForm.value || ""}
              />
            </div>
          )}
        </form>
      )}
    </SettingsPage>
  );
}
