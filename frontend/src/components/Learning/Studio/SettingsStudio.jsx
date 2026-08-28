import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import showToast from "@/utils/toast";
import StudioShell from "./StudioShell";
import { panelCard } from "./formStyles";

export default function SettingsStudio() {
  const { slug } = useParams();
  const [srEnabled, setSrEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await Learning.getSettings(slug);
      if (r.settings) setSrEnabled(!!r.settings.spacedRepetitionEnabled);
      setLoading(false);
    })();
  }, [slug]);

  const toggleSr = async (enabled) => {
    setSrEnabled(enabled);
    const result = await Learning.updateSettings(slug, {
      spacedRepetitionEnabled: enabled,
    });
    if (result.error) {
      showToast(result.error, "error");
      setSrEnabled(!enabled);
      return;
    }
    showToast(
      enabled
        ? "已开启间隔复习，将按垃圾桶里到期的题安排"
        : "已关闭间隔复习，按垃圾桶最近的题练习",
      "success"
    );
  };

  return (
    <StudioShell title="设置" description="学习偏好与复习策略">
      <div className="max-w-lg mx-auto space-y-3">
        {loading ? (
          <p className="text-sm text-theme-text-secondary px-1">加载中…</p>
        ) : (
          <div className={`${panelCard} flex items-start justify-between gap-4`}>
            <div className="min-w-0">
              <p className="text-sm text-theme-text-primary font-semibold">
                间隔复习（SM-2）
              </p>
              <p className="text-xs text-theme-text-secondary mt-1.5 leading-relaxed">
                默认关闭。关闭时按垃圾桶最近的卡片和测试练习；开启后只复习垃圾桶里已到期的题，并根据评分计算下次时间。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={srEnabled}
              onClick={() => toggleSr(!srEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                srEnabled
                  ? "bg-theme-button-primary"
                  : "bg-theme-settings-input-bg border border-theme-modal-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  srEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </StudioShell>
  );
}
