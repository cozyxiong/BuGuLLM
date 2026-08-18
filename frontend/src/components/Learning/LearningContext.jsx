import React, { createContext, useContext, useMemo } from "react";

const LearningCtx = createContext(null);

export function LearningProvider({ value, children }) {
  return <LearningCtx.Provider value={value}>{children}</LearningCtx.Provider>;
}

export function useLearning() {
  const ctx = useContext(LearningCtx);
  if (!ctx) throw new Error("useLearning must be used within LearningProvider");
  return ctx;
}

/** 当前用于生成的文档路径：多选优先，否则当前打开文件 */
export function useActiveFilePaths() {
  const { multiSelectPaths, multiSelectMode, selectedFile } = useLearning();
  return useMemo(() => {
    if (multiSelectMode && multiSelectPaths?.length) return multiSelectPaths;
    if (selectedFile?.path) return [selectedFile.path];
    return [];
  }, [multiSelectMode, multiSelectPaths, selectedFile]);
}
