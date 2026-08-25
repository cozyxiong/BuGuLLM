import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Learning from "@/models/learning";
import StudioShell from "./StudioShell";
import TrashBin from "../Trash";

export default function TrashStudio() {
  const { slug } = useParams();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    const r = await Learning.getTrash(slug);
    setItems(r.items || []);
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <StudioShell
      title="回收站"
      description="卡片打叉、测试答错会进入这里。点开放大复习，答对后可删除"
      fillHeight
    >
      <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6 flex flex-col">
        <TrashBin slug={slug} items={items} onRefresh={refresh} />
      </div>
    </StudioShell>
  );
}
