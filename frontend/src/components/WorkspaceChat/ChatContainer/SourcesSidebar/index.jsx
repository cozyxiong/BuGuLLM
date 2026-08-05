import { useEffect, useMemo, useRef, useState } from "react";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import { ArrowLeft, X } from "@phosphor-icons/react";
import {
  combineLikeSources,
  parseChunkSource,
  SourceTypeCircle,
  getCustomImage,
} from "../ChatHistory/Citation";
import {
  renderSourceReaderHtml,
  resolveSourceFocus,
  sourceDisplayTitle,
} from "../ChatHistory/sourceDisplay";
import MobileCitationModal from "./MobileCitationModal";
import SourceItem from "./SourceItem";
import ChatSidebar, { useSourcesSidebar } from "../ChatSidebar";

export { useSourcesSidebar } from "../ChatSidebar";

/**
 * 来源侧栏：只展示答案相关大标题下的章节；仅匹配段落/表格黄高光；滚到高光处
 */
export default function SourcesSidebar() {
  const { sources, focusIndex, claim, sidebarOpen, closeSidebar } =
    useSourcesSidebar();
  const { t } = useTranslation();
  const [selectedRaw, setSelectedRaw] = useState(null); // 原始 source 对象
  const [activeClaim, setActiveClaim] = useState("");
  const [scrollToken, setScrollToken] = useState(0);

  const combined = useMemo(() => combineLikeSources(sources || []), [sources]);

  // 从 focusIndex 取原始 source + claim
  useEffect(() => {
    if (!sidebarOpen) {
      setSelectedRaw(null);
      setActiveClaim("");
      return;
    }
    if (typeof focusIndex === "number" && sources?.[focusIndex]) {
      setSelectedRaw(sources[focusIndex]);
      setActiveClaim(claim || "");
      setScrollToken((n) => n + 1);
    }
  }, [sidebarOpen, focusIndex, sources, claim]);

  if (isMobile) {
    return (
      <MobileCitationModal
        sources={sources}
        isOpen={sidebarOpen}
        selectedSource={
          selectedRaw
            ? {
                title: selectedRaw.title,
                references: 1,
                chunks: [
                  {
                    text: selectedRaw.text,
                    surroundingText:
                      selectedRaw.surroundingText || selectedRaw.text,
                  },
                ],
              }
            : null
        }
        setSelectedSource={(s) => {
          if (!s) setSelectedRaw(null);
        }}
        onClose={() => {
          setSelectedRaw(null);
          closeSidebar();
        }}
      />
    );
  }

  const headerTitle = selectedRaw
    ? sourceDisplayTitle(selectedRaw)
    : t("chat_window.sources");

  return (
    <ChatSidebar isOpen={sidebarOpen}>
      <div
        className="ml-4 w-[350px] bg-zinc-900 light:bg-white light:border-2 light:border-slate-300 md:rounded-[16px] p-4 flex flex-col gap-3 overflow-hidden mt-[72px]"
        style={{ maxHeight: "calc(100% - 88px)" }}
      >
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {selectedRaw && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRaw(null);
                  setActiveClaim("");
                }}
                className="text-white/60 light:text-slate-400 hover:text-white light:hover:text-slate-900 border-none bg-transparent cursor-pointer p-0 mt-0.5 flex-shrink-0"
                aria-label="返回来源列表"
              >
                <ArrowLeft size={16} weight="bold" />
              </button>
            )}
            <p
              className="font-medium text-[15px] leading-snug text-white light:text-slate-900 break-words"
              title={headerTitle}
            >
              {headerTitle}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedRaw(null);
              setActiveClaim("");
              closeSidebar();
            }}
            type="button"
            className="text-white/60 light:text-slate-400 hover:text-white light:hover:text-slate-900 transition-colors border-none bg-transparent cursor-pointer flex-shrink-0"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {selectedRaw ? (
          <SourceReader
            source={selectedRaw}
            claim={activeClaim}
            scrollToken={scrollToken}
          />
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto no-scroll flex-1 min-h-0">
            {combined.length === 0 ? (
              <p className="text-xs text-zinc-400 light:text-slate-500">
                暂无来源
              </p>
            ) : (
              combined.map((source, idx) => (
                <SourceItem
                  key={source.title || idx}
                  source={source}
                  onClick={() => {
                    // 列表点击：用该 title 下第一个原始 source
                    const raw =
                      (sources || []).find((s) => s.title === source.title) ||
                      sources?.[0];
                    if (raw) {
                      setSelectedRaw(raw);
                      setActiveClaim("");
                      setScrollToken((n) => n + 1);
                    }
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </ChatSidebar>
  );
}

function SourceReader({ source, claim = "", scrollToken = 0 }) {
  const info = parseChunkSource({
    title: source?.title,
    chunks: [{ chunkSource: source?.chunkSource, text: source?.text }],
  });
  const customImage = getCustomImage(info?.icon);
  const scrollRef = useRef(null);

  const focus = useMemo(
    () => resolveSourceFocus(source, claim),
    [source, claim]
  );

  const readerHtml = useMemo(
    () => renderSourceReaderHtml(source, claim),
    [source, claim]
  );

  // 切换来源时滚回阅读区顶部
  useEffect(() => {
    if (!scrollRef.current || !readerHtml) return;
    const id = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(id);
  }, [readerHtml, scrollToken, claim]);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center gap-2 flex-shrink-0">
        <SourceTypeCircle
          type={info.icon}
          size={18}
          iconSize={10}
          url={info.href}
          customImage={customImage}
        />
        <span className="text-xs text-zinc-400 light:text-slate-500 truncate">
          {focus.heading
            ? focus.heading.replace(/^#+\s*/, "")
            : info?.isUrl
              ? info.text
              : "知识库文档"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto no-scroll rounded-lg border border-zinc-700/60 light:border-slate-200 bg-zinc-950/40 light:bg-slate-50 p-3.5"
      >
        <div
          className="nl-src-reader text-[13px] leading-relaxed text-white light:text-slate-900 break-words"
          dangerouslySetInnerHTML={{ __html: readerHtml }}
        />
      </div>

      <style>{SIDEBAR_READER_CSS}</style>
    </div>
  );
}

const SIDEBAR_READER_CSS = `
.nl-src-reader h1,
.nl-src-reader h2,
.nl-src-reader h3,
.nl-src-reader h4 {
  font-weight: 650;
  line-height: 1.35;
  margin: 0.85em 0 0.4em;
  color: inherit;
}
.nl-src-reader h1 { font-size: 1.2em; }
.nl-src-reader h2 { font-size: 1.08em; }
.nl-src-reader h3 { font-size: 1.02em; }
.nl-src-reader p { margin: 0.45em 0; }
.nl-src-reader ul, .nl-src-reader ol {
  margin: 0.4em 0 0.55em;
  padding-left: 1.3em;
}
.nl-src-reader li { margin: 0.2em 0; }
.nl-src-reader code {
  font-size: 0.9em;
  padding: 0.1em 0.3em;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.nl-src-reader pre {
  margin: 0.55em 0;
  padding: 0.65em 0.8em;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85em;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.nl-src-reader blockquote {
  margin: 0.55em 0;
  padding-left: 0.8em;
  border-left: 3px solid color-mix(in srgb, #3b82f6 55%, transparent);
  opacity: 0.9;
}
.nl-src-reader table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.55em 0;
  font-size: 0.92em;
}
.nl-src-reader th, .nl-src-reader td {
  border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  padding: 0.35em 0.5em;
  text-align: left;
}
`;
