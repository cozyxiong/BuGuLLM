import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import Workspace from "@/models/workspace";
import ModelRouter from "@/models/modelRouter";
import showToast from "@/utils/toast";

function sameRouter(workspace, routerId) {
  const id = Number(routerId);
  return Number(workspace?.router_id) === id;
}

export default function RouterWorkspaces({ routerId }) {
  const [all, setAll] = useState([]);
  const [attached, setAttached] = useState([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const id = Number(routerId);
    const [list, bound] = await Promise.all([
      Workspace.all(),
      ModelRouter.workspaces(id),
    ]);
    const allList = list || [];
    setAll(allList);
    if (Array.isArray(bound) && bound.length > 0) {
      setAttached(bound);
      return;
    }
    setAttached(allList.filter((w) => sameRouter(w, id)));
  };

  useEffect(() => {
    load();
  }, [routerId]);

  const attachedSlugs = useMemo(
    () => new Set(attached.map((w) => w.slug)),
    [attached]
  );
  const available = all.filter((w) => !attachedSlugs.has(w.slug));

  const persistSlugs = async (slugs) => {
    const result = await ModelRouter.setWorkspaces(routerId, slugs);
    if (result?.success !== false && Array.isArray(result?.workspaces)) {
      setAttached(result.workspaces);
      return { ok: true };
    }

    // 路由接口不可用时，逐个工作区写回 router_id
    const next = new Set(slugs);
    const current = attached.map((w) => w.slug);
    const toAdd = slugs.filter((slug) => !attachedSlugs.has(slug));
    const toRemove = current.filter((slug) => !next.has(slug));

    for (const slug of toAdd) {
      const { workspace, message } = await Workspace.update(slug, {
        chatProvider: "anythingllm-router",
        router_id: Number(routerId),
      });
      if (!workspace) return { ok: false, message: message || "添加失败" };
    }
    for (const slug of toRemove) {
      const { workspace, message } = await Workspace.update(slug, {
        chatProvider: "default",
        router_id: null,
      });
      if (!workspace) return { ok: false, message: message || "移除失败" };
    }
    await load();
    return { ok: true };
  };

  const add = async () => {
    if (!selected) return;
    setSaving(true);
    const { ok, message } = await persistSlugs([
      ...attached.map((w) => w.slug),
      selected,
    ]);
    setSaving(false);
    if (!ok) {
      showToast(message || "添加失败", "error");
      return;
    }
    setSelected("");
  };

  const remove = async (slug) => {
    setSaving(true);
    const previous = attached;
    setAttached((prev) => prev.filter((w) => w.slug !== slug));
    const { ok, message } = await persistSlugs(
      previous.filter((w) => w.slug !== slug).map((w) => w.slug)
    );
    setSaving(false);
    if (!ok) {
      setAttached(previous);
      showToast(message || "移除失败", "error");
    }
  };

  return (
    <div className="mt-8 mb-10 pb-8 border-b border-white/20 light:border-slate-300">
      <p className="text-lg font-semibold leading-7 text-white light:text-slate-900">
        工作区
      </p>
      <p className="text-xs leading-4 text-zinc-400 light:text-slate-600 max-w-[700px] mt-1">
        加进来的工作区，问答和助手会按这条路由的规则换模型。
      </p>

      <div className="mt-4 flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={saving || available.length === 0}
          className="border-none bg-theme-settings-input-bg text-white light:text-slate-900 text-sm rounded-lg block w-48 p-2.5"
        >
          <option value="">
            {available.length === 0 ? "没有可添加的工作区" : "选择工作区"}
          </option>
          {available.map((ws) => (
            <option key={ws.slug} value={ws.slug}>
              {ws.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!selected || saving}
          className="border-none shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-slate-50 text-zinc-950 text-sm font-medium disabled:opacity-40"
        >
          <Plus size={14} weight="bold" />
          添加
        </button>
      </div>

      {attached.length > 0 ? (
        <ul className="mt-4 grid grid-cols-3 gap-2 max-w-3xl">
          {attached.map((ws) => (
            <li
              key={ws.slug}
              className="flex items-center justify-between gap-2 min-w-0 px-3 py-2 rounded-lg bg-white/5 light:bg-slate-100"
            >
              <span className="text-sm text-white light:text-slate-900 truncate">
                {ws.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(ws.slug);
                }}
                disabled={saving}
                className="border-none shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md text-zinc-400 hover:text-red-400 hover:bg-white/10 light:hover:bg-slate-200 disabled:opacity-40"
                aria-label={`移除 ${ws.name}`}
              >
                <X size={16} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">还没有绑定工作区。</p>
      )}
    </div>
  );
}
