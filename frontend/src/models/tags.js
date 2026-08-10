import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Tags = {
  list: async function (slug) {
    return await fetch(`${API_BASE}/tags/${slug}`, {
      method: "GET",
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },

  create: async function (slug, name, color) {
    return await fetch(`${API_BASE}/tags/${slug}`, {
      method: "POST",
      body: JSON.stringify({ name, color }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },

  delete: async function (slug, id) {
    return await fetch(`${API_BASE}/tags/${slug}/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },

  assign: async function (slug, fileId, tagIds) {
    return await fetch(`${API_BASE}/tags/${slug}/assign`, {
      method: "POST",
      body: JSON.stringify({ fileId, tagIds }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },

  suggest: async function (slug, fileId, filePath) {
    return await fetch(`${API_BASE}/tags/${slug}/suggest`, {
      method: "POST",
      body: JSON.stringify({ fileId, filePath }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },

  batchClassify: async function (slug) {
    return await fetch(`${API_BASE}/tags/${slug}/batch-classify`, {
      method: "POST",
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
};

export default Tags;
