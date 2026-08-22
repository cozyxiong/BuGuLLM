import React, { useState } from "react";
import { CaretDown, CaretRight, TreeStructure } from "@phosphor-icons/react";
import { normalizeLearningItem, parseItemContent } from "../utils";
import { HistoryListItem } from "../Studio/SessionHistory";

function MindMapNode({ node, depth = 0 }) {
  // 默认展开前两层，避免「生成成功却像空白」
  const [collapsed, setCollapsed] = useState(depth > 2);
  const children = Array.isArray(node?.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const label =
    node?.text ||
    node?.label ||
    node?.name ||
    node?.title ||
    node?.topic ||
    "节点";

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-theme-file-picker-hover cursor-pointer transition-colors"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => hasChildren && setCollapsed(!collapsed)}
      >
        {hasChildren ? (
          collapsed ? (
            <CaretRight
              className="w-4 h-4 text-theme-text-secondary flex-shrink-0"
              weight="bold"
            />
          ) : (
            <CaretDown
              className="w-4 h-4 text-theme-text-secondary flex-shrink-0"
              weight="bold"
            />
          )
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}
        <span
          className={`text-sm break-words ${
            depth === 0
              ? "text-theme-text-primary font-semibold"
              : "text-theme-text-primary/90"
          }`}
        >
          {label}
        </span>
      </div>
      {hasChildren && !collapsed && (
        <div>
          {children.map((child, i) => (
            <MindMapNode key={child?.id || `${depth}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 从 item / data 中解析 nodes 数组 */
export function extractMindmapNodes(itemOrData) {
  if (!itemOrData) return [];

  if (Array.isArray(itemOrData.nodes) && itemOrData.nodes.length) {
    return itemOrData.nodes;
  }

  // learning item（可能 content 为字符串或对象）
  if (
    itemOrData.itemType === "mindmap" ||
    itemOrData.type === "mindmap" ||
    itemOrData.content != null
  ) {
    const n = normalizeLearningItem(itemOrData);
    if (Array.isArray(n?.nodes) && n.nodes.length) return n.nodes;

    const c = parseItemContent(itemOrData);
    if (Array.isArray(c.nodes) && c.nodes.length) return c.nodes;
    if (Array.isArray(c) && c.length) return c;
    if (c && (c.text || c.label || c.children || c.nodes)) {
      if (Array.isArray(c.nodes)) return c.nodes;
      return [c];
    }
    return [];
  }

  if (Array.isArray(itemOrData)) return itemOrData;
  if (itemOrData.text || itemOrData.children || itemOrData.label) {
    return [itemOrData];
  }
  return [];
}

/** 右侧历史列表 */
export function MindMapList({ list = [], selectedId, onSelect, onDelete, onRename }) {
  if (!list.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-10 text-theme-text-secondary">
        <TreeStructure className="w-6 h-6 mb-2 opacity-30" />
        <p className="text-[11px] text-center">暂无已保存的导图</p>
        <p className="text-[10px] text-center mt-1 opacity-60">
          选择笔记后点击「生成导图」
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-1.5 pb-3 space-y-0.5">
      {list.map((m) => {
        const n = normalizeLearningItem(m);
        const active = selectedId != null && selectedId === m.id;
        const names = n?.sourceNames?.length
          ? n.sourceNames
          : n?.sourcePaths || [];
        return (
          <HistoryListItem
            key={m.id}
            icon={TreeStructure}
            title={n?.sessionTitle || n?.title || m.title || "思维导图"}
            subtitle={names.length ? names.join("、") : undefined}
            active={active}
            onSelect={() => onSelect?.(m)}
            onDelete={onDelete ? () => onDelete(m) : undefined}
            onRename={onRename ? (name) => onRename(m, name) : undefined}
          />
        );
      })}
    </div>
  );
}

/** 右侧导图树视图 */
export default function MindMap({ data, item, title }) {
  const source = item || data;
  const normalized = source ? normalizeLearningItem(source) : null;
  const nodes = extractMindmapNodes(normalized || source || data);
  const heading =
    title ||
    normalized?.sessionTitle ||
    normalized?.title ||
    data?.title ||
    item?.title ||
    "思维导图";

  if (!nodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-theme-text-secondary bg-theme-bg-secondary px-4">
        <TreeStructure className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">暂无思维导图内容</p>
        <p className="text-xs mt-1 opacity-70 text-center">
          在左侧选择笔记后点击「生成导图」
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4 bg-theme-bg-secondary">
      <div className="max-w-2xl mx-auto bg-theme-bg-primary border border-theme-modal-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-theme-modal-border">
          <TreeStructure
            className="w-5 h-5 text-theme-button-primary"
            weight="bold"
          />
          <h3 className="text-theme-text-primary text-sm font-semibold truncate">
            {heading}
          </h3>
        </div>
        {nodes.map((node, i) => (
          <MindMapNode key={node?.id || i} node={node} />
        ))}
      </div>
    </div>
  );
}
