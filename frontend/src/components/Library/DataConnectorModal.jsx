import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { X } from "@phosphor-icons/react";
import ConnectorImages from "@/components/DataConnectorOption/media";
import GithubOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/Github";
import GitlabOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/Gitlab";
import YoutubeOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/Youtube";
import ConfluenceOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/Confluence";
import WebsiteDepthOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/WebsiteDepth";
import DrupalWikiOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/DrupalWiki";
import ObsidianOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/Obsidian";
import PaperlessNgxOptions from "@/components/Modals/ManageWorkspace/DataConnectors/Connectors/PaperlessNgx";
import FeishuOptions from "./FeishuOptions";
import VideoOptions from "./VideoOptions";

/** 内容面板展示的连接器（顺序固定） */
export const SIDEBAR_CONNECTORS = [
  { slug: "video", name: "视频字幕", image: ConnectorImages.video },
  { slug: "feishu", name: "飞书", image: ConnectorImages.feishu },
  { slug: "github", name: "GitHub", image: ConnectorImages.github },
  { slug: "website-depth", name: "网站爬虫", image: ConnectorImages.websiteDepth },
];

/** 弹窗中展示的全部连接器 */
const ALL_CONNECTORS = [
  { slug: "github", name: "GitHub", image: ConnectorImages.github, component: GithubOptions },
  { slug: "gitlab", name: "GitLab", image: ConnectorImages.gitlab, component: GitlabOptions },
  { slug: "youtube", name: "YouTube", image: ConnectorImages.youtube, component: YoutubeOptions },
  { slug: "confluence", name: "Confluence", image: ConnectorImages.confluence, component: ConfluenceOptions },
  { slug: "website-depth", name: "网站爬虫", image: ConnectorImages.websiteDepth, component: WebsiteDepthOptions },
  { slug: "feishu", name: "飞书", image: ConnectorImages.feishu, component: FeishuOptions },
  { slug: "video", name: "视频字幕", image: ConnectorImages.video, component: VideoOptions },
  { slug: "drupalwiki", name: "Drupal Wiki", image: ConnectorImages.drupalwiki, component: DrupalWikiOptions },
  { slug: "obsidian", name: "Obsidian", image: ConnectorImages.obsidian, component: ObsidianOptions },
  { slug: "paperless-ngx", name: "Paperless-ngx", image: ConnectorImages.paperlessNgx, component: PaperlessNgxOptions },
];

export default function DataConnectorModal({ onClose, initialSlug = "github", onImport }) {
  const { slug: workspaceSlug } = useParams();
  const [selected, setSelected] = useState(initialSlug);
  const current = ALL_CONNECTORS.find((c) => c.slug === selected);
  const FormComponent = current?.component;

  // 挂到 body，避免侧栏/文档编辑器（Vditor 工具栏 z-index 较高）盖住弹窗
  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000]"
      onClick={onClose}
    >
      <div
        className="bg-theme-bg-secondary border border-theme-modal-border rounded-2xl shadow-2xl flex overflow-hidden relative z-[2001]"
        style={{
          width: "75vw",
          maxWidth: "1000px",
          height: "75vh",
          maxHeight: "700px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧：连接器列表 */}
        <div className="w-56 min-w-[180px] border-r border-theme-modal-border bg-theme-bg-sidebar flex flex-col">
          <div className="px-4 py-3 border-b border-theme-sidebar-border">
            <h3 className="text-theme-text-primary text-sm font-semibold">
              数据连接器
            </h3>
            <p className="text-theme-text-secondary text-[10px] mt-0.5">
              从外部平台导入数据
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {ALL_CONNECTORS.map((conn) => (
              <button
                key={conn.slug}
                onClick={() => setSelected(conn.slug)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selected === conn.slug
                    ? "bg-theme-button-primary/15 border border-theme-button-primary/30"
                    : "hover:bg-theme-file-picker-hover border border-transparent"
                }`}
              >
                <img
                  src={conn.image}
                  alt={conn.name}
                  className="w-7 h-7 rounded-md object-cover shrink-0"
                />
                <span
                  className={`text-xs font-medium truncate ${
                    selected === conn.slug
                      ? "text-theme-button-primary"
                      : "text-theme-text-primary"
                  }`}
                >
                  {conn.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：连接器表单 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-theme-modal-border shrink-0">
            <div className="flex items-center gap-2">
              {current?.image && (
                <img
                  src={current.image}
                  alt={current?.name}
                  className="w-6 h-6 rounded object-cover"
                />
              )}
              <h4 className="text-theme-text-primary text-sm font-medium">
                {current?.name}
              </h4>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-theme-file-picker-hover text-theme-text-secondary hover:text-theme-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {FormComponent && (
              <FormComponent
                onImport={onImport}
                workspaceSlug={workspaceSlug}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * 紧凑版连接器图标按钮（用于侧边栏内联展示，仅 logo）
 */
export function ConnectorIconButton({ icon, name, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center p-1.5 rounded-lg hover:bg-theme-file-picker-hover transition-colors"
      title={name}
      aria-label={name}
    >
      <img src={icon} alt={name} className="w-5 h-5 rounded object-cover" />
    </button>
  );
}
