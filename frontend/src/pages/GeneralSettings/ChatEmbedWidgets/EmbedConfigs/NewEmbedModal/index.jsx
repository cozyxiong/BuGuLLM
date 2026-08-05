import React, { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import Workspace from "@/models/workspace";
import { TagsInput } from "react-tag-input-component";
import Embed from "@/models/embed";
import Toggle from "@/components/lib/Toggle";

export function enforceSubmissionSchema(form) {
  const data = {};
  for (var [key, value] of form.entries()) {
    if (!value || value === null) continue;
    data[key] = value;
    if (value === "on") data[key] = true;
  }

  // Always set value on nullable keys since empty or off will not send anything from form element.
  if (!data.hasOwnProperty("allowlist_domains")) data.allowlist_domains = null;
  if (!data.hasOwnProperty("allow_model_override"))
    data.allow_model_override = false;
  if (!data.hasOwnProperty("allow_temperature_override"))
    data.allow_temperature_override = false;
  if (!data.hasOwnProperty("allow_prompt_override"))
    data.allow_prompt_override = false;
  if (!data.hasOwnProperty("message_limit")) data.message_limit = 20;
  return data;
}

export default function NewEmbedModal({ closeModal }) {
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    setError(null);
    e.preventDefault();
    const form = new FormData(e.target);
    const data = enforceSubmissionSchema(form);
    const { embed, error } = await Embed.newEmbed(data);
    if (!!embed) window.location.reload();
    setError(error);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="relative w-full max-w-2xl bg-theme-bg-secondary rounded-lg shadow border-2 border-theme-modal-border">
        <div className="relative p-6 border-b rounded-t border-theme-modal-border">
          <div className="w-full flex gap-x-2 items-center">
            <h3 className="text-xl font-semibold text-white overflow-hidden overflow-ellipsis whitespace-nowrap">
              为工作区新建嵌入窗口
            </h3>
          </div>
          <button
            onClick={closeModal}
            type="button"
            className="absolute top-4 right-4 transition-all duration-300 bg-transparent rounded-lg text-sm p-1 inline-flex items-center hover:bg-theme-modal-border hover:border-theme-modal-border hover:border-opacity-50 border-transparent border"
          >
            <X size={24} weight="bold" className="text-white" />
          </button>
        </div>
        <div className="px-7 py-6">
          <form onSubmit={handleCreate}>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              <WorkspaceSelection />
              <ChatModeSelection />
              <PermittedDomains />
              <NumberInput
                name="max_chats_per_day"
                title="每天最多对话次数"
                hint="这个嵌入窗口 24 小时内最多处理多少次对话。填 0 表示不限制。"
              />
              <NumberInput
                name="max_chats_per_session"
                title="每个会话最多对话次数"
                hint="同一访客 24 小时内最多发多少条。填 0 表示不限制。"
              />
              <NumberInput
                name="message_limit"
                title="带入上下文的历史条数"
                hint="回复时带上最近多少条消息。默认 20。"
                defaultValue={20}
              />
              <BooleanInput
                name="allow_model_override"
                title="允许改模型"
                hint="允许覆盖工作区默认的语言模型。"
              />
              <BooleanInput
                name="allow_temperature_override"
                title="允许改温度"
                hint="允许覆盖工作区默认的模型温度。"
              />
              <BooleanInput
                name="allow_prompt_override"
                title="允许改系统提示"
                hint="允许覆盖工作区默认的系统提示词。"
              />

              {error && <p className="text-red-400 text-sm">{error}</p>}
              <p className="text-white text-opacity-60 text-xs md:text-sm">
                创建后会得到一段代码，把
                <code className="light:bg-stone-300 bg-stone-900 text-white mx-1 px-1 rounded-sm">
                  &lt;script&gt;
                </code>
                贴到网页里就能用。
              </p>
            </div>
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-theme-modal-border">
              <button
                onClick={closeModal}
                type="button"
                className="transition-all duration-300 text-white hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                className="transition-all duration-300 bg-white text-black hover:opacity-60 px-4 py-2 rounded-lg text-sm"
              >
                创建
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export const WorkspaceSelection = ({ defaultValue = null }) => {
  const [workspaces, setWorkspaces] = useState([]);
  useEffect(() => {
    async function fetchWorkspaces() {
      const _workspaces = await Workspace.all();
      setWorkspaces(_workspaces);
    }
    fetchWorkspaces();
  }, []);

  return (
    <div>
      <div className="flex flex-col mb-2">
        <label
          htmlFor="workspace_id"
          className="block  text-sm font-medium text-white"
        >
          工作区
        </label>
        <p className="text-theme-text-secondary text-xs">
          嵌入窗口会用这个工作区的资料和默认设置，除非你在下面单独改。
        </p>
      </div>
      <select
        name="workspace_id"
        required={true}
        defaultValue={defaultValue}
        className="min-w-[15rem] rounded-lg bg-theme-settings-input-bg px-4 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
      >
        {workspaces.map((workspace) => {
          return (
            <option
              key={workspace.id}
              selected={defaultValue === workspace.id}
              value={workspace.id}
            >
              {workspace.name}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export const ChatModeSelection = ({ defaultValue = null }) => {
  const [chatMode, setChatMode] = useState(defaultValue ?? "query");

  return (
    <div>
      <div className="flex flex-col mb-2">
        <label
          className="block text-sm font-medium text-white"
          htmlFor="chat_mode"
        >
          对话方式
        </label>
        <p className="text-theme-text-secondary text-xs">
          查询：只根据工作区文档作答。
          <br />
          助手：也可以聊和工作区无关的问题。
        </p>
      </div>
      <div className="mt-2 gap-y-3 flex flex-col">
        <label
          className={`transition-all duration-300 w-full h-11 p-2.5 rounded-lg flex justify-start items-center gap-2.5 cursor-pointer border ${
            chatMode === "chat"
              ? "border-theme-sidebar-item-workspace-active bg-theme-bg-secondary"
              : "border-theme-sidebar-border hover:border-theme-sidebar-border hover:bg-theme-bg-secondary"
          } `}
        >
          <input
            type="radio"
            name="chat_mode"
            value={"chat"}
            checked={chatMode === "chat"}
            onChange={(e) => setChatMode(e.target.value)}
            className="hidden"
          />
          <div
            className={`w-4 h-4 rounded-full border-2 border-theme-sidebar-border mr-2 ${
              chatMode === "chat"
                ? "bg-[var(--theme-sidebar-item-workspace-active)]"
                : ""
            }`}
          ></div>
          <div className="text-theme-text-primary text-sm font-medium font-['Plus Jakarta Sans'] leading-tight">
            助手：不限问题，都可以答
          </div>
        </label>
        <label
          className={`transition-all duration-300 w-full h-11 p-2.5 rounded-lg flex justify-start items-center gap-2.5 cursor-pointer border ${
            chatMode === "query"
              ? "border-theme-sidebar-item-workspace-active bg-theme-bg-secondary"
              : "border-theme-sidebar-border hover:border-theme-sidebar-border hover:bg-theme-bg-secondary"
          } `}
        >
          <input
            type="radio"
            name="chat_mode"
            value={"query"}
            checked={chatMode === "query"}
            onChange={(e) => setChatMode(e.target.value)}
            className="hidden"
          />
          <div
            className={`w-4 h-4 rounded-full border-2 border-theme-sidebar-border mr-2 ${
              chatMode === "query"
                ? "bg-[var(--theme-sidebar-item-workspace-active)]"
                : ""
            }`}
          ></div>
          <div className="text-theme-text-primary text-sm font-medium font-['Plus Jakarta Sans'] leading-tight">
            查询：只回答和工作区文档相关的问题
          </div>
        </label>
      </div>
    </div>
  );
};

export const PermittedDomains = ({ defaultValue = [] }) => {
  const [domains, setDomains] = useState(defaultValue);
  const handleChange = (data) => {
    const validDomains = data
      .map((input) => {
        let url = input;
        if (!url.includes("http://") && !url.includes("https://"))
          url = `https://${url}`;
        try {
          new URL(url);
          return url;
        } catch {
          return null;
        }
      })
      .filter((u) => !!u);
    setDomains(validDomains);
  };

  const handleBlur = (event) => {
    const currentInput = event.target.value;
    if (!currentInput) return;

    const validDomains = [...domains, currentInput].map((input) => {
      let url = input;
      if (!url.includes("http://") && !url.includes("https://"))
        url = `https://${url}`;
      try {
        new URL(url);
        return url;
      } catch {
        return null;
      }
    });
    event.target.value = "";
    setDomains(validDomains);
  };

  return (
    <div>
      <div className="flex flex-col mb-2">
        <label
          htmlFor="allowlist_domains"
          className="block text-sm font-medium text-white"
        >
          限制来源域名
        </label>
        <p className="text-theme-text-secondary text-xs">
          只允许下面这些域名嵌入。留空则任何网站都能用。
        </p>
      </div>
      <input type="hidden" name="allowlist_domains" value={domains.join(",")} />
      <TagsInput
        value={domains}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="https://mysite.com, https://anythingllm.com"
        classNames={{
          tag: "bg-theme-settings-input-bg light:bg-black/10 bg-blue-300/10 text-zinc-800",
          input:
            "flex p-1 !bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none",
        }}
      />
    </div>
  );
};

export const NumberInput = ({ name, title, hint, defaultValue = 0 }) => {
  return (
    <div>
      <div className="flex flex-col mb-2">
        <label htmlFor={name} className="block text-sm font-medium text-white">
          {title}
        </label>
        <p className="text-theme-text-secondary text-xs">{hint}</p>
      </div>
      <input
        type="number"
        name={name}
        className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-[15rem] p-2.5"
        min={0}
        defaultValue={defaultValue}
        onScroll={(e) => e.target.blur()}
      />
    </div>
  );
};

export const BooleanInput = ({ name, title, hint, defaultValue = null }) => {
  const [status, setStatus] = useState(defaultValue ?? false);

  return (
    <Toggle
      name={name}
      size="md"
      variant="horizontal"
      label={title}
      description={hint}
      enabled={status}
      onChange={(checked) => setStatus(checked)}
    />
  );
};
