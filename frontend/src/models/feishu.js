import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Feishu = {
  // OAuth
  getAuthUrl: async function (slug) {
    return await fetch(`${API_BASE}/feishu/auth-url`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message }));
  },
  getAuthStatus: async function (slug) {
    return await fetch(`${API_BASE}/feishu/auth-status`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message }));
  },

  /** 单文档导入 → Vault/FeiShu/*.md */
  create: async function (slug, { url, title }) {
    return await fetch(`${API_BASE}/feishu/${slug}/docs`, {
      method: "POST",
      body: JSON.stringify({ url, title }),
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message }));
  },

  /** 知识库批量导入 → Vault/FeiShu/<kb>/ */
  importKB: async function (slug, url) {
    return await fetch(`${API_BASE}/feishu/${slug}/import-kb`, {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: baseHeaders(),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message }));
  },
};

export default Feishu;
