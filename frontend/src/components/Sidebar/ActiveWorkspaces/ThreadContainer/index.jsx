import paths from "@/utils/paths";
import { Link, useLocation } from "react-router-dom";

/** 侧栏仅保留 对话 / 学习 切换；新建与历史对话在全屏对话右上角 */
export const THREAD_RENAME_EVENT = "renameThread";

export default function ThreadContainer({ workspace }) {
  const { pathname } = useLocation();
  const isLearningPage = /\/workspace\/[^/]+\/learning(\/|$)/.test(pathname);

  if (!workspace?.slug) return null;

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 px-2 mb-2">
        <Link
          to={paths.workspace.chat(workspace.slug)}
          className={`flex-1 px-2 py-1 text-xs rounded text-center transition-colors ${
            !isLearningPage
              ? "bg-blue-600 text-white"
              : "text-zinc-400 hover:bg-zinc-700/50 light:hover:bg-zinc-200"
          }`}
        >
          对话
        </Link>
        <Link
          to={paths.workspace.learning(workspace.slug)}
          className={`flex-1 px-2 py-1 text-xs rounded text-center transition-colors ${
            isLearningPage
              ? "bg-blue-600 text-white"
              : "text-zinc-400 hover:bg-zinc-700/50 light:hover:bg-zinc-200"
          }`}
        >
          学习
        </Link>
      </div>
    </div>
  );
}
