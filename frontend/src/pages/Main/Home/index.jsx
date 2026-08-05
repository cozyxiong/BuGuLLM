import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FullScreenLoader } from "@/components/Preloader";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { safeJsonParse } from "@/utils/request";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { useTranslation } from "react-i18next";

/**
 * 首页：直接进入最近知识库（文件树主导）
 */
export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    async function go() {
      try {
        const lastVisited = safeJsonParse(
          localStorage.getItem(LAST_VISITED_WORKSPACE)
        );
        if (lastVisited?.slug) {
          const ws = await Workspace.bySlug(lastVisited.slug);
          if (ws) {
            navigate(paths.workspace.chat(ws.slug), { replace: true });
            return;
          }
        }
        const list = await Workspace.all();
        if (list?.length > 0) {
          navigate(paths.workspace.chat(list[0].slug), { replace: true });
          return;
        }
        // 无工作区则创建一个
        const { workspace, message } = await Workspace.new({
          name: t("new-workspace.placeholder") || "我的知识库",
        });
        if (workspace?.slug) {
          navigate(paths.workspace.chat(workspace.slug), { replace: true });
          return;
        }
        showToast(message || "无法创建知识库", "error");
      } finally {
        setBooting(false);
      }
    }
    go();
  }, [navigate, t]);

  return <FullScreenLoader />;
}
