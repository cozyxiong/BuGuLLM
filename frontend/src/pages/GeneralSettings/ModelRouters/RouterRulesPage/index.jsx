import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isMobile } from "react-device-detect";
import { ArrowLeft, CircleNotch } from "@phosphor-icons/react";
import ModelRouter from "@/models/modelRouter";
import showToast from "@/utils/toast";
import paths from "@/utils/paths";
import RuleBuilder from "../RuleBuilder";
import RouterWorkspaces from "../RouterWorkspaces";
import SettingsPage from "@/components/SettingsSidebar/SettingsPage";

export default function RouterRulesPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [router, setRouter] = useState(null);

  const fetchRouter = async () => {
    const { router: found, error } = await ModelRouter.get(id);
    if (!found) {
      showToast(error || "Router not found", "error");
      navigate(paths.settings.modelRouters());
      return;
    }
    setRouter(found);
    setLoading(false);
  };

  useEffect(() => {
    fetchRouter();
  }, [id]);

  if (loading)
    return (
      <Layout t={t}>
        <div className="flex items-center justify-center py-20">
          <CircleNotch className="h-8 w-8 text-zinc-400 light:text-slate-400 animate-spin" />
        </div>
      </Layout>
    );

  return (
    <Layout t={t}>
      <RouterWorkspaces routerId={router.id} />
      <RuleBuilder
        routerId={router.id}
        routerName={router.name}
        rules={router.rules || []}
        onRulesChanged={fetchRouter}
      />
    </Layout>
  );
}

function Layout({ t, children }) {
  const navigate = useNavigate();

  return (
    <SettingsPage wide>
      <button
        onClick={() => navigate(paths.settings.modelRouters())}
        className="border-none flex items-center gap-x-2 text-theme-text-secondary hover:text-theme-text-primary text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("model-router.edit-router.back-to-routers")}
      </button>
      {children}
    </SettingsPage>
  );
}
