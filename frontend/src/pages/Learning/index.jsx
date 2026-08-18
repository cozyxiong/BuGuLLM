import React, { useEffect, useState } from "react";
import LearningContainer from "@/components/Learning";
import FloatingChat from "@/components/FloatingChat";
import FloatingLearning from "@/components/FloatingLearning";
import Workspace from "@/models/workspace";
import { useParams } from "react-router-dom";

/**
 * 学习 Studio 主内容。侧栏由 WorkspaceLayout 常驻，不在此重挂载。
 */
export default function LearningPage() {
  return (
    <div className="flex-1 min-w-0 h-full relative">
      <LearningContainer />
      <LearningChatBridge />
    </div>
  );
}

function LearningChatBridge() {
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState(null);
  useEffect(() => {
    if (!slug) return;
    Workspace.bySlug(slug).then(setWorkspace);
  }, [slug]);
  return (
    <>
      <FloatingLearning />
      <FloatingChat loading={!workspace} workspace={workspace} />
    </>
  );
}
