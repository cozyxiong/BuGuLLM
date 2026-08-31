import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TextHOne,
  TextHTwo,
  TextHThree,
  TextHFour,
  ListNumbers,
  ListBullets,
  CheckSquare,
  BracketsCurly,
  Quotes,
  Table,
  Minus,
  Link,
  DotsSixVertical,
} from "@phosphor-icons/react";
import {
  blockHitRect,
  convertBlock,
  focusBlock,
  computeEditorDrop,
  getBlockAtY,
  getTopBlock,
  getWysiwygRoot,
  insertMarkdownAt,
  moveBlock,
} from "./blockConvert";
import { BAGU_MD_TYPE } from "@/utils/splitMarkdownBlocks";

const TURN_ITEMS = [
  { type: "h1", label: "标题 1", Icon: TextHOne },
  { type: "h2", label: "标题 2", Icon: TextHTwo },
  { type: "h3", label: "标题 3", Icon: TextHThree },
  { type: "h4", label: "标题 4", Icon: TextHFour },
  { type: "hr", label: "分隔符", Icon: Minus },
  { type: "link", label: "链接", Icon: Link },
  { type: "ol", label: "有序列表", Icon: ListNumbers },
  { type: "ul", label: "无序列表", Icon: ListBullets },
  { type: "check", label: "任务列表", Icon: CheckSquare },
  { type: "code", label: "代码块", Icon: BracketsCurly },
  { type: "table", label: "表格", Icon: Table },
  { type: "quote", label: "引用", Icon: Quotes },
];

function placeMenu(rowRect, menuSize = { width: 280, height: 108 }) {
  const gap = 8;
  const width = menuSize.width;
  const height = menuSize.height;
  let left = Math.min(
    Math.max(12, rowRect.left),
    window.innerWidth - width - 12
  );
  const spaceAbove = rowRect.top - 12;
  let top;
  if (spaceAbove >= height + gap) {
    top = rowRect.top - height - gap;
  } else {
    top = rowRect.bottom + gap;
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - height - 12);
    }
  }
  return { left, top };
}

export default function BlockHandleLayer({
  containerRef,
  vditorRef,
  enabled = true,
}) {
  const handleRef = useRef(null);
  const menuRef = useRef(null);
  const blockRef = useRef(null);
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  const draggedRef = useRef(false);
  const [pos, setPos] = useState(null);
  const [menu, setMenu] = useState(null);
  const [drop, setDrop] = useState(null);

  const getHost = useCallback(
    () => containerRef.current?.parentElement || containerRef.current,
    [containerRef]
  );

  const hideHandle = useCallback(() => {
    if (dragRef.current || menuRef.current) return;
    blockRef.current = null;
    setPos(null);
  }, []);

  const updateHandle = useCallback(
    (block) => {
      const host = getHost();
      if (!host || !block) return;
      const hostRect = host.getBoundingClientRect();
      const rect = blockHitRect(block);
      const gutterEl =
        block.tagName === "LI"
          ? block.closest("[data-block='0']") ||
            block.closest("ul, ol") ||
            block
          : block;
      const gutterLeft = gutterEl.getBoundingClientRect().left;
      blockRef.current = block;
      setPos({
        top: rect.top - hostRect.top,
        left: Math.max(0, gutterLeft - hostRect.left - 32),
        height: Math.max(24, Math.min(rect.height, 32)),
        rowHeight: Math.max(24, rect.height),
        rowWidth: Math.max(rect.width + 32, hostRect.width),
      });
    },
    [getHost]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const host = getHost();
    if (!host) return undefined;

    const onMove = (e) => {
      if (dragRef.current) return;
      if (e.buttons === 1) {
        if (!menuRef.current) hideHandle();
        return;
      }
      if (menuRef.current?.contains(e.target)) return;
      if (e.target.closest?.(".vditor-toolbar, .vditor-counter, .vditor-hint")) {
        if (!menuRef.current) hideHandle();
        return;
      }
      const vditor = vditorRef.current;
      const root = getWysiwygRoot(vditor);
      if (!root) return;
      const block =
        getBlockAtY(root, e.clientY) ||
        getTopBlock(e.target, root);
      if (!block) {
        if (handleRef.current?.contains(e.target)) return;
        if (!menuRef.current) hideHandle();
        return;
      }
      updateHandle(block);
    };

    const onLeave = (e) => {
      if (host.contains(e.relatedTarget)) return;
      if (menuRef.current?.contains(e.relatedTarget)) return;
      hideHandle();
    };

    const onScroll = () => {
      if (blockRef.current) updateHandle(blockRef.current);
    };

    host.addEventListener("mousemove", onMove);
    host.addEventListener("mouseleave", onLeave);
    host.addEventListener("scroll", onScroll, true);
    return () => {
      host.removeEventListener("mousemove", onMove);
      host.removeEventListener("mouseleave", onLeave);
      host.removeEventListener("scroll", onScroll, true);
    };
  }, [vditorRef, enabled, hideHandle, updateHandle, getHost]);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (handleRef.current?.contains(e.target)) return;
      setMenu(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedRef.current) return;
    const block = blockRef.current;
    if (!block) return;
    const rowRect = block.getBoundingClientRect();
    setMenu({ ...placeMenu(rowRect), block, rowRect });
  };

  useLayoutEffect(() => {
    if (!menu?.rowRect || !menuRef.current) return;
    const el = menuRef.current;
    const next = placeMenu(menu.rowRect, {
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
    if (Math.abs(next.top - menu.top) < 1 && Math.abs(next.left - menu.left) < 1) {
      return;
    }
    setMenu((prev) => (prev ? { ...prev, ...next } : prev));
  }, [menu]);

  const applyType = (type) => {
    const vditor = vditorRef.current;
    const block = menu?.block || blockRef.current;
    setMenu(null);
    if (!vditor || !block) return;
    const next = convertBlock(vditor, block, type);
    if (next) {
      blockRef.current = next;
      focusBlock(next);
      requestAnimationFrame(() => updateHandle(next));
    }
  };

  const onDragStart = (e) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().replace(/\u200b/g, "").trim()) {
      e.preventDefault();
      return;
    }
    const block = blockRef.current;
    if (!block) return;
    draggedRef.current = true;
    dragRef.current = block;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "block");
    block.classList.add("bagu-block-dragging");
    setMenu(null);
  };

  const onDragEnd = () => {
    dragRef.current?.classList.remove("bagu-block-dragging");
    dragRef.current = null;
    dropRef.current = null;
    setDrop(null);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (!enabled) return undefined;
    const wrap = containerRef.current;
    if (!wrap) return undefined;

    const isIncomingMd = (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      if (types.includes(BAGU_MD_TYPE)) return true;
      if (dragRef.current) return false;
      return types.includes("text/plain");
    };

    const onContentDragStart = (e) => {
      if (e.target.closest?.(".bagu-block-handle")) return;
      e.preventDefault();
    };

    const onDragOver = (e) => {
      const incoming = isIncomingMd(e);
      if (!dragRef.current && !incoming) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dragRef.current ? "move" : "copy";
      const vditor = vditorRef.current;
      const root = getWysiwygRoot(vditor);
      const block =
        getBlockAtY(root, e.clientY) || getTopBlock(e.target, root);
      if (!block || block === dragRef.current) {
        dropRef.current = null;
        setDrop(null);
        return;
      }
      const host = wrap.parentElement || wrap;
      const next = computeEditorDrop(
        block,
        e.clientX,
        e.clientY,
        host,
        root
      );
      if (!next) {
        dropRef.current = null;
        setDrop(null);
        return;
      }
      const prev = dropRef.current;
      if (
        prev &&
        prev.block === next.block &&
        prev.place === next.place &&
        prev.target === next.target &&
        prev.showHint === next.showHint &&
        prev.level === next.level &&
        Math.abs(prev.top - next.top) < 1 &&
        Math.abs(prev.left - next.left) < 1
      ) {
        return;
      }
      dropRef.current = next;
      setDrop(next);
    };

    const hideDrop = () => {
      if (!dropRef.current) return;
      dropRef.current = null;
      setDrop(null);
    };

    const pointInHost = (e, el) => {
      const x = e.clientX;
      const y = e.clientY;
      if (e.type === "dragleave" && x === 0 && y === 0) {
        return !!(e.relatedTarget && el.contains(e.relatedTarget));
      }
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const host = wrap.parentElement || wrap;

    const onDrop = (e) => {
      const incoming = isIncomingMd(e);
      if (!dragRef.current && !incoming) return;
      e.preventDefault();
      const vditor = vditorRef.current;
      const hint = dropRef.current;
      const root = getWysiwygRoot(vditor);
      const target =
        hint?.target ||
        hint?.block ||
        getTopBlock(e.target, root) ||
        getBlockAtY(root, e.clientY);
      let place = hint?.insertPlace || hint?.place;
      if (!place && target) {
        const r = target.getBoundingClientRect();
        place = e.clientY < r.top + r.height / 2 ? "before" : "after";
      }
      if (dragRef.current) {
        if (target && place) moveBlock(vditor, dragRef.current, target, place);
      } else {
        const md =
          e.dataTransfer.getData(BAGU_MD_TYPE) ||
          e.dataTransfer.getData("text/plain");
        if (md && md !== "block") insertMarkdownAt(vditor, target, place || "after", md);
      }
      hideDrop();
    };

    const onDragLeave = (e) => {
      if (e.relatedTarget && host.contains(e.relatedTarget)) return;
      if (!pointInHost(e, host)) hideDrop();
    };

    const onDocDragOver = (e) => {
      if (!dropRef.current) return;
      if (!pointInHost(e, host)) hideDrop();
    };

    host.addEventListener("dragstart", onContentDragStart, true);
    host.addEventListener("dragover", onDragOver);
    host.addEventListener("dragleave", onDragLeave);
    host.addEventListener("drop", onDrop);
    document.addEventListener("dragover", onDocDragOver);
    document.addEventListener("dragend", hideDrop, true);
    return () => {
      host.removeEventListener("dragstart", onContentDragStart, true);
      host.removeEventListener("dragover", onDragOver);
      host.removeEventListener("dragleave", onDragLeave);
      host.removeEventListener("drop", onDrop);
      document.removeEventListener("dragover", onDocDragOver);
      document.removeEventListener("dragend", hideDrop, true);
    };
  }, [containerRef, vditorRef, enabled]);

  if (!enabled) return null;

  return (
    <>
      {pos && (
        <button
          ref={handleRef}
          type="button"
          draggable
          aria-label="拖动或转换块"
          className="bagu-block-handle"
          style={{ top: pos.top, left: pos.left, height: pos.height }}
          onClick={openMenu}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <DotsSixVertical size={16} weight="bold" />
        </button>
      )}
      {drop && (
        <div
          className={`bagu-block-drop${drop.showHint ? " bagu-block-drop--promote" : ""}`}
          style={{
            top: drop.top - 1,
            left: drop.left,
            width: drop.width,
          }}
        >
          <div className="bagu-block-drop-hint" />
          <div className="bagu-block-drop-dot" />
          <div className="bagu-block-drop-line" />
        </div>
      )}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="bagu-block-menu"
            style={{ left: menu.left, top: menu.top }}
            role="menu"
          >
            <div className="grid grid-cols-6 gap-1 px-2.5 py-2">
              {TURN_ITEMS.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  title={label}
                  aria-label={label}
                  className="bagu-block-menu-icon"
                  onClick={() => applyType(type)}
                >
                  <Icon size={18} weight="regular" />
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
