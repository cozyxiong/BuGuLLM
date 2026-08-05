import React from "react";

/**
 * 系统设置右侧内容：标题 + 说明。外壳（侧栏）由 SettingsLayout 提供。
 */
export default function SettingsPage({
  title,
  description,
  children,
  wide = false,
  classic = false,
  headerRight = null,
}) {
  return (
    <>
      <div className="relative flex-1 min-h-0 h-full overflow-y-auto settings-page-body">
        <div
          className={
            classic
              ? "flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16"
              : `w-full ${wide ? "" : "max-w-[720px]"} px-6 sm:px-10 pt-8 sm:pt-10 pb-16`
          }
        >
          <SettingsPageHeader
            title={title}
            description={description}
            headerRight={headerRight}
            classic={classic}
          />
          {children}
        </div>
      </div>
      <style>{SETTINGS_FIELD_CSS}</style>
    </>
  );
}

const SETTINGS_FIELD_CSS = `
.settings-page-body .input-label,
.settings-page-body label.input-label {
  color: var(--theme-text-primary);
  font-weight: 600;
  font-size: 0.8125rem;
}
.settings-page-body input[type="text"],
.settings-page-body input[type="password"],
.settings-page-body input[type="number"],
.settings-page-body textarea {
  border-radius: 10px !important;
  border: 1px solid var(--theme-modal-border) !important;
  background: var(--theme-settings-input-bg) !important;
  color: var(--theme-text-primary) !important;
  outline: none !important;
}
.settings-page-body input:focus,
.settings-page-body textarea:focus {
  border-color: color-mix(in srgb, var(--theme-button-primary) 50%, transparent) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-button-primary) 14%, transparent) !important;
}
`;

export function SettingsPageHeader({
  title,
  description,
  headerRight = null,
  classic = false,
  className = "",
}) {
  if (!title && !description && !headerRight) return null;
  if (classic) {
    return (
      <header
        className={`w-full flex items-end justify-between gap-4 pb-6 border-white/10 border-b-2 ${className}`}
      >
        <div className="min-w-0 flex flex-col gap-y-1">
          {title && (
            <p className="text-lg leading-6 font-bold text-theme-text-primary">
              {title}
            </p>
          )}
          {description && (
            <p className="text-xs leading-[18px] font-base text-theme-text-secondary mt-2">
              {description}
            </p>
          )}
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </header>
    );
  }
  return (
    <header
      className={`mb-8 pb-6 border-white light:border-theme-sidebar-border border-b-2 border-opacity-10 ${className}`}
    >
      <div className="flex items-start justify-between gap-6 max-w-5xl">
        <div className="min-w-0">
          {title && (
            <h1 className="text-[22px] sm:text-[26px] font-semibold text-theme-text-primary tracking-[-0.03em] leading-[1.2]">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-[13.5px] text-theme-text-secondary mt-2 leading-[1.6] max-w-[36rem]">
              {description}
            </p>
          )}
        </div>
        {headerRight ? (
          <div className="shrink-0 pt-1">{headerRight}</div>
        ) : null}
      </div>
    </header>
  );
}

export function SettingsSaveBtn({
  children,
  onClick,
  disabled = false,
  type = "button",
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="h-7 px-2.5 rounded-md text-[12px] font-semibold border-none transition-all duration-150 whitespace-nowrap bg-white text-zinc-900 light:bg-theme-text-primary light:text-white hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
    >
      {children}
    </button>
  );
}

export function SettingsContent({ children }) {
  return (
    <div className="relative flex-1 min-w-0 h-full overflow-y-auto bg-theme-bg-secondary pt-12 md:pt-0">
      <div className="w-full max-w-[720px] px-6 sm:px-10 pt-8 sm:pt-10 pb-16">
        {children}
      </div>
    </div>
  );
}

export function SettingsRow({ title, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-theme-text-primary tracking-tight">
          {title}
        </p>
        {description ? (
          <p className="text-[12.5px] text-theme-text-secondary mt-1 leading-[1.55]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-[14px] border border-theme-modal-border bg-theme-bg-primary px-5 divide-y divide-theme-modal-border/90 ${className}`}
    >
      {children}
    </div>
  );
}
