import { Outlet } from "react-router-dom";
import SettingsSidebar from "./index";

/**
 * 系统设置外壳：左侧导航常驻，右侧只切换子路由。
 */
export default function SettingsLayout() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <SettingsSidebar />
      <div className="relative flex-1 min-w-0 h-full flex flex-col min-h-0 bg-theme-bg-secondary pt-12 md:pt-0">
        <Outlet />
      </div>
    </div>
  );
}
