import { createContext, useContext, useState } from "react";

const ChatSidebarContext = createContext();

export function ChatSidebarProvider({ children }) {
  const [activeSidebar, setActiveSidebar] = useState(null);
  const [sidebarData, setSidebarData] = useState(null);

  function openSidebar(type, data = null) {
    setActiveSidebar(type);
    setSidebarData(data);
  }

  function closeSidebar() {
    setActiveSidebar(null);
    setSidebarData(null);
  }

  function toggleSidebar(type, data = null) {
    if (activeSidebar === type) closeSidebar();
    else openSidebar(type, data);
  }

  return (
    <ChatSidebarContext.Provider
      value={{
        activeSidebar,
        sidebarData,
        openSidebar,
        closeSidebar,
        toggleSidebar,
      }}
    >
      {children}
    </ChatSidebarContext.Provider>
  );
}

export function useChatSidebar() {
  return useContext(ChatSidebarContext);
}

/**
 * 来源侧栏数据：
 * - 兼容旧用法 openSidebar(sourcesArray)
 * - NotebookLM 风格：openSidebar({ sources, focusIndex, claim }) 定位并高亮答案相关段落
 */
export function useSourcesSidebar() {
  const { activeSidebar, sidebarData, openSidebar, closeSidebar } =
    useContext(ChatSidebarContext);

  const normalized =
    activeSidebar === "sources"
      ? Array.isArray(sidebarData)
        ? { sources: sidebarData, focusIndex: null, claim: "" }
        : {
            sources: sidebarData?.sources || [],
            focusIndex:
              typeof sidebarData?.focusIndex === "number"
                ? sidebarData.focusIndex
                : null,
            claim: sidebarData?.claim || "",
          }
      : { sources: [], focusIndex: null, claim: "" };

  return {
    sidebarOpen: activeSidebar === "sources",
    sources: normalized.sources,
    focusIndex: normalized.focusIndex,
    claim: normalized.claim,
    openSidebar: (payload) => {
      if (Array.isArray(payload)) {
        openSidebar("sources", {
          sources: payload,
          focusIndex: null,
          claim: "",
        });
      } else if (payload && Array.isArray(payload.sources)) {
        openSidebar("sources", {
          sources: payload.sources,
          focusIndex:
            typeof payload.focusIndex === "number" ? payload.focusIndex : null,
          claim: typeof payload.claim === "string" ? payload.claim : "",
        });
      } else {
        openSidebar("sources", {
          sources: [],
          focusIndex: null,
          claim: "",
        });
      }
    },
    closeSidebar,
  };
}

export function useMemoriesSidebar() {
  const { activeSidebar, toggleSidebar, closeSidebar } =
    useContext(ChatSidebarContext);
  return {
    sidebarOpen: activeSidebar === "memories",
    toggleSidebar: () => toggleSidebar("memories"),
    closeSidebar,
  };
}

/**
 * Reusable animation wrapper for right-side chat panels.
 * Uses a fixed-width wrapper + GPU-composited translateX so opening/closing
 * never triggers layout recalculation on the chat history (which can have
 * 500+ message nodes).
 */
export default function ChatSidebar({ isOpen, children }) {
  return (
    <div
      className="h-full flex-shrink-0 overflow-hidden"
      style={{
        width: isOpen ? "366px" : "0px",
        transition: "width 400ms cubic-bezier(0.4,0,0.2,1)",
        willChange: isOpen ? "width" : "auto",
        contain: "strict",
      }}
    >
      <div
        className="h-full"
        style={{
          width: "366px",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 400ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
