import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FolderNotch,
  File,
  FilePlus,
  CaretDown,
  CaretRight,
  Trash,
  PencilSimple,
  CheckSquare,
  Square,
  MinusSquare,
} from "@phosphor-icons/react";
import { middleTruncate } from "@/utils/directories";

const ROW_HEIGHT = 36;
const INDENT = 16;
const AUTO_EXPAND_DELAY = 800;

/* ====== Small helpers ====== */

function parentPath(p) {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(0, idx) : "";
}

/** Build flat array of visible nodes */
function flattenTree(items, expanded, level = 0) {
  const result = [];
  for (const item of items) {
    const isOpen = !!expanded[item.path];
    result.push({ ...item, level, isOpen, isInternal: item.type === "folder" });
    if (item.type === "folder" && item.items && isOpen) {
      result.push(...flattenTree(item.items, expanded, level + 1));
    }
  }
  return result;
}

function isDescendant(dragPath, nodePath) {
  return dragPath.startsWith(nodePath + "/");
}

/** 节点自身 + 全部子孙路径（含子文件夹） */
function collectSubtreePaths(node) {
  const out = [];
  const walk = (n) => {
    if (!n?.path) return;
    out.push(n.path);
    if (Array.isArray(n.items)) n.items.forEach(walk);
  };
  walk(node);
  return out;
}

function collectFolderExpandPaths(node) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.type === "folder" && n.path) {
      out.push(n.path);
      (n.items || []).forEach(walk);
    }
  };
  walk(node);
  return out;
}

function toggleSubtreeSelection(prev, node) {
  const subtree = collectSubtreePaths(node);
  if (!subtree.length) return prev;
  const selected = new Set(prev);
  const fully = subtree.every((p) => selected.has(p));
  if (fully) {
    const drop = new Set(subtree);
    return prev.filter((p) => !drop.has(p));
  }
  return [...new Set([...prev, ...subtree])];
}

/** 多选时若父文件夹也在选中列表中，只保留顶层项 */
function filterTopLevelItems(items) {
  const paths = new Set(items.map((i) => i.path));
  return items.filter((item) => {
    let p = parentPath(item.path);
    while (p) {
      if (paths.has(p)) return false;
      p = parentPath(p);
    }
    return true;
  });
}

function canDropOnNode(dragItems, nodePath) {
  if (!dragItems?.length) return false;
  if (dragItems.some((d) => d.path === nodePath)) return false;
  for (const d of dragItems) {
    if (d.type === "folder" && isDescendant(nodePath, d.path)) return false;
  }
  return true;
}

/* ====== ContextMenu ====== */
function ContextMenu({ x, y, node, onDelete, onStartRename, onNewDocument, onClose }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [onClose]);
  if (!node) return null;
  const menuStyle = {};
  if (typeof window !== "undefined") {
    if (x + 160 > window.innerWidth) menuStyle.right = window.innerWidth - x;
    else menuStyle.left = x;
    if (y + 140 > window.innerHeight) menuStyle.bottom = window.innerHeight - y;
    else menuStyle.top = y;
  }
  const isFolder = node.type === "folder";
  // Portal to body so chat pane stacking (z-[2] etc.) cannot cover the menu
  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9990] bg-theme-bg-secondary border border-theme-modal-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={menuStyle}
    >
      <div className="px-3 py-1.5 text-[10px] text-theme-text-secondary truncate border-b border-theme-modal-border/50 max-w-[220px]">{node.name}</div>
      {isFolder && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNewDocument?.(node);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors"
        >
          <FilePlus className="w-3.5 h-3.5" />
          新增文档
        </button>
      )}
      <button onClick={(e) => { e.stopPropagation(); onStartRename?.(node); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors">
        <PencilSimple className="w-3.5 h-3.5" />重命名{isFolder ? "文件夹" : "文件"}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete?.(node); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
        <Trash className="w-3.5 h-3.5" />删除{isFolder ? "文件夹" : "文件"}
      </button>
      {/* 文件信息：仅修改日期，置底 */}
      {!isFolder && node.updatedAt && (
        <div className="px-3 py-2 border-t border-theme-modal-border/50">
          <p className="text-[10px] text-theme-text-secondary">
            修改日期:{" "}
            <span className="text-theme-text-primary">
              {new Date(node.updatedAt)
                .toLocaleString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })
                .replace(
                  /(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d)/,
                  "$1\u00A0\u00A0\u00A0$2"
                )}
            </span>
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}

/* ====== computeDrop (react-arborist algorithm) ====== */

function measureHover(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const y = clientY - Math.round(rect.y);
  const height = rect.height;
  const pad = height / 4;
  return {
    inTopHalf: y < height / 2,
    inMiddle: y > pad && y < height - pad,
  };
}

function computeDrop(node, el, clientX, clientY, prevNode, nextNode) {
  const hover = measureHover(el, clientX, clientY);

  // 首/末子节点检测（仅用于隐藏线样式）
  const isFirstChild = (!prevNode || prevNode.level < node.level) && node.level > 0;
  const isLastChild = (!nextNode || nextNode.level < node.level) && node.level > 0;

  // Drop into folder (middle of row)
  if (node.isInternal && hover.inMiddle) {
    return {
      drop: { parentId: node.path, index: null, before: null },
      cursor: { type: "highlight", index: node.flatIndex },
    };
  }

  // Is a leaf or closed folder → top/bottom half determines before/after
  const isItemLike = node.type === "file" || !node.isOpen;
  if (isItemLike || !node.isInternal) {
    if (hover.inTopHalf) {
      return {
        drop: { parentId: parentPath(node.path), index: node.flatIndex, before: node.name },
        cursor: { type: "line", index: node.flatIndex, level: node.level, canPromote: isFirstChild },
      };
    } else {
      return {
        drop: { parentId: parentPath(node.path), index: node.flatIndex + 1, before: nextNode?.name || null },
        cursor: { type: "line", index: node.flatIndex + 1, level: node.level, canPromote: isLastChild },
      };
    }
  }

  // Open folder: top → line above, bottom → line below
  if (hover.inTopHalf) {
    return {
      drop: { parentId: parentPath(node.path), index: node.flatIndex, before: node.name },
      cursor: { type: "line", index: node.flatIndex, level: node.level, canPromote: isFirstChild },
    };
  }
  return {
    drop: { parentId: parentPath(node.path), index: node.flatIndex + 1, before: nextNode?.name || null },
    cursor: { type: "line", index: node.flatIndex + 1, level: node.level, canPromote: isLastChild },
  };
}

/* ====== Cursor (drop indicator overlay) — 仅样式；type/index/level/canPromote 逻辑不变 ====== */

function clearDropHighlightStyles(el) {
  if (!el) return;
  el.style.background = "";
  el.style.boxShadow = "";
  el.style.borderRadius = "";
  el.style.border = "";
  el.classList.remove(
    "rounded-lg",
    "rounded",
    "ring-1",
    "ring-2",
    "ring-blue-400/60",
    "bg-blue-500/10"
  );
}

function Cursor(_, ref) {
  // 中性色：随 --file-drop-* 适配深/浅色，不抢戏
  return (
    <div
      ref={ref}
      className="absolute left-0 right-1.5 pointer-events-none z-10 hidden"
    >
      <div className="flex items-center cursor-inner h-[2px]">
        <div
          className="cursor-hint shrink-0 h-[2px] rounded-full hidden"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--file-drop-hint))",
          }}
        />
        <div
          className="cursor-dot shrink-0 w-1.5 h-1.5 rounded-full"
          style={{
            background: "var(--file-drop-line)",
            boxShadow:
              "0 0 0 2px var(--file-drop-dot-ring), 0 1px 3px rgba(0,0,0,0.25)",
          }}
        />
        <div
          className="cursor-line flex-1 h-[2px] ml-1.5 rounded-full min-w-0"
          style={{
            background:
              "linear-gradient(90deg, var(--file-drop-line) 0%, var(--file-drop-line-fade) 55%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}

Cursor = React.forwardRef(Cursor);

function updateCursor(el, cursor) {
  if (!el) return;
  if (!cursor || cursor.type === "none") {
    el.style.display = "none";
    clearDropHighlightStyles(el);
    return;
  }
  const top = cursor.index * ROW_HEIGHT;
  const dot = el.querySelector(".cursor-dot");
  const line = el.querySelector(".cursor-line");
  const hint = el.querySelector(".cursor-hint");
  const inner = el.querySelector(".cursor-inner");
  const level = cursor.level || 0;

  if (cursor.type === "highlight") {
    el.style.display = "block";
    el.style.top = top + "px";
    el.style.height = ROW_HEIGHT + "px";
    el.style.marginLeft = "2px";
    el.style.right = "6px";
    el.style.borderRadius = "8px";
    el.style.background = "var(--file-drop-folder-bg)";
    el.style.boxShadow = "inset 0 0 0 1px var(--file-drop-folder-ring)";
    if (inner) inner.style.display = "none";
  } else {
    el.style.display = "block";
    el.style.top = top - 1 + "px";
    el.style.height = "auto";
    el.style.right = "";
    clearDropHighlightStyles(el);
    if (inner) inner.style.display = "flex";
    if (dot) dot.style.display = "";
    if (line) line.style.display = "";

    el.style.marginLeft = INDENT * level + 12 + "px";
    if (hint && cursor.canPromote) {
      hint.style.display = "block";
      hint.style.width = INDENT + "px";
      hint.style.opacity = "0.55";
      hint.style.marginLeft = -INDENT + "px";
    } else if (hint) {
      hint.style.display = "none";
    }
  }
}

/* ====== TreeNodeRow ====== */

const TreeNodeRow = React.memo(function TreeNodeRow({
  node,
  prevNode,
  nextNode,
  isSelected,
  showCheckbox,
  onNodeClick,
  onToggleCheck,
  onDelete,
  dragItems,
  isDragSource,
  onDragStart,
  onShowCursor,
  onHideCursor,
  onDrop,
  onDragEnd,
  onHoverFolder,
  onContextMenu,
  editingNode,
  onCommitRename,
  dragCount,
}) {
  const inputRef = useRef(null);
  const isEditing = editingNode?.path === node.path;
  // 有选择框时少留一点左侧空白，避免挤占文件名
  const paddingLeft =
    (showCheckbox ? 4 : 12) + node.level * INDENT + (node.type === "file" ? 4 : 0);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); onCommitRename?.(null); }
  };

  const commitEdit = () => {
    if (!editingNode || !inputRef.current) return;
    const newBasename = inputRef.current.value.trim();
    if (!newBasename || newBasename === editingNode.basename) {
      onCommitRename?.(null);
      return;
    }
    const newName = editingNode.type === "folder" ? newBasename : `${newBasename}${editingNode.extension}`;
    onCommitRename?.(node, newName);
  };

  const handleDragStart = useCallback((e) => {
    if (isEditing) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", node.path);

    // 自定义拖拽图像：让鼠标固定在拖拽元素的左上角
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";
    clone.style.width = rect.width + "px";
    clone.style.opacity = "0.85";
    clone.style.pointerEvents = "none";
    if (dragCount > 1) {
      const badge = document.createElement("span");
      badge.textContent = String(dragCount);
      badge.style.cssText =
        "position:absolute;top:4px;right:8px;min-width:18px;height:18px;padding:0 5px;" +
        "border-radius:9999px;background:#3b82f6;color:#fff;font-size:11px;font-weight:600;" +
        "display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.25);";
      clone.style.position = "fixed";
      clone.appendChild(badge);
    }
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, 0, 0);
    requestAnimationFrame(() => clone.remove());

    onDragStart?.(e, node);
  }, [isEditing, node, onDragStart, dragCount]);

  const handleDragOver = useCallback((e) => {
    if (!canDropOnNode(dragItems, node.path)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const result = computeDrop(node, e.currentTarget, e.clientX, e.clientY, prevNode, nextNode);
    if (result.cursor) {
      onShowCursor?.(result.cursor);
      if (result.cursor.type === "highlight" && !node.isOpen) {
        onHoverFolder?.(node.path);
      } else {
        onHoverFolder?.(null);
      }
    }
  }, [dragItems, node, prevNode, nextNode, onShowCursor, onHoverFolder]);

  const handleDragLeave = useCallback(() => {
    onHideCursor?.();
  }, [onHideCursor]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canDropOnNode(dragItems, node.path)) return;

    const result = computeDrop(node, e.currentTarget, e.clientX, e.clientY, prevNode, nextNode);
    if (result.drop) {
      onDrop?.(e, result.drop);
    }
    onHideCursor?.();
  }, [dragItems, node, prevNode, nextNode, onDrop, onHideCursor]);

  const handleClick = useCallback((e) => {
    if (isEditing) return;
    onNodeClick?.(e, node);
  }, [isEditing, node, onNodeClick]);

  const handleContext = useCallback((e) => {
    onContextMenu?.(e, node);
  }, [onContextMenu, node]);

  const checkBtn = showCheckbox ? (
    <button
      type="button"
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggleCheck?.(node, e);
      }}
      className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-theme-file-picker-hover"
      title={isSelected ? "取消选择" : "选择"}
      aria-checked={isSelected}
      role="checkbox"
    >
      {isSelected ? (
        <CheckSquare className="w-4 h-4 text-theme-button-primary" weight="fill" />
      ) : (
        <Square className="w-4 h-4 text-theme-text-secondary" />
      )}
    </button>
  ) : null;

  if (node.type === "file") {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContext}
        className={`text-theme-text-primary text-xs grid grid-cols-12 hover:bg-theme-file-picker-hover cursor-pointer file-row group rounded-lg mx-0.5 ${
          isSelected ? "selected" : ""
        } ${isDragSource ? "opacity-30 ring-1 ring-white/15" : ""}`}
        style={{ paddingLeft, height: ROW_HEIGHT, alignItems: "center" }}
      >
        <div className="col-span-8 flex gap-x-[4px] items-center min-w-0">
          {checkBtn}
          <File className="shrink-0 text-base font-bold w-4 h-4 mr-[3px] text-theme-text-primary" weight="fill" />
          {isEditing ? (
            <input ref={inputRef} defaultValue={editingNode.basename} onKeyDown={handleEditKeyDown} onBlur={commitEdit}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-theme-settings-input-bg text-theme-text-primary text-xs px-1.5 py-0.5 rounded border border-blue-500 focus:outline-none" />
          ) : (
            <p className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">{middleTruncate(node.name, 45)}</p>
          )}
        </div>
        <div className="col-span-4 flex items-center justify-end gap-2 pr-2">
          {!isEditing && onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(node); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 shrink-0 transition-opacity"
              style={{ opacity: isSelected ? 1 : undefined }}>
              <Trash className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Folder row
  const childCount = node.items?.length ?? 0;
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onContextMenu={handleContext}
      className={`text-theme-text-primary text-xs grid grid-cols-12 hover:bg-theme-file-picker-hover cursor-pointer file-row transition-colors rounded-lg mx-0.5 ${
        isSelected ? "selected" : ""
      } ${isDragSource ? "opacity-30 ring-1 ring-white/15" : ""}`}
      style={{ paddingLeft, height: ROW_HEIGHT, alignItems: "center" }}
    >
      <div className="col-span-8 flex gap-x-[4px] items-center min-w-0">
        {checkBtn}
        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
          {node.isOpen ? <CaretDown className="text-base font-bold w-4 h-4 text-theme-text-primary" />
            : <CaretRight className="text-base font-bold w-4 h-4 text-theme-text-primary" />}
        </div>
        <FolderNotch className="shrink-0 text-base font-bold w-4 h-4 mr-[3px] text-yellow-500" weight="fill" />
        {isEditing ? (
          <input ref={inputRef} defaultValue={editingNode.basename} onKeyDown={handleEditKeyDown} onBlur={commitEdit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-theme-settings-input-bg text-theme-text-primary text-xs px-1.5 py-0.5 rounded border border-blue-500 focus:outline-none" />
        ) : (
          <>
            <p className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">{middleTruncate(node.name, 40)}</p>
            {childCount > 0 && <span className="text-theme-text-secondary text-[10px] font-medium ml-1 shrink-0">({childCount})</span>}
          </>
        )}
      </div>
      <div className="col-span-4" />
    </div>
  );
});

/* ====== FolderTree (main) ====== */
export function FolderTree({
  tree,
  onFileSelect,
  selectedFile,
  onDelete,
  onCommitRename,
  /** 在指定文件夹下新建文档 (folderNode) => void */
  onNewDocument,
  searchTerm = "",
  onDragStart,
  onDrop,
  onDragEnd,
  dragItems,
  /** (paths: string[], { multiSelectMode: boolean }) => void */
  onMultiSelectChange,
}) {
  const [expanded, setExpanded] = useState({});
  const [selectedPaths, setSelectedPaths] = useState([]);
  /** 仅 Ctrl/Shift+点击进入；仅点「取消」退出（不随松开修饰键消失） */
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const containerRef = useRef(null);
  const cursorRef = useRef(null);
  const expandTimerRef = useRef(null);
  /** 当前拖拽悬停待展开的文件夹路径；同一路径不重置计时器 */
  const hoverExpandPathRef = useRef(null);
  const selectionAnchorRef = useRef(null);

  // Mirror dragItems in a ref so callbacks don't depend on it (avoids re-renders)
  const dragItemsRef = useRef(dragItems);
  useEffect(() => { dragItemsRef.current = dragItems; }, [dragItems]);

  const showCheckboxes = multiSelectMode;

  // 向父组件同步多选状态（学习模块等）
  useEffect(() => {
    onMultiSelectChange?.(selectedPaths, { multiSelectMode });
  }, [selectedPaths, multiSelectMode, onMultiSelectChange]);

  const visibleNodes = useMemo(() => {
    const filtered = filterTree(tree?.items || [], searchTerm);
    return flattenTree(filtered, expanded).map((n, i) => ({ ...n, flatIndex: i }));
  }, [tree, expanded, searchTerm]);

  const prevNextMap = useMemo(() => {
    const map = {};
    visibleNodes.forEach((n, i) => {
      map[n.path] = {
        prev: visibleNodes[i - 1] || null,
        next: visibleNodes[i + 1] || null,
      };
    });
    return map;
  }, [visibleNodes]);

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const handleShowCursor = useCallback((c) => {
    updateCursor(cursorRef.current, c);
  }, []);

  const handleHideCursor = useCallback(() => {
    updateCursor(cursorRef.current, null);
  }, []);

  /**
   * 拖到折叠文件夹中部并停留 AUTO_EXPAND_DELAY 后自动展开。
   * dragover 会高频触发：同一 path 不得重置计时器，否则永远展不开。
   */
  const handleHoverFolder = useCallback(
    (path) => {
      if (path && path === hoverExpandPathRef.current) {
        // 仍在同一文件夹上：保留已有计时器
        if (expandTimerRef.current) return;
        // 计时器已触发过但 path 未清：无需再开
        return;
      }

      clearExpandTimer();
      hoverExpandPathRef.current = path || null;

      if (path) {
        expandTimerRef.current = setTimeout(() => {
          expandTimerRef.current = null;
          setExpanded((prev) => {
            if (prev[path]) return prev;
            return { ...prev, [path]: true };
          });
        }, AUTO_EXPAND_DELAY);
      }
    },
    [clearExpandTimer]
  );

  const toggleFolder = useCallback((path) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const handleDragEndCleanup = useCallback(
    (e) => {
      updateCursor(cursorRef.current, null);
      clearExpandTimer();
      hoverExpandPathRef.current = null;
      onDragEnd?.(e);
    },
    [clearExpandTimer, onDragEnd]
  );

  const handleDropWithCleanup = useCallback((e, dropResult) => {
    updateCursor(cursorRef.current, null);
    clearExpandTimer();
    hoverExpandPathRef.current = null;

    // 保持源文件夹和目标文件夹展开，避免 tree 刷新后收缩
    const items = dragItemsRef.current || [];
    const keepExpanded = new Set();
    items.forEach((item) => {
      const parent = parentPath(item.path);
      if (parent) keepExpanded.add(parent);
    });
    if (dropResult.parentId) keepExpanded.add(dropResult.parentId);
    if (keepExpanded.size > 0) {
      setExpanded((prev) => {
        const next = { ...prev };
        keepExpanded.forEach((p) => { next[p] = true; });
        return next;
      });
    }

    onDrop?.(e, dropResult);
  }, [clearExpandTimer, onDrop]);

  const resolveDragItems = useCallback(
    (node) => {
      const selectedSet = new Set(selectedPaths);
      let items =
        selectedSet.has(node.path) && selectedPaths.length > 1
          ? visibleNodes.filter((n) => selectedSet.has(n.path))
          : [node];
      items = filterTopLevelItems(items);
      return items.sort((a, b) => (a.flatIndex ?? 0) - (b.flatIndex ?? 0));
    },
    [selectedPaths, visibleNodes]
  );

  const handleRowDragStart = useCallback(
    (e, node) => {
      const items = resolveDragItems(node);
      onDragStart?.(e, items);
    },
    [onDragStart, resolveDragItems]
  );

  const expandFoldersInNodes = useCallback((nodes) => {
    const toOpen = [];
    for (const n of nodes || []) {
      if (n?.type === "folder") toOpen.push(...collectFolderExpandPaths(n));
    }
    if (!toOpen.length) return;
    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of toOpen) {
        if (!next[p]) {
          next[p] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  /** 勾选框点击：切换单项（支持 Shift 范围选）；不退出多选模式 */
  const handleToggleCheck = useCallback(
    (node, e) => {
      const isShift = e?.shiftKey;
      if (isShift && selectionAnchorRef.current) {
        const anchorIdx = visibleNodes.findIndex(
          (n) => n.path === selectionAnchorRef.current
        );
        const currentIdx = visibleNodes.findIndex((n) => n.path === node.path);
        if (anchorIdx >= 0 && currentIdx >= 0) {
          const start = Math.min(anchorIdx, currentIdx);
          const end = Math.max(anchorIdx, currentIdx);
          const range = visibleNodes.slice(start, end + 1);
          const rangePaths = [
            ...new Set(range.flatMap((n) => collectSubtreePaths(n))),
          ];
          setSelectedPaths(rangePaths);
          expandFoldersInNodes(range);
          const filesInRange = range.filter((n) => n.type === "file");
          if (filesInRange.length)
            onFileSelect?.(filesInRange[filesInRange.length - 1]);
          return;
        }
      }

      const selecting = !selectedPaths.includes(node.path);
      setSelectedPaths((prev) => toggleSubtreeSelection(prev, node));
      selectionAnchorRef.current = node.path;
      if (selecting && node.type === "folder") expandFoldersInNodes([node]);
      if (node.type === "file") onFileSelect?.(node);
    },
    [visibleNodes, onFileSelect, selectedPaths, expandFoldersInNodes]
  );

  const handleSelectAllVisible = useCallback(() => {
    const paths = visibleNodes.map((n) => n.path);
    setSelectedPaths(paths);
    if (paths.length) selectionAnchorRef.current = paths[paths.length - 1];
  }, [visibleNodes]);

  /** 仅清空勾选，不退出多选 */
  const handleDeselectAll = useCallback(() => {
    setSelectedPaths([]);
  }, []);

  /** 唯一退出多选入口（工具条「取消」） */
  const handleExitMultiSelect = useCallback(() => {
    setSelectedPaths([]);
    setMultiSelectMode(false);
    selectionAnchorRef.current = null;
  }, []);

  const enterMultiSelect = useCallback((paths) => {
    setMultiSelectMode(true);
    setSelectedPaths(paths);
  }, []);

  const handleNodeClick = useCallback(
    (e, node) => {
      const isMod = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Shift + 点击：进入/保持多选，范围选择
      if (isShift) {
        const anchor = selectionAnchorRef.current;
        if (anchor) {
          const anchorIdx = visibleNodes.findIndex((n) => n.path === anchor);
          const currentIdx = visibleNodes.findIndex((n) => n.path === node.path);
          if (anchorIdx >= 0 && currentIdx >= 0) {
            const start = Math.min(anchorIdx, currentIdx);
            const end = Math.max(anchorIdx, currentIdx);
            const range = visibleNodes.slice(start, end + 1);
            enterMultiSelect([
              ...new Set(range.flatMap((n) => collectSubtreePaths(n))),
            ]);
            expandFoldersInNodes(range);
            const filesInRange = range.filter((n) => n.type === "file");
            if (filesInRange.length)
              onFileSelect?.(filesInRange[filesInRange.length - 1]);
            return;
          }
        }
        // 无锚点时 Shift+点击等同首次多选当前项
        enterMultiSelect(collectSubtreePaths(node));
        selectionAnchorRef.current = node.path;
        if (node.type === "folder") expandFoldersInNodes([node]);
        if (node.type === "file") onFileSelect?.(node);
        return;
      }

      // Ctrl/Cmd + 点击：进入/保持多选，切换勾选
      if (isMod) {
        setMultiSelectMode(true);
        setSelectedPaths((prev) => {
          if (prev.length === 0) {
            const seed = [];
            if (
              selectionAnchorRef.current &&
              selectionAnchorRef.current !== node.path
            ) {
              seed.push(selectionAnchorRef.current);
            }
            seed.push(...collectSubtreePaths(node));
            return [...new Set(seed)];
          }
          return toggleSubtreeSelection(prev, node);
        });
        selectionAnchorRef.current = node.path;
        if (node.type === "folder") expandFoldersInNodes([node]);
        if (node.type === "file") onFileSelect?.(node);
        return;
      }

      // —— 普通点击 ——
      // 已在多选：不退出，仅打开文件 / 展开文件夹
      if (multiSelectMode) {
        selectionAnchorRef.current = node.path;
        if (node.type === "folder") {
          toggleFolder(node.path);
          return;
        }
        onFileSelect?.(node);
        return;
      }

      // 未多选：仅查看
      selectionAnchorRef.current = node.path;
      if (node.type === "folder") {
        toggleFolder(node.path);
        return;
      }
      onFileSelect?.(node);
    },
    [
      visibleNodes,
      onFileSelect,
      toggleFolder,
      multiSelectMode,
      enterMultiSelect,
      expandFoldersInNodes,
    ]
  );

  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const handleStartRename = useCallback((node) => {
    const ext = node.extension || "";
    const basename = node.type === "folder" ? node.name
      : node.name.endsWith(ext) ? node.name.slice(0, -ext.length) : node.name;
    setEditingNode({ path: node.path, basename, extension: ext, type: node.type });
  }, []);

  const handleCommitRename = useCallback((node, newName) => {
    setEditingNode(null);
    if (node && newName) onCommitRename?.(node, newName);
  }, [onCommitRename]);

  function filterTree(items, term) {
    if (!term) return items;
    const lower = term.toLowerCase();
    return items.map((item) => {
      if (item.type === "folder") {
        const filteredChildren = filterTree(item.items || [], term);
        if (item.name.toLowerCase().includes(lower) || filteredChildren.length > 0) {
          return { ...item, items: filteredChildren };
        }
        return null;
      }
      return item.name.toLowerCase().includes(lower) ? item : null;
    }).filter(Boolean);
  }

  // Handle drops on empty area (below all rows)
  const handleRootDrop = useCallback((e) => {
    if (!dragItemsRef.current?.length) return;
    const target = e.target;
    if (target.closest('[draggable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    handleDropWithCleanup(e, { parentId: "", index: null, before: null });
  }, [handleDropWithCleanup]);

  const handleRootDragOver = useCallback((e) => {
    if (!dragItemsRef.current?.length) return;
    const target = e.target;
    if (target.closest('[draggable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    updateCursor(cursorRef.current, { type: "line", index: visibleNodes.length, level: 0 });
  }, [visibleNodes.length]);

  if (!tree || !visibleNodes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-theme-text-secondary">
        <File className="w-8 h-8 opacity-30" weight="fill" />
        <p className="text-xs">{searchTerm ? "无匹配文件" : "暂无文件"}</p>
        <p className="text-[10px]">{searchTerm ? "尝试其他关键词" : "点击上方按钮创建或导入"}</p>
      </div>
    );
  }

  const allVisibleSelected =
    visibleNodes.length > 0 &&
    visibleNodes.every((n) => selectedPaths.includes(n.path));
  const someVisibleSelected =
    !allVisibleSelected &&
    visibleNodes.some((n) => selectedPaths.includes(n.path));

  return (
    <>
      <style>{`[data-dragging] .file-row:hover{background-color:transparent!important}`}</style>
      {/* 选择工具条：按住修饰键或已有选中时显示 */}
      {showCheckboxes && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-2 py-1.5 border-b border-theme-sidebar-border bg-theme-bg-sidebar/95 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (allVisibleSelected) handleDeselectAll();
                else handleSelectAllVisible();
              }}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-theme-file-picker-hover"
              title={allVisibleSelected ? "取消全选" : "全选可见"}
            >
              {allVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-theme-button-primary" weight="fill" />
              ) : someVisibleSelected ? (
                <MinusSquare className="w-4 h-4 text-theme-button-primary" weight="fill" />
              ) : (
                <Square className="w-4 h-4 text-theme-text-secondary" />
              )}
            </button>
            <span className="text-[11px] text-theme-text-secondary truncate">
              已选{" "}
              <span className="text-theme-button-primary font-semibold">
                {selectedPaths.length}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="px-1.5 py-0.5 text-[10px] rounded text-theme-button-primary hover:bg-theme-button-primary/10 transition-colors"
            >
              全选
            </button>
            <button
              type="button"
              onClick={handleExitMultiSelect}
              className="px-1.5 py-0.5 text-[10px] rounded text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors"
              title="退出多选"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        data-dragging={dragItems?.length ? "true" : undefined}
        className="relative flex flex-col"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        <Cursor ref={cursorRef} />

        {visibleNodes.map((n) => {
          const { prev, next } = prevNextMap[n.path] || {};
          const dragSourcePaths = new Set((dragItems || []).map((d) => d.path));
          // 多选模式：用 selectedPaths；否则用当前打开文件高亮
          const isSelected = multiSelectMode
            ? selectedPaths.includes(n.path)
            : selectedFile?.path === n.path;
          const rowDragCount =
            multiSelectMode &&
            selectedPaths.includes(n.path) &&
            selectedPaths.length > 1
              ? filterTopLevelItems(
                  visibleNodes.filter((vn) => selectedPaths.includes(vn.path))
                ).length
              : 1;
          return (
            <TreeNodeRow
              key={n.path}
              node={n}
              prevNode={prev}
              nextNode={next}
              isSelected={isSelected}
              showCheckbox={showCheckboxes}
              onNodeClick={handleNodeClick}
              onToggleCheck={handleToggleCheck}
              onDelete={onDelete}
              dragItems={dragItems}
              isDragSource={dragSourcePaths.has(n.path)}
              onDragStart={handleRowDragStart}
              dragCount={rowDragCount}
              onShowCursor={handleShowCursor}
              onHideCursor={handleHideCursor}
              onDrop={handleDropWithCleanup}
              onDragEnd={handleDragEndCleanup}
              onHoverFolder={handleHoverFolder}
              onContextMenu={handleContextMenu}
              editingNode={editingNode}
              onCommitRename={handleCommitRename}
            />
          );
        })}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          onDelete={onDelete}
          onStartRename={handleStartRename}
          onNewDocument={onNewDocument}
          onClose={closeCtxMenu}
        />
      )}
    </>
  );
}
