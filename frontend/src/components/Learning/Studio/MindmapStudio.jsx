import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import showToast from "@/utils/toast";
import {
  startGenerateJob,
  useGenerateKind,
  useRefreshOnGenerateDone,
} from "../generateJobs";
import StudioShell from "./StudioShell";
import MindMap, { MindMapList } from "../MindMap";
import { useActiveFilePaths } from "../LearningContext";
import { normalizeLearningItem } from "../utils";
import { ArrowsIn, ArrowsOut, X } from "@phosphor-icons/react";
import GenerateButton from "./GenerateButton";
import { EnlargedStage, HistoryRail } from "./SessionHistory";
import { generateStage, generatePanel } from "./formStyles";
import { loadPlayerOpen, savePlayerOpen } from "./playerPref";

const STORE_KEY = (slug) => `bagullm.learn.session.${slug}.mindmap`;

export default function MindmapStudio() {
  const { slug } = useParams();
  const filePaths = useActiveFilePaths();
  const generating = useGenerateKind(slug, "mindmap");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayerState] = useState(() =>
    loadPlayerOpen("mindmap", slug)
  );
  const setShowPlayer = useCallback(
    (open) => {
      setShowPlayerState(open);
      savePlayerOpen("mindmap", slug, open);
    },
    [slug]
  );
  const [enlarged, setEnlarged] = useState(false);

  const refresh = useCallback(
    async (preferId = null) => {
      const r = await Learning.getMindmaps(slug);
      if (r.error) {
        showToast(r.error, "error");
        setList([]);
        setSelected(null);
        setLoading(false);
        return [];
      }
      const items = (r.items || []).map((it) => normalizeLearningItem(it));
      setList(items);
      const stored =
        preferId == null
          ? (() => {
              try {
                return sessionStorage.getItem(STORE_KEY(slug));
              } catch {
                return null;
              }
            })()
          : null;
      setSelected((prev) => {
        const wantId = preferId ?? prev?.id ?? stored;
        if (wantId != null) {
          const found = items.find(
            (i) => String(i.id) === String(wantId)
          );
          if (found) return found;
        }
        return items[0] || null;
      });
      setLoading(false);
      return items;
    },
    [slug]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setShowPlayerState(loadPlayerOpen("mindmap", slug));
  }, [slug]);

  useEffect(() => {
    if (selected?.id == null) return;
    try {
      sessionStorage.setItem(STORE_KEY(slug), String(selected.id));
    } catch {
      /* ignore */
    }
  }, [slug, selected?.id]);

  const onJobDone = useCallback(
    (job) => {
      setShowPlayer(true);
      refresh(job.itemId || null);
    },
    [refresh]
  );
  useRefreshOnGenerateDone(slug, "mindmap", onJobDone);

  const handleClearAll = async () => {
    const ids = list.map((m) => m.id).filter(Boolean);
    if (!ids.length) return;
    if (
      !window.confirm(`确定清除全部 ${list.length} 条历史？此操作不可恢复。`)
    )
      return;
    const result = await Learning.deleteMany(slug, ids);
    if (result.error) showToast(result.error, "error");
    else showToast("已清除全部历史", "success");
    setEnlarged(false);
    setShowPlayer(false);
    setSelected(null);
    await refresh();
  };

  const handleDeleteMap = async (m) => {
    const n = normalizeLearningItem(m);
    const name = n?.sessionTitle || n?.title || m.title || "该导图";
    if (!window.confirm(`确定删除「${name}」？`)) return;
    if (selected?.id === m.id) setEnlarged(false);
    const r = await Learning.delete(slug, m.id);
    if (r.error) {
      showToast(r.error, "error");
      return;
    }
    showToast("已删除", "success");
    await refresh();
  };

  const handleRenameMap = async (m, name) => {
    setList((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, title: name, sessionTitle: name } : x
      )
    );
    if (selected?.id === m.id) {
      setSelected((prev) =>
        prev ? { ...prev, title: name, sessionTitle: name } : prev
      );
    }
    const r = await Learning.rename(slug, [m.id], {
      title: name,
      sessionTitle: name,
    });
    if (r.error) {
      showToast(r.error, "error");
      await refresh(m.id);
      return;
    }
    await refresh(m.id);
  };

  const handleGenerate = () => {
    if (!filePaths.length) {
      showToast("请先在左侧选择笔记（单击打开或 Ctrl/Shift 多选）", "warning");
      return;
    }
    const r = startGenerateJob({
      slug,
      kind: "mindmap",
      filePaths,
    });
    if (r.error) showToast(r.error, "warning");
  };

  return (
    <StudioShell
      title="思维导图"
      description="根据所选笔记生成结构化知识导图，便于梳理与复习"
      requireDocs
      fillHeight
      budgetKind="mindmap"
    >
      <div className="h-full flex min-h-0 border-t border-theme-modal-border">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {showPlayer && selected && !enlarged ? (
            <>
              <div className="shrink-0 h-12 px-4 border-b border-theme-modal-border flex items-center justify-end gap-0.5 bg-theme-bg-primary/50">
                <button
                  type="button"
                  onClick={() => setEnlarged(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover"
                  title="放大"
                  aria-label="放大"
                >
                  <ArrowsOut className="w-4 h-4" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnlarged(false);
                    setShowPlayer(false);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover"
                  title="关闭"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" weight="bold" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <MindMap item={selected} />
              </div>
            </>
          ) : (
            <div className={generateStage}>
              <div className={generatePanel}>
                <GenerateButton
                  loading={generating}
                  disabled={!filePaths.length}
                  onClick={handleGenerate}
                >
                  生成导图
                </GenerateButton>
                {!filePaths.length && (
                  <p className="text-[10px] text-theme-text-secondary leading-relaxed">
                    请先在左侧文件树选择笔记
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <HistoryRail count={list.length} onClear={handleClearAll}>
          {loading ? (
            <p className="text-[11px] text-theme-text-secondary p-3">加载中…</p>
          ) : (
            <MindMapList
              list={list}
              selectedId={selected?.id}
              onSelect={(m) => {
                setSelected(normalizeLearningItem(m));
                setShowPlayer(true);
                setEnlarged(false);
              }}
              onDelete={handleDeleteMap}
              onRename={handleRenameMap}
            />
          )}
        </HistoryRail>
      </div>
      {enlarged && selected ? (
        <EnlargedStage>
          <div className="shrink-0 h-12 px-4 border-b border-theme-modal-border flex items-center justify-end gap-0.5 bg-theme-bg-primary/50">
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover"
              title="还原"
              aria-label="还原"
            >
              <ArrowsIn className="w-4 h-4" weight="bold" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <MindMap item={selected} />
          </div>
        </EnlargedStage>
      ) : null}
    </StudioShell>
  );
}
