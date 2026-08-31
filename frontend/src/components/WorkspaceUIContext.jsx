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
  /** 划词 pin 到对话输入：{ text } | null */
  const [selectionPin, setSelectionPin] = useState(null);

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

  const pinSelection = useCallback((text, extra = {}) => {
    const next = String(text || "").replace(/\u200b/g, "").trim();
    if (!next) return;
    const context = String(extra.context || "").replace(/\u200b/g, "").trim();
    setSelectionPin({
      text: next,
      context: context && context !== next ? context : "",
    });
  }, []);

  const clearSelectionPin = useCallback(() => {
    setSelectionPin(null);
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
      selectionPin,
      pinSelection,
      clearSelectionPin,
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
      selectionPin,
      pinSelection,
      clearSelectionPin,
    ]
  );

  return (
    <WorkspaceUICtx.Provider value={value}>{children}</WorkspaceUICtx.Provider>
  );
}

/** 对话里给用户看的短句；模型实际收到的是 prompt（含章节全文）。 */
export function formatSelectionPin(text, pin) {
  const q = String(pin?.text || "").trim();
  const t = String(text || "").trim();
  if (!q && !t) return { visible: "", prompt: "" };
  if (!q) return { visible: t, prompt: t };
  const ctx = String(pin?.context || "").trim();
  const visible = t || `解释一下：${q}`;
  const question = t || `请解释：「${q}」`;
  const parts = [
    "请结合文档中该标题下的全文，解释用户选中的内容。",
    `选中内容：\n${q}`,
  ];
  if (ctx && ctx !== q) parts.push(`该内容所在标题下的全文：\n${ctx}`);
  parts.push(`用户问题：\n${question}`);
  return { visible, prompt: parts.join("\n\n") };
}

export function withSelectionPin(text, pin) {
  return formatSelectionPin(text, pin).prompt;
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
      selectionPin: null,
      pinSelection: () => {},
      clearSelectionPin: () => {},
      multiSelectPaths: [],
      multiSelectMode: false,
      onMultiSelectChange: () => {},
    };
  }
  return ctx;
}
