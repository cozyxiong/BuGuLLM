import React from "react";
import { Link, useLocation } from "react-router-dom";
import { isPathMatch } from "@/utils/paths";
import useScrollActiveItemIntoView from "@/hooks/useScrollActiveItemIntoView";

/** 与学习模块顶栏 NavLink 同一套选中/悬停 */
export default function MenuOption({
  btnText,
  icon,
  href,
  flex = false,
  user = null,
  roles = [],
  hidden = false,
}) {
  const location = useLocation();
  const isActive = href ? isPathMatch(href, location.pathname) : false;
  const { ref } = useScrollActiveItemIntoView({
    isActive,
    behavior: "instant",
    block: "center",
  });

  if (hidden) return null;
  if (!flex && !roles.includes(user?.role)) return null;
  if (flex && !!user && !roles.includes(user?.role)) return null;
  if (!href) return null;

  return (
    <Link
      ref={ref}
      to={href}
      className={[
        "settings-nav-item flex items-center gap-2 w-full pl-3 pr-2.5 py-[7px] mb-px rounded-none",
        "text-[13px] font-medium whitespace-nowrap transition-colors",
        isActive
          ? "is-active text-theme-text-primary"
          : "text-theme-text-secondary hover:text-theme-text-primary",
      ].join(" ")}
    >
      {icon}
      <span className="truncate">{btnText}</span>
    </Link>
  );
}
