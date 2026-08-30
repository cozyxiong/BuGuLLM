import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TextHOne,
  TextHTwo,
  TextHThree,
  ListNumbers,
  ListBullets,
  CheckSquare,
  BracketsCurly,
  Quotes,
  ChatTeardropText,
  Table,
  CaretRight,
  Link,
  Image as ImageIcon,
  Paperclip,
  DotsSixVertical,
} from "@phosphor-icons/react";
import {
  convertBlock,
  focusBlock,
  getBlockAtY,
  getTopBlock,
  getWysiwygRoot,
  moveBlock,
} from "./blockConvert";

const TURN_ITEMS = [
  { type: "h1", label: "标题 1", Icon: TextHOne },
  { type: "h2", label: "标题 2", Icon: TextHTwo },
  { type: "h3", label: "标题 3", Icon: TextHThree },
  { type: "ol", label: "有序列表", Icon: ListNumbers },
  { type: "ul", label: "无序列表", Icon: ListBullets },
  { type: "check", label: "待办", Icon: CheckSquare },
  { type: "code", label: "代码块", Icon: BracketsCurly },
  { type: "quote", label: "引用", Icon: Quotes },
  { type: "callout", label: "提示", Icon: ChatTeardropText },
  { type: "table", label: "表格", Icon: Table },
  { type: "toggle", label: "折叠列表", Icon: CaretRight },
  { type: "link", label: "链接", Icon: Link },
];

const COMMON_ITEMS = [
  { type: "task", label: "任务", Icon: CheckSquare, color: "text-blue-400" },
  { type: "image", label: "图片", Icon: ImageIcon, color: "text-amber-400" },
  {
    type: "file",
    label: "视频或文件",
    Icon: Paperclip,
    color: "text-sky-400",
  },
  { type: "table", label: "表格", Icon: Table, color: "text-emerald-400" },
];

function placeMenu(rowRect, menuSize = { width: 280, height: 268 }) {
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
      const rect = block.getBoundingClientRect();
      blockRef.current = block;
      setPos({
        top: rect.top - hostRect.top,
        left: Math.max(0, rect.left - hostRect.left - 32),
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

    const onDragOver = (e) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const vditor = vditorRef.current;
      const root = getWysiwygRoot(vditor);
      const block = getTopBlock(e.target, root);
      if (!block || block === dragRef.current) {
        dropRef.current = null;
        setDrop(null);
        return;
      }
      const host = wrap.parentElement || wrap;
      const rect = block.getBoundingClientRect();
      const wrapRect = host.getBoundingClientRect();
      const place = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      const next = {
        top: (place === "before" ? rect.top : rect.bottom) - wrapRect.top,
        left: rect.left - wrapRect.left,
        width: rect.width,
        place,
        block,
      };
      dropRef.current = next;
      setDrop(next);
    };

    const onDrop = (e) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const vditor = vditorRef.current;
      const hint = dropRef.current;
      const target =
        hint?.block || getTopBlock(e.target, getWysiwygRoot(vditor));
      let place = hint?.place;
      if (!place && target) {
        const r = target.getBoundingClientRect();
        place = e.clientY < r.top + r.height / 2 ? "before" : "after";
      }
      if (target && place) moveBlock(vditor, dragRef.current, target, place);
      dropRef.current = null;
      setDrop(null);
    };

    wrap.addEventListener("dragover", onDragOver);
    wrap.addEventListener("drop", onDrop);
    return () => {
      wrap.removeEventListener("dragover", onDragOver);
      wrap.removeEventListener("drop", onDrop);
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
          className="bagu-block-drop"
          style={{
            top: drop.top - 1,
            left: drop.left,
            width: drop.width,
          }}
        >
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
            <div className="grid grid-cols-6 gap-1 px-2.5 pt-2.5 pb-2">
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
            <div className="px-2.5 pb-2 pt-1 border-t border-white/10 light:border-slate-200">
              <p className="px-1.5 pb-1 text-[11px] text-zinc-400 light:text-slate-500">
                常用
              </p>
              {COMMON_ITEMS.map(({ type, label, Icon, color }) => (
                <button
                  key={`${type}-${label}`}
                  type="button"
                  className="bagu-block-menu-row"
                  onClick={() => applyType(type)}
                >
                  <Icon size={16} weight="fill" className={color} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
