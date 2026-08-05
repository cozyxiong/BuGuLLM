import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";
import showToast from "@/utils/toast";

/** 附带 workspaceSlug，服务端会把文本结果写入 Library vault */
function withWorkspace(payload = {}, workspaceSlug) {
  if (!workspaceSlug) return payload;
  return { ...payload, workspaceSlug };
}

const DataConnector = {
  github: {
    branches: async ({ repo, accessToken }) => {
      return await fetch(`${API_BASE}/ext/github/branches`, {
        method: "POST",
        headers: baseHeaders(),
        cache: "force-cache",
        body: JSON.stringify({ repo, accessToken }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return res.data;
        })
        .then((data) => {
          return { branches: data?.branches || [], error: null };
        })
        .catch((e) => {
          console.error(e);
          showToast(e.message, "error");
          return { branches: [], error: e.message };
        });
    },
    collect: async function ({
      repo,
      accessToken,
      branch,
      ignorePaths = [],
      workspaceSlug,
    }) {
      return await fetch(`${API_BASE}/ext/github/repo`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(
          withWorkspace(
            { repo, accessToken, branch, ignorePaths },
            workspaceSlug
          )
        ),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },
  gitlab: {
    branches: async ({ repo, accessToken }) => {
      return await fetch(`${API_BASE}/ext/gitlab/branches`, {
        method: "POST",
        headers: baseHeaders(),
        cache: "force-cache",
        body: JSON.stringify({ repo, accessToken }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return res.data;
        })
        .then((data) => {
          return { branches: data?.branches || [], error: null };
        })
        .catch((e) => {
          console.error(e);
          showToast(e.message, "error");
          return { branches: [], error: e.message };
        });
    },
    collect: async function ({
      repo,
      accessToken,
      branch,
      ignorePaths = [],
      fetchIssues = false,
      fetchWikis = false,
      workspaceSlug,
    }) {
      return await fetch(`${API_BASE}/ext/gitlab/repo`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(
          withWorkspace(
            {
              repo,
              accessToken,
              branch,
              ignorePaths,
              fetchIssues,
              fetchWikis,
            },
            workspaceSlug
          )
        ),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },
  youtube: {
    transcribe: async ({ url, workspaceSlug }) => {
      return await fetch(`${API_BASE}/ext/youtube/transcript`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(withWorkspace({ url }, workspaceSlug)),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },
  websiteDepth: {
    scrape: async ({ url, depth, maxLinks, workspaceSlug }) => {
      return await fetch(`${API_BASE}/ext/website-depth`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(
          withWorkspace({ url, depth, maxLinks }, workspaceSlug)
        ),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },

  confluence: {
    collect: async function ({
      baseUrl,
      spaceKey,
      username,
      accessToken,
      cloud,
      personalAccessToken,
      bypassSSL,
      workspaceSlug,
    }) {
      return await fetch(`${API_BASE}/ext/confluence`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(
          withWorkspace(
            {
              baseUrl,
              spaceKey,
              username,
              accessToken,
              cloud,
              personalAccessToken,
              bypassSSL,
            },
            workspaceSlug
          )
        ),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },

  drupalwiki: {
    collect: async function ({ baseUrl, spaceIds, accessToken, workspaceSlug }) {
      return await fetch(`${API_BASE}/ext/drupalwiki`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(
          withWorkspace({ baseUrl, spaceIds, accessToken }, workspaceSlug)
        ),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },
  obsidian: {
    collect: async function ({ files, workspaceSlug }) {
      return await fetch(`${API_BASE}/ext/obsidian/vault`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(withWorkspace({ files }, workspaceSlug)),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },

  paperlessNgx: {
    collect: async function ({ baseUrl, apiToken, workspaceSlug }) {
      return await fetch(`${API_BASE}/ext/paperless-ngx`, {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify(
          withWorkspace({ baseUrl, apiToken }, workspaceSlug)
        ),
      })
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.reason);
          return { data: res.data, library: res.library, error: null };
        })
        .catch((e) => {
          console.error(e);
          return { data: null, library: null, error: e.message };
        });
    },
  },
};

export default DataConnector;
