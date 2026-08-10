import React, { useState } from "react";
import { useParams } from "react-router-dom";
import Video from "@/models/video";
import showToast from "@/utils/toast";
import { Play } from "@phosphor-icons/react";

export default function VideoOptions({ onImport }) {
  const { slug } = useParams();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const videoUrl = url.trim();

    if (!videoUrl) { showToast("请输入视频链接", "error"); return; }

    setLoading(true);
    showToast("正在提取视频字幕...", "info", { clear: true, autoClose: false });

    const result = await Video.extract(slug, videoUrl);

    if (result.error) {
      showToast(result.error, "error", { clear: true });
    } else {
      showToast(result.message || "字幕已导出", "success", { clear: true });
      onImport?.();
      setUrl("");
    }
    setLoading(false);
  };

  return (
    <div className="flex w-full">
      <div className="flex flex-col w-full px-1 md:pb-6 pb-16 gap-8">
        <p className="text-xs text-theme-text-secondary leading-relaxed">
          支持 Bilibili、YouTube 视频链接。自动识别平台，字幕写入知识库对应目录（BiliBili/ 或 YouTube/）。
          B 站首次会弹出浏览器登录，之后自动复用；本地 Cookie 过期或服务端登录失效时会自动再弹窗登录。
        </p>

        <form className="w-full" onSubmit={handleSubmit}>
          <div className="w-full flex flex-col py-2">
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">视频链接</label>
                  <p className="text-xs font-normal text-theme-text-secondary">
                    粘贴链接后自动识别站点，导出 Markdown 到 BiliBili/ 或 YouTube/
                  </p>
                </div>
                <input
                  type="url" name="url"
                  className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="https://www.bilibili.com/video/BV1xx411c7mD 或 https://www.youtube.com/watch?v=xxx"
                  required={true} autoComplete="off"
                  value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false}
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-2 w-full pr-10 mt-4">
              <button
                type="submit" disabled={loading || !url.trim()}
                className="w-full justify-center border-none px-4 py-2 rounded-lg text-dark-text light:text-white text-sm font-bold items-center flex gap-x-2 bg-theme-home-button-primary hover:bg-theme-home-button-primary-hover disabled:bg-theme-home-button-primary-hover disabled:cursor-not-allowed"
              >
                {loading ? "提取中..." : "提取字幕并导入"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
