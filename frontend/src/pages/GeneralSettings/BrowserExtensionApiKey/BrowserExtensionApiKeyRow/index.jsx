import { useRef, useState } from "react";
import BrowserExtensionApiKey from "@/models/browserExtensionApiKey";
import showToast from "@/utils/toast";
import { Trash, Copy, Check, Plug } from "@phosphor-icons/react";
import { POPUP_BROWSER_EXTENSION_EVENT } from "@/utils/constants";

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function BrowserExtensionApiKeyRow({
  apiKey,
  removeApiKey,
  connectionString,
  isMultiUser,
}) {
  const rowRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleRevoke = async () => {
    if (
      !window.confirm(
        "确定作废这把扩展密钥吗？\n作废后将无法再用来连接。\n\n此操作不可恢复。"
      )
    )
      return false;

    const result = await BrowserExtensionApiKey.revoke(apiKey.id);
    if (result.success) {
      removeApiKey(apiKey.id);
      showToast("密钥已作废", "info", {
        clear: true,
      });
    } else {
      showToast("作废失败", "error", {
        clear: true,
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(connectionString);
    showToast("已复制 API Key", "success", {
      clear: true,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    // Sending a message to Chrome extension to pop up the extension window
    // This will open the extension window and attempt to connect with the API key
    window.postMessage(
      { type: POPUP_BROWSER_EXTENSION_EVENT, apiKey: connectionString },
      "*"
    );
    showToast("正在尝试连接浏览器扩展…", "info", {
      clear: true,
    });
  };

  return (
    <tr
      ref={rowRef}
      className="bg-transparent text-white text-opacity-80 text-xs font-medium border-b border-white/10 h-10"
    >
      <td scope="row" className="px-6 py-2 whitespace-nowrap">
        <div className="flex items-center">
          <span className="mr-2 font-mono">{connectionString}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              data-tooltip-id="copy-connection-text"
              data-tooltip-content="复制 API Key"
              className="border-none text-theme-text-primary hover:text-theme-text-secondary transition-colors duration-200 p-1 rounded"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleConnect}
              data-tooltip-id="auto-connection"
              data-tooltip-content="自动连接扩展"
              className="border-none text-theme-text-primary hover:text-theme-text-secondary transition-colors duration-200 p-1 rounded"
            >
              <Plug className="h-4 w-4" />
            </button>
          </div>
        </div>
      </td>
      {isMultiUser && (
        <td className="px-6 py-2">
          {apiKey.user ? apiKey.user.username : "N/A"}
        </td>
      )}
      <td className="px-6 py-2">
        {formatCreatedAt(apiKey.createdAt)}
      </td>
      <td className="px-6 py-2">
        <button
          onClick={handleRevoke}
          className="text-xs font-medium text-white/80 light:text-black/80 hover:light:text-red-500 hover:text-red-300 rounded-lg px-2 py-1 hover:bg-white hover:light:bg-red-50 hover:bg-opacity-10"
        >
          <Trash className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
