import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

const WorkspaceUICtx = createContext(null);

export function WorkspaceUIProvider({ children }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [multiSelectPaths, setMultiSelectPaths] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  /** chatMode: 'fab' | 'compose' | 'full' */
  const [chatMode, setChatMode] = useState("fab");
  /**
   * 临时来源高亮（仅视觉）：
   * { path, quote, token } | null
   * 重新从树打开文档或 clear 后消失
   */
  const [docHighlight, setDocHighlight] = useState(null);

  const openDocument = useCallback((file, highlight = null) => {
    setSelectedFile(file);
    // 打开文档时对话收为悬浮球，露出右侧编辑器
    setChatMode("fab");
    if (file?.path && highlight?.quote) {
      setDocHighlight({
        path: file.path.replace(/\\/g, "/"),
        quote: String(highlight.quote),
        token: highlight.token || Date.now(),
      });
    } else {
      setDocHighlight(null);
    }
  }, []);

  const clearDocument = useCallback(() => {
    setSelectedFile(null);
    setDocHighlight(null);
  }, []);

  const clearDocHighlight = useCallback(() => {
    setDocHighlight(null);
  }, []);

  const onMultiSelectChange = useCallback((paths, meta) => {
    setMultiSelectPaths(paths || []);
    setMultiSelectMode(!!meta?.multiSelectMode);
  }, []);

  const value = useMemo(
    () => ({
      selectedFile,
      setSelectedFile: openDocument,
      clearDocument,
      docHighlight,
      clearDocHighlight,
      multiSelectPaths,
      multiSelectMode,
      onMultiSelectChange,
      chatMode,
      setChatMode,
    }),
    [
      selectedFile,
      openDocument,
      clearDocument,
      docHighlight,
      clearDocHighlight,
      multiSelectPaths,
      multiSelectMode,
      onMultiSelectChange,
      chatMode,
    ]
  );

  return (
    <WorkspaceUICtx.Provider value={value}>{children}</WorkspaceUICtx.Provider>
  );
}

export function useWorkspaceUI() {
  const ctx = useContext(WorkspaceUICtx);
  if (!ctx) {
    return {
      selectedFile: null,
      setSelectedFile: () => {},
      clearDocument: () => {},
      docHighlight: null,
      clearDocHighlight: () => {},
      chatMode: "fab",
      setChatMode: () => {},
      multiSelectPaths: [],
      multiSelectMode: false,
      onMultiSelectChange: () => {},
    };
  }
  return ctx;
}
