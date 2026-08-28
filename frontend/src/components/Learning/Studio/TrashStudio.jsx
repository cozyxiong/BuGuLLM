import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import StudioShell from "./StudioShell";
import TrashBin from "../Trash";
import { useActiveFilePaths } from "../LearningContext";
import { itemMatchesSourcePaths } from "../utils";
import { loadTrashShowAll, saveTrashShowAll } from "./playerPref";

export default function TrashStudio() {
  const { slug } = useParams();
  const filePaths = useActiveFilePaths();
  const [items, setItems] = useState([]);
  const [showAll, setShowAllState] = useState(() => loadTrashShowAll(slug));

  const setShowAll = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(showAll) : next;
      setShowAllState(value);
      saveTrashShowAll(slug, value);
    },
    [slug, showAll]
  );

  const refresh = useCallback(async () => {
    const r = await Learning.getTrash(slug);
    setItems(r.items || []);
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setShowAllState(loadTrashShowAll(slug));
  }, [slug]);

  const visibleItems = useMemo(() => {
    if (showAll || !filePaths.length) return items;
    return items.filter((it) => itemMatchesSourcePaths(it, filePaths));
  }, [items, filePaths, showAll]);

  return (
    <StudioShell
      title="垃圾桶"
      description="不记得的卡片和答错的测试都会进入垃圾桶"
      fillHeight
      docsFilterable
      docsShowAll={showAll}
      onDocsShowAllChange={setShowAll}
    >
      <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6 flex flex-col">
        <TrashBin
          slug={slug}
          items={visibleItems}
          onRefresh={refresh}
          emptyTitle={
            items.length && !visibleItems.length
              ? "当前资料没有错题"
              : undefined
          }
          emptyHint={
            items.length && !visibleItems.length
              ? "把右上角滑到「全部」可查看所有资料的错题"
              : undefined
          }
        />
      </div>
    </StudioShell>
  );
}
