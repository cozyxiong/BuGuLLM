import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

/** 安全解析 JSON，非 JSON 响应返回友好错误 */
async function safeJson(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 尝试从非 JSON 响应中提取有用信息
    if (res.status === 404) return { error: "请求的资源不存在，请检查服务器是否已启动。" };
    return { error: `请求失败 (${res.status})${text ? ": " + text.slice(0, 200) : ""}` };
  }
  try {
    return await res.json();
  } catch {
    return { error: "服务器返回了无效的响应格式。" };
  }
}

const Library = {
  get: async function (slug) {
    return await fetch(`${API_BASE}/libraries/${slug}`, {
      method: "GET",
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  readFile: async function (slug, path) {
    const url = new URL(`${API_BASE}/libraries/${slug}/files`);
    url.searchParams.set("path", path);
    return await fetch(url, {
      method: "GET",
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  writeMarkdown: async function (slug, path, content) {
    return await fetch(`${API_BASE}/libraries/${slug}/files`, {
      method: "POST",
      body: JSON.stringify({ path, content }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  deleteFile: async function (slug, path) {
    return await fetch(`${API_BASE}/libraries/${slug}/files`, {
      method: "DELETE",
      body: JSON.stringify({ path }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  createFolder: async function (slug, path) {
    return await fetch(`${API_BASE}/libraries/${slug}/folders`, {
      method: "POST",
      body: JSON.stringify({ path }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  importFile: async function (slug, file, targetPath) {
    const formData = new FormData();
    formData.append("file", file);
    if (targetPath) formData.append("path", targetPath);
    return await fetch(`${API_BASE}/libraries/${slug}/import`, {
      method: "POST",
      body: formData,
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  /**
   * 将文件树全部已导入文档向量化（不重新导入）
   */
  embedAll: async function (slug) {
    return await fetch(`${API_BASE}/libraries/${slug}/embed-all`, {
      method: "POST",
      headers: baseHeaders(),
    }).then(safeJson).catch((e) => ({ success: false, error: e.message }));
  },
  /** 是否仍有嵌入任务（含后台 worker） */
  embedStatus: async function (slug) {
    return await fetch(`${API_BASE}/libraries/${slug}/embed-status`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then(safeJson)
      .catch(() => ({ active: false }));
  },
  moveFile: async function (slug, source, target, before) {
    return await fetch(`${API_BASE}/libraries/${slug}/move`, {
      method: "PUT",
      body: JSON.stringify({ source, target, before }),
      headers: baseHeaders(),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
  },
  renameFile: async function (slug, path, newName) {
    return await fetch(`${API_BASE}/libraries/${slug}/rename`, {
      method: "PUT",
      body: JSON.stringify({ path, newName }),
      headers: baseHeaders(),
    }).then(safeJson).catch((e) => ({ error: e.message }));
  },
};

export default Library;
