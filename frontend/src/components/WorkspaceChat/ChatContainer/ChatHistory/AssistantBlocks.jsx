import { DotsSixVertical } from "@phosphor-icons/react";
import InlineCitedContent from "./InlineSourceCitations";
import {
  setMarkdownDragData,
  splitMarkdownBlocks,
} from "@/utils/splitMarkdownBlocks";

function onBlockDragStart(event, markdown) {
  event.stopPropagation();
  setMarkdownDragData(event, markdown);
}

export default function AssistantBlocks({ content, sources = [] }) {
  const blocks = splitMarkdownBlocks(content);
  if (!blocks.length) return null;

  return (
    <div className="bagu-chat-blocks flex flex-col gap-y-1">
      {blocks.map((md, idx) => (
        <div key={`${idx}-${md.slice(0, 24)}`} className="bagu-chat-block">
          <button
            type="button"
            draggable
            aria-label="拖到文档"
            className="bagu-chat-block-handle"
            onDragStart={(e) => onBlockDragStart(e, md)}
          >
            <DotsSixVertical size={14} weight="bold" />
          </button>
          <InlineCitedContent
            content={md}
            sources={sources}
            className="flex flex-col gap-y-1 prose-chat"
          />
        </div>
      ))}
    </div>
  );
}
