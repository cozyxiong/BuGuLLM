import React, { useState, useEffect, useCallback, useRef } from "react";
import Library from "@/models/library";
import {
  File,
  CircleNotch,
  Image as ImageIcon,
  Article,
  CaretDown,
} from "@phosphor-icons/react";
import LiveMarkdownEditor from "./LiveMarkdownEditor";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";

function recentKey(slug) {
  return `bagu-recent-docs:${slug}`;
}

function readRecentFiles(slug) {
  if (!slug) return [];
  try {
    const raw = window.sessionStorage.getItem(recentKey(slug));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function rememberRecentFile(slug, file) {
  if (!slug || !file?.path) return;
  const entry = {
    path: String(file.path).replace(/\\/g, "/"),
    name: file.name || String(file.path).split("/").pop(),
    extension: file.extension || "",
  };
  const next = [
    entry,
    ...readRecentFiles(slug).filter((item) => item.path !== entry.path),
  ].slice(0, 8);
  try {
    window.sessionStorage.setItem(recentKey(slug), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function FileEditor({ slug, file, onFileUpdate }) {
  const { docHighlight, setSelectedFile } = useWorkspaceUI();
  const [recentFiles, setRecentFiles] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [readError, setReadError] = useState(null);
  const outlineSlotRef = useRef(null);
  const restSlotRef = useRef(null);
  const contentRef = useRef("");
  const lastSavedRef = useRef("");
  const dirtyRef = useRef(false);
  contentRef.current = content;
  dirtyRef.current = dirty;

  const filePathNorm = (file?.path || "").replace(/\\/g, "/");
  const hlPath = (docHighlight?.path || "").replace(/\\/g, "/");
  // 路径全等，或 source 只给了文件名时的宽松匹配
  const pathMatched =
    !!docHighlight?.quote &&
    !!hlPath &&
    (hlPath === filePathNorm ||
      filePathNorm.endsWith(`/${hlPath}`) ||
      hlPath.endsWith(`/${filePathNorm}`) ||
      filePathNorm.split("/").pop() === hlPath.split("/").pop());
  const hl = pathMatched ? docHighlight : null;

  // Vault 内 .md 可编辑；飞书导入也是普通 Markdown（FeiShu/*.md）
  const isEditable =
    file?.extension === ".md" || file?.extension === ".markdown";
  const imageExtensions = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".ico",
  ]);
  const isImage = imageExtensions.has(file?.extension?.toLowerCase());

  useEffect(() => {
    async function loadFile() {
      if (!file) return;
      setLoading(true);
      setError(null);
      setDirty(false);
      setReadError(null);
      const result = await Library.readFile(slug, file.path);
      if (result.file) {
        setContent(result.file.content);
        lastSavedRef.current = result.file.content;
      } else {
        setReadError(result.error || "无法读取文件");
        setContent("");
        lastSavedRef.current = "";
      }
      setLoading(false);
    }
    loadFile();
  }, [file, slug]);

  useEffect(() => {
    if (!slug || !file?.path) return;
    rememberRecentFile(slug, file);
    const current = String(file.path).replace(/\\/g, "/");
    setRecentFiles(
      readRecentFiles(slug)
        .filter((item) => item.path !== current)
        .slice(0, 3)
    );
  }, [slug, file?.path, file?.name, file?.extension]);

  const persist = useCallback(
    async (workspaceSlug, path, text) => {
      if (!workspaceSlug || !path || readError) return;
      if (text === lastSavedRef.current) return;
      const result = await Library.writeMarkdown(workspaceSlug, path, text);
      if (result.error) {
        setError(result.error);
        return;
      }
      lastSavedRef.current = text;
      setDirty(false);
      onFileUpdate?.();
    },
    [readError, onFileUpdate]
  );

  useEffect(() => {
    if (!dirty || !isEditable || !file?.path || readError) return undefined;
    const workspaceSlug = slug;
    const path = file.path;
    const timer = window.setTimeout(() => {
      persist(workspaceSlug, path, contentRef.current);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [content, dirty, isEditable, file?.path, slug, readError, persist]);

  useEffect(() => {
    const workspaceSlug = slug;
    const path = file?.path;
    const editable = isEditable;
    return () => {
      if (!editable || !path || !dirtyRef.current) return;
      const text = contentRef.current;
      if (text === lastSavedRef.current) return;
      Library.writeMarkdown(workspaceSlug, path, text);
    };
  }, [file?.path, slug, isEditable]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isEditable && file?.path) persist(slug, file.path, contentRef.current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditable, file?.path, slug, persist]);

  const handleContentChange = useCallback((next) => {
    setContent((prev) => (prev === next ? prev : next));
    setDirty(true);
  }, []);

  // --- Empty state ---
  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-theme-bg-secondary gap-4">
        <div className="w-16 h-16 rounded-2xl bg-theme-settings-input-bg flex items-center justify-center">
          <File className="w-8 h-8 text-theme-text-secondary" weight="fill" />
        </div>
        <div className="text-center">
          <p className="text-theme-text-primary text-sm font-medium">
            知识库阅读器
          </p>
          <p className="text-theme-text-secondary text-xs mt-1">
            从左侧选择文档，所见即所得编辑
          </p>
        </div>
      </div>
    );
  }

  // 磁盘上已不存在（例如侧栏已删除但选择状态未清）
  if (!loading && readError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-theme-bg-secondary gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-theme-settings-input-bg flex items-center justify-center">
          <File className="w-8 h-8 text-theme-text-secondary" weight="fill" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-theme-text-primary text-sm font-medium truncate">
            {file.name}
          </p>
          <p className="text-red-400 text-xs mt-2">{readError}</p>
          <p className="text-theme-text-secondary text-[10px] mt-2">
            文档可能已被删除，请从左侧重新选择
          </p>
        </div>
      </div>
    );
  }

  // --- Image ---
  if (isImage && loading) {
    return (
      <div className="flex flex-col h-full bg-theme-bg-secondary">
        <div className="flex items-center px-4 py-2 border-b border-theme-modal-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-theme-text-secondary shrink-0" />
            <p className="text-theme-text-primary text-sm truncate">
              {file.name}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1 gap-2">
          <CircleNotch className="w-5 h-5 text-theme-text-secondary animate-spin" />
          <p className="text-theme-text-secondary text-sm">加载图片...</p>
        </div>
      </div>
    );
  }

  if (isImage && !loading && content) {
    return (
      <div className="flex flex-col h-full bg-theme-bg-secondary">
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-modal-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-theme-text-secondary shrink-0" />
            <p className="text-theme-text-primary text-sm truncate">
              {file.name}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#1a1a1a]">
          <img
            src={content}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded shadow-lg"
          />
        </div>
      </div>
    );
  }

  // --- Unsupported ---
  if (!isEditable && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-theme-bg-secondary gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-theme-settings-input-bg flex items-center justify-center">
          <File className="w-8 h-8 text-theme-text-secondary" weight="fill" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-theme-text-primary text-sm font-medium truncate">
            {file.name}
          </p>
          <p className="text-theme-text-secondary text-xs mt-1">
            {file.extension?.toUpperCase().replace(".", "")} 文件不支持在线编辑
          </p>
          <p className="text-theme-text-secondary text-[10px] mt-2">
            该文件已导入知识库，可通过 RAG 在对话中检索其内容
          </p>
        </div>
      </div>
    );
  }

  // --- Editable Markdown：Typora 风格实时编辑 ---
  return (
    <div className="flex flex-col h-full bg-theme-bg-secondary">
      <div className="bagu-editor-topbar flex items-center px-2 h-11 border-b border-theme-modal-border shrink-0 min-w-0 overflow-visible">
        <div className="flex items-center min-w-0 flex-1">
        <div ref={outlineSlotRef} className="bagu-editor-topbar-outline shrink-0" />
        <span className="bagu-editor-topbar-sep" />
        <div className="relative group min-w-0 max-w-[70%]">
          <button
            type="button"
            className="flex items-center gap-1.5 min-w-0 max-w-full px-1.5 py-1 rounded-md hover:bg-white/5 light:hover:bg-black/5"
          >
            <Article
              className="w-4 h-4 text-theme-text-secondary shrink-0"
              weight="duotone"
            />
            <p className="text-theme-text-primary text-sm truncate">{file.name}</p>
            <CaretDown
              size={11}
              className="text-theme-text-secondary shrink-0 opacity-60"
            />
          </button>
          {recentFiles.length > 0 && (
            <div className="absolute left-0 top-full z-[60] pt-1.5 hidden group-hover:block group-focus-within:block">
              <div className="bagu-recent-menu">
                {recentFiles.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className="bagu-recent-menu-item"
                    onClick={() => setSelectedFile({ ...item, type: "file" })}
                  >
                    <span className="bagu-recent-menu-name">{item.name}</span>
                    <span className="bagu-recent-menu-path">{item.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
        <div
          ref={restSlotRef}
          className="bagu-editor-topbar-rest shrink-0"
        />
        <div className="flex-1 min-w-0" aria-hidden="true" />
      </div>

      {(error || readError) && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 shrink-0">
          <span className="text-red-400 text-xs">{error || readError}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReadError(null);
            }}
            className="text-red-400/60 hover:text-red-400 text-xs ml-auto"
          >
            关闭
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-2">
          <CircleNotch className="w-5 h-5 text-theme-text-secondary animate-spin" />
          <p className="text-theme-text-secondary text-sm">加载中...</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <LiveMarkdownEditor
            value={content}
            onChange={handleContentChange}
            slug={slug}
            filePath={file.path}
            className="h-full"
            outlineSlotRef={outlineSlotRef}
            restSlotRef={restSlotRef}
            highlightQuote={hl?.quote || null}
            highlightToken={hl?.token || null}
          />
        </div>
      )}
    </div>
  );
}
