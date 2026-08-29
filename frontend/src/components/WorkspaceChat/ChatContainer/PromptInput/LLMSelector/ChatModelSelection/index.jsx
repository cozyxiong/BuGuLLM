import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check } from "@phosphor-icons/react";
import useGetProviderModels, {
  DISABLED_PROVIDERS,
} from "@/hooks/useGetProvidersModels";

function buildGroups(defaultModels, customModels) {
  const groups = [];
  if (defaultModels?.length) {
    groups.push({
      label: "通用模型",
      items: defaultModels.map((m) => ({ id: m, name: m })),
    });
  }
  if (Array.isArray(customModels) && customModels.length) {
    groups.push({
      label: "已发现模型",
      items: customModels.map((m) => ({
        id: m.id,
        name: m.name || m.id,
      })),
    });
  }
  if (
    customModels &&
    !Array.isArray(customModels) &&
    typeof customModels === "object"
  ) {
    Object.entries(customModels).forEach(([organization, models]) => {
      groups.push({
        label: organization,
        items: (models || []).map((m) => ({
          id: m.id,
          name: m.name || m.id,
        })),
      });
    });
  }
  return groups;
}

function ModelOptionList({ groups, selectedId, onPick }) {
  return (
    <div className="py-1">
      {groups.map((group) => (
        <div key={group.label} className="mb-1 last:mb-0">
          <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 light:text-slate-400">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                data-model-option={item.id}
                onClick={() => onPick(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left border-none cursor-pointer transition-colors min-w-0 ${
                  active
                    ? "bg-zinc-700 light:bg-slate-200"
                    : "bg-transparent hover:bg-zinc-700/50 light:hover:bg-slate-100"
                }`}
              >
                <span className="flex-1 min-w-0 text-xs text-white light:text-slate-900 truncate whitespace-nowrap">
                  {item.name}
                </span>
                {active ? (
                  <Check
                    size={14}
                    weight="bold"
                    className="shrink-0 text-theme-button-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ChatModelSelection({
  provider,
  setHasChanges,
  selectedLLMModel,
  setSelectedLLMModel,
}) {
  const { defaultModels, customModels, loading } =
    useGetProviderModels(provider);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  const groups = useMemo(
    () => buildGroups(defaultModels, customModels),
    [defaultModels, customModels]
  );
  const allItems = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups]
  );
  const selectedName =
    allItems.find((i) => i.id === selectedLLMModel)?.name ||
    selectedLLMModel ||
    "选择模型";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const inTrigger = wrapRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (id) => {
    setHasChanges(true);
    setSelectedLLMModel(id);
    setOpen(false);
  };

  const toggleOpen = () => {
    const next = !open;
    if (next && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      const width = r.width;
      let top = r.bottom + 6;
      const maxH = 208;
      if (top + maxH > window.innerHeight - 8) {
        top = Math.max(8, r.top - maxH - 6);
      }
      setMenuPos({ top, left: r.left, width });
    }
    setOpen(next);
  };

  if (DISABLED_PROVIDERS.includes(provider)) return null;

  if (loading) {
    return (
      <div className="h-9 w-full rounded-xl bg-zinc-900/60 light:bg-slate-100 border border-zinc-700/60 light:border-slate-200 animate-pulse" />
    );
  }

  const hiddenSelect = (
    <select
      id="workspace-llm-model-select"
      className="hidden"
      value={selectedLLMModel || ""}
      onChange={() => {}}
    >
      {allItems.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="relative" ref={wrapRef}>
      {hiddenSelect}
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full h-9 px-3 rounded-xl bg-zinc-900 light:bg-white border border-zinc-700/80 light:border-slate-200 text-sm text-white light:text-slate-900 flex items-center gap-2 hover:border-zinc-500 light:hover:border-slate-300 transition-colors"
      >
        <span className="flex-1 min-w-0 text-left truncate whitespace-nowrap">
          {selectedName}
        </span>
        <CaretDown
          size={12}
          weight="bold"
          className={`shrink-0 text-zinc-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[90] max-h-52 overflow-y-auto rounded-xl border border-zinc-700/80 light:border-slate-200 bg-zinc-800 light:bg-white shadow-xl"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
            >
              {allItems.length ? (
                <ModelOptionList
                  groups={groups}
                  selectedId={selectedLLMModel}
                  onPick={pick}
                />
              ) : (
                <p className="px-3 py-2.5 text-xs text-zinc-500">暂无可用模型</p>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
