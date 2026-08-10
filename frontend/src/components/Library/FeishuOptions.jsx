import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Feishu from "@/models/feishu";
import showToast from "@/utils/toast";
import { Books, CheckCircle } from "@phosphor-icons/react";

export default function FeishuOptions({ onImport }) {
  const { slug } = useParams();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  const [kbUrl, setKbUrl] = useState("");
  const [kbLoading, setKbLoading] = useState(false);

  const [authStatus, setAuthStatus] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    const result = await Feishu.getAuthStatus(slug);
    if (!result.error) setAuthStatus(result);
  }, [slug]);

  useEffect(() => { checkAuthStatus(); }, [checkAuthStatus]);

  const handleAuthorize = async () => {
    setAuthLoading(true);
    try {
      const result = await Feishu.getAuthUrl(slug);
      if (result.error) {
        showToast(result.error, "error");
        setAuthLoading(false);
        return;
      }

      const authWindow = window.open(result.url, "feishu-auth", "width=600,height=700");
      if (!authWindow) {
        showToast("请允许弹窗以完成飞书授权", "error");
        setAuthLoading(false);
        return;
      }

      showToast("请在打开的窗口中完成飞书授权", "info", { clear: true });

      const pollInterval = setInterval(async () => {
        if (authWindow.closed) {
          clearInterval(pollInterval);
          await checkAuthStatus();
          setAuthLoading(false);
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (!authWindow.closed) {
          setAuthLoading(false);
          showToast("授权超时，请重试", "warning", { clear: true });
        }
      }, 120000);
    } catch (e) {
      showToast(e.message, "error");
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const docUrl = form.get("url")?.trim();

    if (!docUrl) { showToast("请输入飞书文档链接", "error"); return; }

    setLoading(true);
    showToast("正在获取飞书文档内容...", "info", { clear: true, autoClose: false });

    const result = await Feishu.create(slug, { url: docUrl, title: "" });

    if (result.error) {
      showToast(result.error, "error", { clear: true });
    } else {
      showToast(result.message || "文档已导入", "success", { clear: true });
      onImport?.();
      setUrl(""); e.target.reset();
    }
    setLoading(false);
  };

  const handleKBImport = async (e) => {
    e.preventDefault();
    const kbUrlTrimmed = kbUrl.trim();
    if (!kbUrlTrimmed) { showToast("请输入飞书知识库链接", "error"); return; }

    setKbLoading(true);
    showToast("正在导入飞书知识库文档，这可能需要一些时间...", "info", { clear: true, autoClose: false });

    const result = await Feishu.importKB(slug, kbUrlTrimmed);

    if (result.error) {
      showToast(result.error, "error", { clear: true });
    } else {
      showToast(result.message || `成功导入 ${result.count} 篇文档`, "success", { clear: true });
      onImport?.();
      setKbUrl("");
    }
    setKbLoading(false);
  };

  return (
    <div className="flex w-full">
      <div className="flex flex-col w-full px-1 md:pb-6 pb-16 gap-8">
        {/* 账号授权 */}
        <div className="w-full py-2">
          <h3 className="text-white text-base font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
            账号授权
          </h3>

          <div className="pr-10">
            {authStatus?.authorized ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-400" weight="fill" />
                <div className="text-xs">
                  <p className="text-green-300 font-medium">飞书账号已授权</p>
                  <p className="text-green-400/60 mt-0.5">
                    {authStatus.hasRefreshToken ? "Token 过期后自动刷新" : "Token 过期后需重新授权"}
                  </p>
                </div>
                <button
                  onClick={handleAuthorize}
                  disabled={authLoading}
                  className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-theme-settings-input-bg text-theme-text-secondary hover:bg-theme-file-picker-hover transition-colors"
                >
                  重新授权
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 font-bold text-xs mt-0.5 shrink-0">!</span>
                  <div className="text-xs text-amber-300">
                    <p className="font-medium">需要飞书账号授权</p>
                  </div>
                </div>
                <button
                  onClick={handleAuthorize}
                  disabled={authLoading}
                  className="w-full justify-center border-none px-4 py-2 rounded-lg text-white text-sm font-bold items-center flex gap-x-2 bg-[#3370FF] hover:bg-[#2860E0] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authLoading ? "等待授权..." : "授权飞书账号"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 分隔线 */}
        <div className="pr-10"><div className="border-t border-theme-modal-border" /></div>

        {/* 单个文档添加 */}
        <form className="w-full" onSubmit={handleSubmit}>
          <div className="w-full flex flex-col py-2">
            <h3 className="text-white text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
              添加单个文档
            </h3>
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">飞书文档链接</label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    粘贴飞书文档的分享链接，自动获取文档内容并以 Markdown 保存到知识库
                  </p>
                </div>
                <input
                  type="url" name="url"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="https://xxx.feishu.cn/docx/..."
                  required={true} autoComplete="off"
                  value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false}
                />
              </div>
              {!authStatus?.authorized && (
                <div className="flex flex-col pr-10">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-amber-400 font-bold text-xs mt-0.5 shrink-0">!</span>
                    <div className="text-xs text-amber-300">
                      <p>请先在顶部完成「授权飞书账号」，才能获取文档内容。</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-y-2 w-full pr-10 mt-4">
              <button
                type="submit" disabled={loading || !url.trim() || !authStatus?.authorized}
                className="w-full justify-center border-none px-4 py-2 rounded-lg text-dark-text light:text-white text-sm font-bold items-center flex gap-x-2 bg-theme-home-button-primary hover:bg-theme-home-button-primary-hover disabled:bg-theme-home-button-primary-hover disabled:cursor-not-allowed"
              >
                {!authStatus?.authorized ? "请先授权飞书账号" : loading ? "获取中..." : "添加飞书文档"}
              </button>
            </div>
          </div>
        </form>

        {/* 分隔线 */}
        <div className="pr-10"><div className="border-t border-theme-modal-border" /></div>

        {/* 知识库批量导入 */}
        <form className="w-full" onSubmit={handleKBImport}>
          <div className="w-full flex flex-col py-2">
            <h3 className="text-white text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-green-500 inline-block" />
              知识库批量导入
            </h3>
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">飞书知识库链接</label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    粘贴飞书知识库 URL，自动拉取所有文档并以 Markdown 格式保存到知识库
                  </p>
                </div>
                <input
                  type="url" name="kbUrl"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="https://xxx.feishu.cn/wiki/space/..."
                  required={true} autoComplete="off"
                  value={kbUrl} onChange={(e) => setKbUrl(e.target.value)} spellCheck={false}
                />
              </div>
              {!authStatus?.authorized && (
                <div className="flex flex-col pr-10">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Books className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" weight="fill" />
                    <div className="text-xs text-amber-300">
                      <p>请先在顶部完成「授权飞书账号」，才能使用知识库批量导入。</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-y-2 w-full pr-10 mt-4">
              <button
                type="submit"
                disabled={kbLoading || !kbUrl.trim() || !authStatus?.authorized}
                className="w-full justify-center border-none px-4 py-2 rounded-lg text-dark-text light:text-white text-sm font-bold items-center flex gap-x-2 bg-green-600 hover:bg-green-700 disabled:bg-theme-home-button-primary-hover disabled:cursor-not-allowed"
              >
                {!authStatus?.authorized ? "请先授权飞书账号" : kbLoading ? "导入中..." : "导入知识库全部文档"}
              </button>
              {kbLoading && <p className="text-xs text-white/50">正在从飞书知识库拉取文档，可能需要几分钟...</p>}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
