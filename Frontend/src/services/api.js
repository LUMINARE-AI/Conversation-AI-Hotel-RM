// const BASE_URL = "https://backend.woolcrafts.in";
const BASE_URL = "http://localhost:8000";

export const api = {
  // =========================
  // 📊 CUSTOMERS
  // =========================

  // samvaad streaming endpoint
  getSamvaadStreamURL: () => {
    return `${BASE_URL}/api/v1/stream/web/ws`;
  },

  // Get all customers
  getCustomers: async () => {
    const res = await fetch(`${BASE_URL}/api/v1/customers`);
    return res.json();
  },

  // Get single customer
  getCustomer: async (id) => {
    const res = await fetch(`${BASE_URL}/api/v1/customers/${id}`);
    return res.json();
  },

  // Create customer
  createCustomer: async (data) => {
    const res = await fetch(`${BASE_URL}/api/v1/customers/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return res.json();
  },

  // Update customer
  updateCustomer: async (id, data) => {
    const res = await fetch(`${BASE_URL}/api/v1/customers/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return res.json();
  },

  // Delete customer
  deleteCustomer: async (id) => {
    const res = await fetch(`${BASE_URL}/api/v1/customers/${id}`, {
      method: "DELETE",
    });

    return res.json();
  },

  // Bulk upload (Excel)
  uploadCustomers: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/api/v1/customers/create-bulk`, {
      method: "POST",
      body: formData,
    });

    return res.json();
  },

  // =========================
  // 📞 CALLS
  // =========================

  // Trigger AI Call (LiveKit SIP)
  triggerCall: async (customerId, language = "en", customPrompt = "") => {
    const res = await fetch(
      `${BASE_URL}/api/v1/calls/test-livekit-sip`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          language,
          custom_prompt: customPrompt,
        }),
      }
    );

    return res.json();
  },

  // Normal call (Twilio)
  makeCall: async (customerId) => {
    const res = await fetch(`${BASE_URL}/api/v1/calls/make`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: customerId,
      }),
    });

    return res.json();
  },

  // Call history
  getCallHistory: async (customerId) => {
    const res = await fetch(
      `${BASE_URL}/api/v1/customers/${customerId}/call-history`
    );

    return res.json();
  },

  // Schedule calls
  scheduleCalls: async () => {
    const res = await fetch(`${BASE_URL}/api/v1/calls/schedule`, {
      method: "POST",
    });

    return res.json();
  },

  // =========================
  // 📈 ANALYTICS / METRICS
  // =========================

  // Dashboard metrics
  getMetrics: async () => {
    const res = await fetch(`${BASE_URL}/api/v1/metrics/summary`);
    return res.json();
  },

  // Customer analysis
  getCustomerAnalysis: async (customerId) => {
    const res = await fetch(
      `${BASE_URL}/api/v1/customers/${customerId}/analysis`
    );

    return res.json();
  },

  // =========================
  // 📄 REPORTS
  // =========================

  exportReports: async (type = "json", days = 30) => {
    const res = await fetch(
      `${BASE_URL}/api/v1/reports/export?report_type=${type}&days=${days}`
    );

    return res.json();
  },

  // =========================
  // 🛠 ADMIN
  // =========================

  // Re-generate dummy data
  initDummyData: async () => {
    const res = await fetch(`${BASE_URL}/api/v1/init/dummy-data`, {
      method: "POST",
    });

    return res.json();
  },
};

