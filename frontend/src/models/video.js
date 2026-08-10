import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Video = {
  extract: async function (slug, url) {
    return await fetch(`${API_BASE}/video/${slug}/extract`, {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: baseHeaders(),
    }).then((r) => {
      if (!r.ok) return r.json().catch(() => ({ error: `请求失败 (${r.status})` }));
      return r.json();
    }).catch((e) => ({ error: e.message }));
  },
};

export default Video;
