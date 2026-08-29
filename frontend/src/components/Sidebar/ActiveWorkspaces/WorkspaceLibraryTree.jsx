import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Library from "@/models/library";
import { FolderTree } from "@/components/Library/FolderTree";
import DataConnectorModal, {
  ConnectorIconButton,
  SIDEBAR_CONNECTORS,
} from "@/components/Library/DataConnectorModal";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";
import {
  MagnifyingGlass,
  CircleNotch,
  File,
  FolderNotch,
  Plus,
  FolderSimplePlus,
  FileArrowUp,
  Cube,
  CaretDown,
} from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import {
  VAULT_TREE_CHANGED_EVENT,
  AGENT_SESSION_END,
} from "@/utils/chat/agent";

function normalizeRelPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

/** 删除/移动节点后，当前打开的文档是否受影响 */
function selectionAffectedByRemoval(selectedPath, removedPath, removedIsFolder) {
  const sel = normalizeRelPath(selectedPath);
  const rem = normalizeRelPath(removedPath);
  if (!sel || !rem) return false;
  if (sel === rem) return true;
  if (removedIsFolder && sel.startsWith(`${rem}/`)) return true;
  return false;
}

function parentFolderOf(filePath) {
  const p = normalizeRelPath(filePath);
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : "";
}

function collectFolders(nodes, acc = [], depth = 0) {
  for (const n of nodes || []) {
    if (n.type !== "folder") continue;
    const p = normalizeRelPath(n.path);
    acc.push({
      path: p,
      name: n.name || p.split("/").pop() || p,
      depth,
    });
    collectFolders(n.items, acc, depth + 1);
  }
  return acc;
}

function FolderSelect({ value, options, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.path === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full h-8 px-2.5 rounded-lg bg-theme-settings-input-bg border border-theme-modal-border text-xs text-theme-text-primary flex items-center gap-1.5 hover:border-theme-button-primary/40 focus:outline-none focus:ring-1 focus:ring-theme-button-primary/50 focus:border-theme-button-primary/40 transition-colors disabled:opacity-50"
      >
        <FolderNotch
          className="w-3.5 h-3.5 shrink-0 text-theme-button-primary"
          weight="duotone"
        />
        <span className="flex-1 min-w-0 text-left truncate">
          {current?.path ? current.path : "根目录"}
        </span>
        <CaretDown
          className={`w-3 h-3 shrink-0 text-theme-text-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
          weight="bold"
        />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[2010] max-h-52 overflow-y-auto rounded-xl border border-theme-modal-border bg-theme-bg-primary shadow-xl py-1">
          {options.map((opt) => {
            const active = opt.path === (current?.path || "");
            return (
              <button
                key={opt.path || "__root__"}
                type="button"
                onClick={() => {
                  onChange(opt.path);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  active
                    ? "bg-theme-button-primary/10 text-theme-text-primary"
                    : "text-theme-text-primary hover:bg-theme-file-picker-hover"
                }`}
                style={{ paddingLeft: 12 + opt.depth * 14 }}
              >
                <FolderNotch
                  className="w-3.5 h-3.5 shrink-0 text-theme-button-primary"
                  weight={active ? "fill" : "duotone"}
                />
                <span className="truncate">{opt.path ? opt.name : "根目录"}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function treeContainsPath(tree, filePath) {
  const target = normalizeRelPath(filePath);
  if (!target) return false;
  const walk = (items) => {
    for (const n of items || []) {
      if (normalizeRelPath(n.path) === target) return true;
      if (n.type === "folder" && walk(n.items)) return true;
    }
    return false;
  };
  return walk(tree?.items);
}

/**
 * 侧栏内容面板：知识库文件树（Vault-only）
 * - 数据源：storage/vault/<workspace>；连接器写入 GitHub/YouTube/FeiShu/… 等子目录
 * - + 新建文档/文件夹、导入文件/文件夹 → Vault
 * - 嵌入：Vault 文本分块向量化（中间 JSON 在 documents/embed-cache，用户不可见）
 * - 数据连接器：视频字幕 / 飞书 / GitHub / 网站爬虫等
 */
export default function WorkspaceLibraryTree({ workspaceSlug }) {
  const slug = workspaceSlug;
  const {
    selectedFile,
    setSelectedFile,
    clearDocument,
    onMultiSelectChange,
  } = useWorkspaceUI();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dragItems, setDragItems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(null);
  const [createInput, setCreateInput] = useState({ folder: "", name: "" });
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [connectorSlug, setConnectorSlug] = useState("video");
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const createMenuRef = useRef(null);
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  /** 刷新树；若当前打开文档已不在树上则关闭编辑器 */
  const applyTree = useCallback(
    (nextTree) => {
      setTree(nextTree);
      const open = selectedFileRef.current;
      if (open?.path && nextTree && !treeContainsPath(nextTree, open.path)) {
        clearDocument();
      }
    },
    [clearDocument]
  );

  const fetchLibrary = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const result = await Library.get(slug);
    if (result.tree) applyTree(result.tree);
    setLoading(false);
  }, [slug, applyTree]);

  const refreshSilently = useCallback(async () => {
    if (!slug) return;
    const result = await Library.get(slug);
    if (result.tree) applyTree(result.tree);
  }, [slug, applyTree]);

  useEffect(() => {
    clearDocument();
    setSearchTerm("");
    fetchLibrary();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // 助手 write/move/mkdir 等改 vault 后自动刷新侧栏树（防抖合并批量操作）
  useEffect(() => {
    if (!slug) return;
    let timer = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshSilently();
      }, 350);
    };
    window.addEventListener(VAULT_TREE_CHANGED_EVENT, scheduleRefresh);
    window.addEventListener(AGENT_SESSION_END, scheduleRefresh);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(VAULT_TREE_CHANGED_EVENT, scheduleRefresh);
      window.removeEventListener(AGENT_SESSION_END, scheduleRefresh);
    };
  }, [slug, refreshSilently]);

  useEffect(() => {
    if (!showCreateMenu) return;
    const onDoc = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showCreateMenu]);

  const folderOptions = [
    { path: "", name: "根目录", depth: 0 },
    ...collectFolders(tree?.items),
  ];

  const openCreate = useCallback((kind, folder = "") => {
    setShowCreateMenu(false);
    setShowCreateModal(kind);
    setCreateInput({
      folder: normalizeRelPath(folder),
      name: "",
    });
  }, []);

  const handleCreate = async () => {
    const name = createInput.name.trim().replace(/\\/g, "/");
    if (!name || name.includes("/")) {
      showToast(
        showCreateModal === "file" ? "请输入文档名称" : "请输入文件夹名称",
        "error"
      );
      return;
    }
    const folder = normalizeRelPath(createInput.folder);
    if (showCreateModal === "file") {
      const filename = name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
      const path = folder ? `${folder}/${filename}` : filename;
      const result = await Library.writeMarkdown(slug, path, "");
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
    } else {
      const path = folder ? `${folder}/${name}` : name;
      const result = await Library.createFolder(slug, path);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
    }
    setShowCreateModal(null);
    setCreateInput({ folder: "", name: "" });
    await refreshSilently();
  };

  /** 文件夹右键 → 在该目录下新增文档 */
  const handleNewDocumentInFolder = useCallback(
    (folderNode) => {
      if (!folderNode?.path) return;
      openCreate("file", folderNode.path);
    },
    [openCreate]
  );

  /** 导入到 Vault（单文件 / 文件夹，仅写 vault，不向量化） */
  const handleVaultImport = async (files) => {
    if (!files?.length) return;
    setImporting(true);
    let ok = 0;
    for (const file of files) {
      const result = await Library.importFile(
        slug,
        file,
        file.webkitRelativePath || file.name
      );
      if (result.error) showToast(result.error, "error");
      else ok += 1;
    }
    setImporting(false);
    if (ok > 0) {
      showToast(`已导入 ${ok} 个文件到知识库`, "success");
      await refreshSilently();
    }
  };

  /**
   * 轮询服务端嵌入状态：后台 worker / 长请求未结束时保持转圈（刷新后也能恢复）
   * @param {{ signal?: { cancelled: boolean } }} [opts]
   */
  const waitUntilEmbedIdle = useCallback(async (opts = {}) => {
    if (!slug) return;
    while (!opts.signal?.cancelled) {
      const status = await Library.embedStatus(slug);
      if (opts.signal?.cancelled) return;
      if (!status?.active) {
        setEmbedding(false);
        return;
      }
      setEmbedding(true);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }, [slug]);

  // 进入工作区或刷新后：若后台仍在嵌入，恢复按钮转圈
  useEffect(() => {
    if (!slug) return;
    const signal = { cancelled: false };
    (async () => {
      const status = await Library.embedStatus(slug);
      if (signal.cancelled) return;
      if (status?.active) {
        setEmbedding(true);
        await waitUntilEmbedIdle({ signal });
        if (!signal.cancelled) {
          showToast("嵌入已完成", "success");
        }
      }
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [slug, waitUntilEmbedIdle]);

  /**
   * 嵌入：对文件树中所有已导入文档分块向量化（不重新导入）
   * POST /libraries/:slug/embed-all
   */
  const handleEmbedAll = async () => {
    if (!slug || embedding) return;
    setEmbedding(true);
    try {
      const result = await Library.embedAll(slug);
      if (result.error || result.success === false) {
        showToast(result.error || "嵌入失败", "error");
        // 仍可能有残留任务，以服务端状态为准
        await waitUntilEmbedIdle();
        return;
      }
      const docCount =
        typeof result.documentCount === "number"
          ? result.documentCount
          : result.sources?.length || 0;
      const failedCount = result.failed?.length || 0;

      // 后台 worker：HTTP 已返回但任务未完 → 继续转圈，完成后再提示
      if (result.queued) {
        if (docCount > 0) {
          showToast(
            result.message || `正在嵌入${docCount}个文档…`,
            "info"
          );
        }
        await waitUntilEmbedIdle();
        showToast(
          result.message?.startsWith("已嵌入")
            ? result.message
            : `已嵌入${docCount}个文档`,
          "success"
        );
        return;
      }

      if (docCount === 0 && failedCount === 0) {
        showToast(result.message || "当前文档已全部嵌入", "info");
      } else if (failedCount > 0) {
        showToast(
          result.message || `已嵌入${docCount}个文档，部分失败`,
          "warning"
        );
      } else {
        showToast(result.message || `已嵌入${docCount}个文档`, "success");
      }
      await waitUntilEmbedIdle();
    } catch (e) {
      showToast(e.message || "嵌入失败", "error");
      await waitUntilEmbedIdle();
    }
  };

  const handleDelete = useCallback(
    async (node) => {
      const msg =
        node.type === "folder"
          ? `确定删除文件夹「${node.name}」及其所有内容？`
          : `确定删除「${node.name}」？`;
      if (!window.confirm(msg)) return;
      const result = await Library.deleteFile(slug, node.path);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      // 删当前文件，或删文件夹且当前文档在其内 → 立刻关掉右侧编辑器
      if (
        selectionAffectedByRemoval(
          selectedFileRef.current?.path,
          node.path,
          node.type === "folder"
        )
      ) {
        clearDocument();
      }
      await refreshSilently();
    },
    [slug, clearDocument, refreshSilently]
  );

  const handleCommitRename = useCallback(
    async (node, newName) => {
      const result = await Library.renameFile(slug, node.path, newName);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      const open = selectedFileRef.current;
      if (
        open?.path &&
        selectionAffectedByRemoval(
          open.path,
          node.path,
          node.type === "folder"
        )
      ) {
        // 重命名后路径失效，关闭编辑器（避免继续写到旧路径）
        clearDocument();
      }
      await refreshSilently();
    },
    [slug, clearDocument, refreshSilently]
  );

  const handleTreeDragStart = useCallback((e, nodes) => {
    e.stopPropagation();
    setDragItems(nodes);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      nodes.map((n) => n.path).join("\n")
    );
  }, []);

  const handleTreeDrop = useCallback(
    async (e, dropResult) => {
      e.preventDefault();
      e.stopPropagation();
      const items = dragItems;
      if (!items.length) return;
      const { parentId, before } = dropResult;
      const open = selectedFileRef.current;
      for (const item of items) {
        if (item.path === parentId) continue;
        if (item.type === "folder" && parentId?.startsWith(item.path + "/"))
          continue;
        await Library.moveFile(slug, item.path, parentId, before || undefined);
        if (
          open?.path &&
          selectionAffectedByRemoval(
            open.path,
            item.path,
            item.type === "folder"
          )
        ) {
          clearDocument();
        }
      }
      setDragItems([]);
      await refreshSilently();
    },
    [dragItems, slug, refreshSilently, clearDocument]
  );

  const iconBtnClass =
    "flex items-center justify-center w-8 h-8 rounded-lg bg-theme-settings-input-bg text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors disabled:opacity-50";

  if (!slug) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-theme-text-secondary gap-2">
        <File className="w-8 h-8 opacity-30" weight="fill" />
        <p className="text-xs">选择一个工作区</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-theme-text-secondary">
        <CircleNotch className="w-4 h-4 animate-spin" />
        <span className="text-xs">加载文件…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="ft-panel-search">
        <MagnifyingGlass size={13} weight="bold" className="ft-search-icon" />
        <input
          type="search"
          placeholder="搜索文件…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {(importing || embedding) && (
          <CircleNotch className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-theme-text-secondary" />
        )}
      </div>

      {/* 工具：+ | 导入文档 | 导入文件夹 | 嵌入 */}
      <div className="flex items-center gap-1 px-2.5 pb-2">
        <div className="relative" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => setShowCreateMenu((v) => !v)}
            className={iconBtnClass}
            title="新建"
            aria-label="新建"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
          </button>
          {showCreateMenu && (
            <div className="absolute left-0 top-full mt-1 z-30 min-w-[132px] py-1 rounded-lg border border-theme-modal-border bg-theme-bg-primary shadow-xl">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-primary hover:bg-theme-file-picker-hover text-left"
                onClick={() =>
                  openCreate("file", parentFolderOf(selectedFile?.path))
                }
              >
                <File className="w-3.5 h-3.5" weight="fill" />
                新建文档
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-primary hover:bg-theme-file-picker-hover text-left"
                onClick={() =>
                  openCreate("folder", parentFolderOf(selectedFile?.path))
                }
              >
                <FolderNotch className="w-3.5 h-3.5" weight="fill" />
                新建文件夹
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing || embedding}
          className={iconBtnClass}
          title="导入文档"
          aria-label="导入文档"
        >
          <FileArrowUp className="w-3.5 h-3.5" weight="bold" />
        </button>

        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          disabled={importing || embedding}
          className={iconBtnClass}
          title="导入文件夹"
          aria-label="导入文件夹"
        >
          <FolderSimplePlus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleEmbedAll}
          disabled={importing || embedding}
          className={iconBtnClass}
          title="嵌入文档"
          aria-label="嵌入文档"
        >
          {embedding ? (
            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Cube className="w-3.5 h-3.5" weight="duotone" />
          )}
        </button>
      </div>

      {/* 导入文档（单/多文件 → Vault） */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          if (e.target.files?.length)
            handleVaultImport(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      {/* 导入文件夹 → Vault */}
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          if (e.target.files?.length)
            handleVaultImport(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <FolderTree
          tree={tree}
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          onDelete={handleDelete}
          onCommitRename={handleCommitRename}
          onNewDocument={handleNewDocumentInFolder}
          searchTerm={searchTerm}
          onDragStart={handleTreeDragStart}
          onDrop={handleTreeDrop}
          onDragEnd={() => setDragItems([])}
          dragItems={dragItems}
          onMultiSelectChange={onMultiSelectChange}
        />
      </div>

      {/* 连接器图标：视频 / 飞书 / GitHub / 网站 */}
      <div className="border-t border-theme-sidebar-border shrink-0">
        <div className="flex flex-wrap justify-center gap-0.5 px-2 py-1.5">
          {SIDEBAR_CONNECTORS.map((conn) => (
            <ConnectorIconButton
              key={conn.slug}
              icon={conn.image}
              name={conn.name}
              onClick={() => {
                setConnectorSlug(conn.slug);
                setShowConnectorModal(true);
              }}
            />
          ))}
        </div>
      </div>

      {showConnectorModal && (
        <DataConnectorModal
          onClose={() => setShowConnectorModal(false)}
          initialSlug={connectorSlug}
          onImport={refreshSilently}
        />
      )}

      {/* 挂到 body，避免文档编辑器 Vditor 工具栏盖住新建弹窗 */}
      {showCreateModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000]"
            onClick={() => setShowCreateModal(null)}
          >
            <div
              className="bg-theme-bg-secondary border border-theme-modal-border rounded-2xl w-[20rem] shadow-2xl p-4 relative z-[2001]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-theme-text-primary font-semibold text-sm mb-3">
                {showCreateModal === "file" ? "新建文档" : "新建文件夹"}
              </h3>
              <div className="mb-3 flex items-center gap-1.5">
                <div className="w-[7.5rem] shrink-0">
                  <FolderSelect
                    value={createInput.folder}
                    options={folderOptions}
                    onChange={(folder) =>
                      setCreateInput((s) => ({ ...s, folder }))
                    }
                  />
                </div>
                <div className="relative min-w-0 flex-1">
                  <input
                    autoFocus
                    value={createInput.name}
                    onChange={(e) =>
                      setCreateInput((s) => ({
                        ...s,
                        name: e.target.value.replace(/[\\/]/g, ""),
                      }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder={
                      showCreateModal === "file" ? "文件名" : "文件夹名"
                    }
                    className={`w-full h-8 bg-theme-settings-input-bg text-theme-text-primary rounded-lg border border-theme-modal-border text-xs focus:outline-none focus:ring-1 focus:ring-theme-button-primary/50 focus:border-theme-button-primary/40 ${
                      showCreateModal === "file" ? "pl-2.5 pr-9" : "px-2.5"
                    }`}
                  />
                  {showCreateModal === "file" ? (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-theme-text-secondary">
                      .md
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(null)}
                  className="h-8 px-2.5 rounded-lg text-xs text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="h-8 px-3 rounded-lg text-xs font-medium text-white bg-theme-button-primary hover:opacity-90 transition-opacity"
                >
                  创建
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
