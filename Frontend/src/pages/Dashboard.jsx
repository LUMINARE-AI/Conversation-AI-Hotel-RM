import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Icon, StatCard, Badge, LoyaltyBar, PageHeader, Card } from "../components/UI";

export default function Dashboard({ addToast }) {
  const [metrics, setMetrics] = useState({ total_customers: 0, active_customers: 0, total_calls: 0 });
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMetrics(),
      api.getCustomers(),
    ])
      .then(([m, c]) => { setMetrics(m); setCustomers(c.customers || []); })
      .catch(() => addToast("Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, [addToast]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader title="Overview" subtitle="LuminareAI Dashboard" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-7">
        <StatCard label="Total Customers" value={metrics.total_customers} accent="#6366f1" icon="customers" delta="All time" />
        <StatCard label="Active Customers" value={metrics.active_customers} accent="#10b981" icon="check" delta="Currently active" />
        <StatCard label="Total Calls" value={metrics.total_calls} accent="#f59e0b" icon="phone" delta="All campaigns" />
      </div>

      {/* Table card */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-[15px] font-bold text-slate-900">Recent Customers</h2>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none flex items-center">
              <Icon name="search" size={14} />
            </span>
            <input
              className="pl-8 pr-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-52 transition-all"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-300">
            <Icon name="loader" size={28} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {["Name", "Email", "Phone", "Visits", "Loyalty", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.07em] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 10).map((c) => (
                  <tr key={c.customer_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 text-sm">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-[13px]">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-[13px] font-mono">{c.phone}</td>
                    <td className="px-4 py-3 text-slate-900 text-sm text-center">{c.total_visits}</td>
                    <td className="px-4 py-3"><LoyaltyBar score={c.loyalty_score} /></td>
                    <td className="px-4 py-3">
                      <Badge value={c.is_active ? "Active" : "Inactive"} type={c.is_active ? "active" : "inactive"} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">No customers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}