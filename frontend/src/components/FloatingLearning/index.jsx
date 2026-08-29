import React from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { GraduationCap } from "@phosphor-icons/react";
import paths from "@/utils/paths";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";
import { isWorkspaceOverlayPath } from "@/hooks/useMainWorkspaceRoute";

/**
 * 学习入口：对话 FAB 上方
 */
export default function FloatingLearning() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const { chatMode } = useWorkspaceUI();

  if (!slug || chatMode === "full" || chatMode === "compose") return null;
  if (pathname.includes("/learning")) return null;

  const overlay = isWorkspaceOverlayPath(pathname);
  const bottom =
    chatMode === "compose" && overlay ? "5.5rem" : "5.75rem";

  return (
    <Link
      to={paths.workspace.learning(slug)}
      style={{ bottom }}
      className="absolute z-40 right-6 w-12 h-12 rounded-full bg-theme-bg-secondary backdrop-blur border border-theme-modal-border text-theme-text-primary shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
      aria-label="学习 Studio"
      title="学习"
    >
      <GraduationCap size={22} weight="fill" />
    </Link>
  );
}
