import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

async function post(slug, path, body) {
  return await fetch(`${API_BASE}/generate/${slug}/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: baseHeaders(),
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `请求失败 ${r.status}`);
      return data;
    })
    .catch((e) => ({ error: e.message }));
}

const Generate = {
  generateMindmap: async function (
    slug,
    { filePaths, filePath, fileId, save = true } = {}
  ) {
    return post(slug, "mindmap", {
      filePaths: filePaths || (filePath ? [filePath] : []),
      filePath,
      fileId,
      save,
    });
  },

  generateFlashcards: async function (
    slug,
    { filePaths, filePath, fileId, count = 12, save = true } = {}
  ) {
    const n = Math.max(1, Math.min(50, Number(count) || 12));
    return post(slug, "flashcards", {
      filePaths: filePaths || (filePath ? [filePath] : []),
      filePath,
      fileId,
      count: n,
      save,
    });
  },

  generateQuiz: async function (
    slug,
    {
      filePaths,
      filePath,
      fileId,
      count = 10,
      type = "single",
      save = true,
    } = {}
  ) {
    const n = Math.max(1, Math.min(30, Number(count) || 10));
    return post(slug, "quiz", {
      filePaths: filePaths || (filePath ? [filePath] : []),
      filePath,
      fileId,
      count: n,
      type,
      save,
    });
  },
};

export default Generate;
