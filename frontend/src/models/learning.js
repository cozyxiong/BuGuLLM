import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

async function jsonFetch(url, options = {}) {
  return await fetch(url, {
    ...options,
    headers: { ...baseHeaders(), ...(options.headers || {}) },
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return { error: data.error || `请求失败 ${r.status}` };
      return data;
    })
    .catch((e) => ({ error: e.message }));
}

const Learning = {
  list: async function (slug, filters = {}) {
    const url = new URL(`${API_BASE}/learning/${slug}/items`);
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
    return jsonFetch(url, { method: "GET" });
  },

  getDue: async function (slug, limit = 30) {
    const url = new URL(`${API_BASE}/learning/${slug}/due`);
    url.searchParams.set("limit", String(limit));
    return jsonFetch(url, { method: "GET" });
  },

  getMindmaps: async function (slug) {
    return jsonFetch(`${API_BASE}/learning/${slug}/mindmaps`, { method: "GET" });
  },

  getTrash: async function (slug) {
    return jsonFetch(`${API_BASE}/learning/${slug}/trash`, { method: "GET" });
  },

  contextBudget: async function (slug, { filePaths = [], kind, count } = {}) {
    return jsonFetch(`${API_BASE}/learning/${slug}/context-budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePaths, kind, count }),
    });
  },

  getSettings: async function (slug) {
    return jsonFetch(`${API_BASE}/learning/${slug}/settings`, { method: "GET" });
  },

  updateSettings: async function (slug, settings) {
    return jsonFetch(`${API_BASE}/learning/${slug}/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  create: async function (slug, data) {
    return jsonFetch(`${API_BASE}/learning/${slug}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** 为 pending 闪卡按需生成 RAG 答案 */
  ensureAnswer: async function (slug, itemId) {
    return jsonFetch(
      `${API_BASE}/learning/${slug}/items/${itemId}/ensure-answer`,
      { method: "POST", body: JSON.stringify({}) }
    );
  },

  review: async function (slug, itemId, rating, { keepTrash = false } = {}) {
    return jsonFetch(`${API_BASE}/learning/${slug}/review`, {
      method: "POST",
      body: JSON.stringify({ itemId, rating, keepTrash: !!keepTrash }),
    });
  },

  moveToTrash: async function (slug, itemId) {
    return jsonFetch(`${API_BASE}/learning/${slug}/trash`, {
      method: "POST",
      body: JSON.stringify({ itemId }),
    });
  },

  restore: async function (slug, itemId) {
    return jsonFetch(`${API_BASE}/learning/${slug}/restore`, {
      method: "POST",
      body: JSON.stringify({ itemId }),
    });
  },

  update: async function (slug, itemId, data) {
    return jsonFetch(`${API_BASE}/learning/${slug}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, ...data }),
    });
  },

  rename: async function (slug, itemIds, data) {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter(
      (id) => id != null && id !== ""
    );
    const renamed = await jsonFetch(`${API_BASE}/learning/${slug}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids, ...data }),
    });
    if (!renamed?.error) return renamed;
    const results = await Promise.all(
      ids.map((id) => this.update(slug, id, data))
    );
    const err = results.find((r) => r.error);
    if (err) return err;
    return { success: true, items: results.map((r) => r.item).filter(Boolean) };
  },

  delete: async function (slug, itemId) {
    return jsonFetch(`${API_BASE}/learning/${slug}/items/${itemId}`, {
      method: "DELETE",
    });
  },

  deleteMany: async function (slug, itemIds) {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter(
      (id) => id != null && id !== ""
    );
    if (!ids.length) return { success: true, count: 0 };
    return jsonFetch(`${API_BASE}/learning/${slug}/items/batch-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids }),
    });
  },

  emptyTrash: async function (slug) {
    return jsonFetch(`${API_BASE}/learning/${slug}/trash`, {
      method: "DELETE",
    });
  },
};

export default Learning;
