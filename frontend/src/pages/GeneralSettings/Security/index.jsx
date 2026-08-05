import { useEffect, useState } from "react";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";
import showToast from "@/utils/toast";
import System from "@/models/system";
import { AUTH_TIMESTAMP, AUTH_TOKEN, AUTH_USER } from "@/utils/constants";
import PreLoader from "@/components/Preloader";
import { useTranslation } from "react-i18next";
import Toggle from "@/components/lib/Toggle";

export const PW_REGEX = new RegExp(/^[a-zA-Z0-9_\-!@$%^&*();]+$/);

export default function GeneralSecurity() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <SettingsPage
      title={t("security.title")}
      description={t("security.password.description")}
      headerRight={
        hasChanges && !loading ? (
          <SettingsSaveBtn
            onClick={() =>
              document.getElementById("security-password-form")?.requestSubmit()
            }
            disabled={saving}
          >
            {saving ? "保存中…" : "保存更改"}
          </SettingsSaveBtn>
        ) : null
      }
    >
      <PasswordProtection
        saving={saving}
        setSaving={setSaving}
        setHasChanges={setHasChanges}
        loading={loading}
        setLoading={setLoading}
      />
    </SettingsPage>
  );
}

function PasswordProtection({
  saving,
  setSaving,
  setHasChanges,
  loading,
  setLoading,
}) {
  const [usePassword, setUsePassword] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const password = String(new FormData(e.target).get("password") || "").trim();

    if (usePassword) {
      if (!password) {
        showToast("请输入系统密码。", "error");
        return;
      }
      if (!PW_REGEX.test(password)) {
        showToast(
          "密码含有不允许的字符。可用：字母、数字，以及 _ - ! @ $ % ^ & * ( ) ;",
          "error"
        );
        return;
      }
    }

    setSaving(true);
    const { success, error } = await System.updateSystemPassword({
      usePassword,
      newPassword: password,
    });
    if (success) {
      showToast("已保存，页面即将刷新。", "success");
      setHasChanges(false);
      setTimeout(() => {
        window.localStorage.removeItem(AUTH_USER);
        window.localStorage.removeItem(AUTH_TOKEN);
        window.localStorage.removeItem(AUTH_TIMESTAMP);
        window.location.reload();
      }, 3_000);
      return;
    }
    showToast(error || "保存失败", "error");
    setSaving(false);
  };

  useEffect(() => {
    async function fetchAuthSetting() {
      setLoading(true);
      const settings = await System.keys();
      setUsePassword(!!settings?.RequiresAuth);
      setLoading(false);
    }
    fetchAuthSetting();
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex justify-center items-center">
        <PreLoader />
      </div>
    );
  }

  return (
    <form
      id="security-password-form"
      onSubmit={handleSubmit}
      onChange={() => setHasChanges(true)}
      className="flex flex-col w-full rounded-xl border border-theme-modal-border bg-theme-bg-primary p-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-theme-text-primary">
          {t("security.password.title")}
        </p>
        <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed">
          {t("security.password.description")}
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-y-4">
        <Toggle
          size="lg"
          className="mb-1"
          label={t("security.password.title")}
          enabled={usePassword}
          onChange={(checked) => {
            setUsePassword(checked);
            setHasChanges(true);
          }}
        />
        {usePassword && (
          <div className="max-w-sm">
            <label
              htmlFor="password"
              className="text-theme-text-primary text-sm font-medium block mb-1.5"
            >
              {t("security.password.password-label")}
            </label>
            <input
              name="password"
              type="password"
              className="bg-theme-settings-input-bg border border-theme-modal-border text-theme-text-primary text-sm rounded-xl outline-none block w-full p-2.5 placeholder:text-theme-settings-input-placeholder"
              placeholder="请输入密码"
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        )}
      </div>
    </form>
  );
}
