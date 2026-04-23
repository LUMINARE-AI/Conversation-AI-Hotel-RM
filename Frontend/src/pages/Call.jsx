import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Icon, Field, PageHeader, Card, PrimaryButton, inputCls } from "../components/UI";

const LANGUAGES = [
  { value: "en", label: "🇬🇧 English" },
  { value: "hi", label: "🇮🇳 Hindi" },
  { value: "ta", label: "🇮🇳 Tamil" },
  { value: "te", label: "🇮🇳 Telugu" },
  { value: "ml", label: "🇮🇳 Malayalam" },
];

export default function Call({ addToast }) {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [language, setLanguage]     = useState("en");
  const [customPrompt, setCustomPrompt] = useState("");
  const [contextType, setContextType] = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);

  useEffect(() => {
    api.getCustomers().then((d) => setCustomers(d.customers || []));
  }, []);

  const handleCall = async () => {
    if (!customerId) return addToast("Please select a customer", "warn");
    setLoading(true);
    setResult(null);
    try {
      const res = await api.triggerCall(
        customerId,
        language,
        customPrompt,
        contextType || null,
        {}
      );
      setResult(res);
      addToast("Call initiated!", "success");
    } catch { addToast("Call failed. Check backend.", "error"); }
    setLoading(false);
  };

  const resultRows = result
    ? [["Customer", result.customer_name], ["Phone", result.phone], ["Call SID", result.call_sid], ["Offer", result.recommended_offer], ["Workflow", result.workflow]].filter(([, v]) => v)
    : [];

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader title="Call Trigger" subtitle="Initiate AI-powered outbound calls" />

      <div className="grid grid-cols-2 gap-6">

        {/* Config */}
        <Card>
          <div className="p-6">
            <h2 className="text-[15px] font-bold text-slate-900 mb-5">Configure Call</h2>

            <Field label="Select Customer">
              <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Choose a customer —</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </Field>

            <Field label="Language">
              <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>

            <Field label="Custom Prompt (optional)">
              <textarea
                className={`${inputCls} h-24 resize-y`}
                placeholder="Override the default AI prompt…"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </Field>

            <Field label="Context Type (optional)">
              <select
                className={inputCls}
                value={contextType}
                onChange={(e) => setContextType(e.target.value)}
              >
                <option value="">— Default (no context) —</option>
                <optgroup label="Hospital">
                  <option value="report_ready">report_ready</option>
                  <option value="follow_up_reminder">follow_up_reminder</option>
                  <option value="appointment_reminder">appointment_reminder</option>
                  <option value="billing_pending">billing_pending</option>
                </optgroup>
                <optgroup label="Hotel">
                  <option value="repeat_visit_trigger">repeat_visit_trigger</option>
                  <option value="seasonal_offer">seasonal_offer</option>
                  <option value="loyalty_offer">loyalty_offer</option>
                  <option value="abandoned_booking">abandoned_booking</option>
                </optgroup>
                <optgroup label="Campaign">
                  <option value="local_issue">local_issue</option>
                  <option value="scheme_awareness">scheme_awareness</option>
                  <option value="event_invite">event_invite</option>
                  <option value="voter_followup">voter_followup</option>
                </optgroup>
              </select>
            </Field>

            <PrimaryButton onClick={handleCall} disabled={loading} className="w-full mt-1">
              {loading
                ? <><Icon name="loader" size={15} /> Initiating…</>
                : <><Icon name="phone" size={15} /> Call Now</>
              }
            </PrimaryButton>
          </div>
        </Card>

        {/* Status */}
        <Card>
          <div className="p-6">
            <h2 className="text-[15px] font-bold text-slate-900 mb-5">Call Status</h2>

            {!result ? (
              <div className="flex flex-col items-center justify-center min-h-50 text-slate-300 text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                  <Icon name="phone" size={30} />
                </div>
                <p className="text-sm font-semibold text-slate-400">No active call</p>
                <p className="text-xs text-slate-300">Configure and trigger a call to see results here</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Success banner */}
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div className="text-emerald-500 flex items-center"><Icon name="check" size={18} /></div>
                  <div>
                    <div className="text-sm font-bold text-emerald-700">Call Initiated</div>
                    <div className="text-xs text-emerald-400">{result.status}</div>
                  </div>
                </div>

                {/* Result rows */}
                <div className="flex flex-col">
                  {resultRows.map(([k, v]) => (
                    <div key={k} className="flex justify-between items-start py-2.5 border-b border-slate-100 last:border-0">
                      <span className="text-xs font-semibold text-slate-400">{k}</span>
                      <span className="text-xs text-slate-700 font-mono text-right max-w-50 break-all">{v}</span>
                    </div>
                  ))}
                </div>

                {result.message && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-500 whitespace-pre-line">
                    {result.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}