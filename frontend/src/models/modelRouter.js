import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const ModelRouter = {
  getAll: async () => {
    return await fetch(`${API_BASE}/model-routers`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.routers || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },

  get: async (id) => {
    return await fetch(`${API_BASE}/model-routers/${id}`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { router: null, error: e.message };
      });
  },

  create: async (data) => {
    return await fetch(`${API_BASE}/model-routers/new`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { router: null, error: e.message };
      });
  },

  update: async (id, data) => {
    return await fetch(`${API_BASE}/model-routers/${id}`, {
      method: "PUT",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { router: null, error: e.message };
      });
  },

  delete: async (id) => {
    return await fetch(`${API_BASE}/model-routers/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  createRule: async (routerId, data) => {
    return await fetch(`${API_BASE}/model-routers/${routerId}/rules/new`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { rule: null, error: e.message };
      });
  },

  updateRule: async (routerId, ruleId, data) => {
    return await fetch(
      `${API_BASE}/model-routers/${routerId}/rules/${ruleId}`,
      {
        method: "PUT",
        headers: baseHeaders(),
        body: JSON.stringify(data),
      }
    )
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { rule: null, error: e.message };
      });
  },

  deleteRule: async (routerId, ruleId) => {
    return await fetch(
      `${API_BASE}/model-routers/${routerId}/rules/${ruleId}`,
      {
        method: "DELETE",
        headers: baseHeaders(),
      }
    )
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  workspaces: async (routerId) => {
    return await fetch(`${API_BASE}/model-routers/${routerId}/workspaces`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.workspaces || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },

  setWorkspaces: async (routerId, slugs) => {
    return await fetch(`${API_BASE}/model-routers/${routerId}/workspaces`, {
      method: "PUT",
      headers: baseHeaders(),
      body: JSON.stringify({ slugs }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            success: false,
            error: data?.error || `HTTP ${res.status}`,
            workspaces: [],
          };
        }
        return { success: true, ...data };
      })
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message, workspaces: [] };
      });
  },

  reorderRules: async (routerId, ruleUpdates) => {
    return await fetch(`${API_BASE}/model-routers/${routerId}/rules/reorder`, {
      method: "PUT",
      headers: baseHeaders(),
      body: JSON.stringify({ ruleUpdates }),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },
};

export default ModelRouter;
