import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Icon, Field, Badge, PageHeader, Card, PrimaryButton, inputCls } from "../components/UI";

export default function Reports({ addToast }) {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [calls, setCalls]         = useState([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    api.getCustomers().then((d) => setCustomers(d.customers || []));
  }, []);

  const fetchCalls = async () => {
    if (!customerId) return addToast("Select a customer first", "warn");
    setLoading(true);
    try {
      const res = await api.getCallHistory(customerId);
      setCalls(res.calls || []);
      if (!res.calls?.length) addToast("No call history found", "warn");
    } catch { addToast("Failed to fetch call history", "error"); }
    setLoading(false);
  };

  const sentimentType = (s) => s === "positive" ? "positive" : s === "negative" ? "negative" : "neutral";

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader title="Reports" subtitle="Call history & sentiment analysis" />

      {/* Filter bar */}
      <Card className="mb-6">
        <div className="flex items-end gap-4 p-5">
          <div className="flex-1">
            <Field label="Select Customer">
              <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Choose a customer —</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.name} ({c.customer_id})</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="pb-4">
            <PrimaryButton onClick={fetchCalls} disabled={loading}>
              {loading ? <><Icon name="loader" size={15} /> Loading…</> : <><Icon name="reports" size={15} /> Fetch History</>}
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-300">
          <Icon name="loader" size={28} />
        </div>
      )}

      {/* Empty */}
      {!loading && calls.length === 0 && customerId && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
          <Icon name="phone" size={32} />
          <p className="text-sm text-slate-400">No call history found for this customer.</p>
        </div>
      )}

      {/* Call list */}
      {calls.length > 0 && (
        <div className="flex flex-col gap-4">
          {calls.map((call, i) => (
            <Card key={i}>
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <Icon name="phone" size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">Call #{call.id}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {call.call_date ? new Date(call.call_date).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge value={call.status || "—"} type="neutral" />
                    {call.sentiment && <Badge value={call.sentiment} type={sentimentType(call.sentiment)} />}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex gap-6 text-[13px] text-slate-500">
                  <span><strong className="text-slate-700">Duration:</strong> {call.duration || 0}s</span>
                  {call.transcript && (
                    <span className="truncate"><strong className="text-slate-700">Preview:</strong> {call.transcript}</span>
                  )}
                </div>

                {call.recording_url && (
                  <audio controls className="w-full h-9 mt-3">
                    <source src={call.recording_url} type="audio/wav" />
                  </audio>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}