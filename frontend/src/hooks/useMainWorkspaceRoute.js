import { useRef } from "react";
import { useParams, useLocation } from "react-router-dom";

/**
 * 设置 / 学习 为覆盖层时，URL 会丢掉 threadSlug。
 * 主工作区内容若保持挂载，需冻结离开前的 slug / thread，避免误触发历史重载。
 */
export function isWorkspaceOverlayPath(pathname = "") {
  return /\/workspace\/[^/]+\/(settings|learning)(\/|$)/.test(pathname);
}

export default function useMainWorkspaceRoute() {
  const params = useParams();
  const { pathname } = useLocation();
  const isOverlay = isWorkspaceOverlayPath(pathname);
  const frozen = useRef({
    slug: params.slug,
    threadSlug: params.threadSlug ?? null,
  });

  if (!isOverlay) {
    frozen.current = {
      slug: params.slug,
      threadSlug: params.threadSlug ?? null,
    };
  }

  return {
    slug: isOverlay ? frozen.current.slug : params.slug,
    threadSlug: isOverlay
      ? frozen.current.threadSlug
      : (params.threadSlug ?? null),
    isOverlay,
    pathname,
  };
}
