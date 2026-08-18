/** 学习模块内部卡片 / 输入框统一圆角 */

export const fieldLabel =
  "block text-xs font-medium text-theme-text-secondary mb-1.5";

export const fieldControl =
  "w-full px-3 py-2.5 rounded-xl bg-theme-settings-input-bg border border-theme-modal-border text-theme-text-primary text-sm placeholder:text-theme-settings-input-placeholder focus:outline-none focus:ring-1 focus:ring-theme-button-primary/50 focus:border-theme-button-primary/40 transition-colors";

export const fieldArea = `${fieldControl} resize-none`;

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-theme-button-primary hover:opacity-90 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-opacity";

export const panelCard =
  "rounded-xl border border-theme-modal-border bg-theme-bg-primary p-4 sm:p-5";

export const generateStage =
  "flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-6 py-10";

export const generatePanel = "w-full max-w-sm space-y-4";
