/**
 * API client for FastAPI backend.
 * Uses credentials: "include" for JWT httpOnly cookies.
 * In dev, Vite proxies /api → http://localhost:8000 (see vite.config.js).
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "" : "http://localhost:8000");

function authErrorMessage(data) {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d[0]?.msg || "Request failed";
  if (d && typeof d === "object") return JSON.stringify(d);
  return "Request failed";
}

export function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = { ...options.headers };
  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"] &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });
}

export const authApi = {
  me: async () => {
    const res = await apiFetch("/api/auth/me");
    return res.json();
  },
  login: async (email, password) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = data.detail;
      const msg =
        typeof d === "string"
          ? d
          : Array.isArray(d)
            ? d[0]?.msg || "Login failed"
            : "Login failed";
      throw new Error(msg);
    }
    return data;
  },
  logout: async () => {
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    return res.json();
  },
  createUser: async (payload) => {
    const res = await apiFetch("/api/auth/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(authErrorMessage(data));
    return data;
  },

  listUsers: async () => {
    const res = await apiFetch("/api/auth/users");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(authErrorMessage(data));
    return data;
  },

  deleteUser: async (userId) => {
    const res = await apiFetch(`/api/auth/users/${userId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(authErrorMessage(data));
    return data;
  },

  patchUserRole: async (userId, role) => {
    const res = await apiFetch(`/api/auth/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(authErrorMessage(data));
    return data;
  },
};

export const api = {
  getSamvaadStreamURL: () => {
    if (typeof window !== "undefined" && !import.meta.env.VITE_API_BASE) {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.host}/api/v1/stream/web/ws`;
    }
    const httpBase = API_BASE || `${window.location.protocol}//${window.location.host}`;
    const wsBase = httpBase.replace(/^http/, "ws");
    return `${wsBase}/api/v1/stream/web/ws`;
  },

  getCustomers: async () => {
    const res = await apiFetch("/api/v1/customers");
    return res.json();
  },

  getCustomer: async (id) => {
    const res = await apiFetch(`/api/v1/customers/${id}`);
    return res.json();
  },

  createCustomer: async (data) => {
    const res = await apiFetch("/api/v1/customers/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateCustomer: async (id, data) => {
    const res = await apiFetch(`/api/v1/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteCustomer: async (id) => {
    const res = await apiFetch(`/api/v1/customers/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },

  uploadCustomers: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiFetch("/api/v1/customers/create-bulk", {
      method: "POST",
      body: formData,
    });
    return res.json();
  },

  triggerCall: async (
    customerId,
    language = "en",
    customPrompt = "",
    contextType = null,
    contextData = {}
  ) => {
    const res = await apiFetch("/api/v1/calls/test-livekit-sip", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        language,
        custom_prompt: customPrompt,
        context_type: contextType,
        context_data: contextData,
      }),
    });
    return res.json();
  },

  makeCall: async (customerId) => {
    const res = await apiFetch("/api/v1/calls/make", {
      method: "POST",
      body: JSON.stringify({ customer_id: customerId }),
    });
    return res.json();
  },

  getCallHistory: async (customerId) => {
    const res = await apiFetch(`/api/v1/customers/${customerId}/call-history`);
    return res.json();
  },

  scheduleCalls: async () => {
    const res = await apiFetch("/api/v1/calls/schedule", {
      method: "POST",
    });
    return res.json();
  },

  getMetrics: async () => {
    const res = await apiFetch("/api/v1/metrics/summary");
    return res.json();
  },

  getCustomerAnalysis: async (customerId) => {
    const res = await apiFetch(`/api/v1/customers/${customerId}/analysis`);
    return res.json();
  },

  exportReports: async (type = "json", days = 30) => {
    const res = await apiFetch(
      `/api/v1/reports/export?report_type=${type}&days=${days}`
    );
    return res.json();
  },

  initDummyData: async () => {
    const res = await apiFetch("/api/v1/init/dummy-data", {
      method: "POST",
    });
    return res.json();
  },
};
