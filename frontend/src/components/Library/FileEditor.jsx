import React, { useState, useEffect, useCallback } from "react";
import Library from "@/models/library";
import {
  File,
  FloppyDisk,
  CircleNotch,
  Image as ImageIcon,
  Article,
} from "@phosphor-icons/react";
import LiveMarkdownEditor from "./LiveMarkdownEditor";
import { useWorkspaceUI } from "@/components/WorkspaceUIContext";

export function FileEditor({ slug, file, onFileUpdate }) {
  const { docHighlight } = useWorkspaceUI();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [readError, setReadError] = useState(null);

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
      } else {
        setReadError(result.error || "无法读取文件");
        setContent("");
      }
      setLoading(false);
    }
    loadFile();
  }, [file, slug]);

  const handleSave = useCallback(async () => {
    if (!file || !dirty || readError) return;
    setSaving(true);
    setError(null);
    const result = await Library.writeMarkdown(slug, file.path, content);
    if (result.error) {
      setError(result.error);
    } else {
      setDirty(false);
      onFileUpdate?.();
    }
    setSaving(false);
  }, [file, slug, content, dirty, readError, onFileUpdate]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && isEditable) handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dirty, isEditable, handleSave]);

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
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme-modal-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Article
            className="w-4 h-4 text-theme-text-secondary shrink-0"
            weight="duotone"
          />
          <p className="text-theme-text-primary text-sm truncate">{file.name}</p>
          {dirty && (
            <span className="text-[10px] text-yellow-500 font-medium shrink-0">
              未保存
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] text-theme-text-secondary">
            Ctrl+S 保存
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
              dirty
                ? "bg-theme-button-primary text-white hover:opacity-90"
                : "bg-theme-settings-input-bg text-theme-text-secondary cursor-not-allowed"
            }`}
          >
            {saving ? (
              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FloppyDisk className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {saving ? "保存中..." : dirty ? "保存" : "已保存"}
            </span>
          </button>
        </div>
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
            highlightQuote={hl?.quote || null}
            highlightToken={hl?.token || null}
          />
        </div>
      )}
    </div>
  );
}
