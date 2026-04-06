// ─── Icons ───────────────────────────────────────────────────────────────────
export const Icon = ({ name, size = 18, className = "" }) => {
  const s = (children, extra = "") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${extra} ${className}`}>
      {children}
    </svg>
  );
  const icons = {
    dashboard: s(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>),
    customers: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
    phone:     s(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10.5 19.79 19.79 0 0 1 1.61 2 2 2 0 0 1 3.6.01h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.06 6.06l.93-.93a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>),
    reports:   s(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>),
    upload:    s(<><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>),
    edit:      s(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
    trash:     s(<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
    close:     s(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
    add:       s(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>),
    check:     s(<polyline points="20 6 9 17 4 12"/>),
    bell:      s(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>),
    search:    s(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>),
    loader:    s(<path d="M21 12a9 9 0 1 1-6.219-8.56"/>, "animate-spin"),
    settings:  s(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
    logout:    s(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>),
  };
  return icons[name] || null;
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const toastDot = { success: "bg-emerald-500", error: "bg-red-500", warn: "bg-amber-400" };

export function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-xl text-sm font-semibold text-slate-700 max-w-xs pointer-events-auto">
          <span className={`w-2 h-2 rounded-full shrink-0 ${toastDot[t.type] || "bg-slate-400"}`} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-[17px] font-bold text-slate-900">{title}</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <Icon name="close" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-[0.07em] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── inputCls — shared input Tailwind class string ───────────────────────────
export const inputCls =
  "w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-lg text-sm text-slate-900 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:bg-white placeholder:text-slate-400";

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeMap = {
  active:   "bg-emerald-100 text-emerald-700",
  inactive: "bg-red-100 text-red-600",
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-600",
  neutral:  "bg-slate-100 text-slate-500 border border-slate-200",
};

export function Badge({ value, type }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeMap[type] || badgeMap.neutral}`}>
      {value}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, accent, icon, delta }) {
  return (
    <div className="relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute top-0 left-0 right-0 h-0.75 rounded-t-2xl" style={{ background: accent }} />
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.07em]">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}22`, color: accent }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      <div className="text-[40px] font-extrabold text-slate-900 leading-none tracking-tight">{value}</div>
      {delta && <div className="text-xs text-slate-400 font-medium mt-1.5">{delta}</div>}
    </div>
  );
}

// ─── LoyaltyBar ──────────────────────────────────────────────────────────────
export function LoyaltyBar({ score }) {
  const color = score > 70 ? "#10b981" : score > 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 min-w-22.5">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-400 font-semibold font-mono w-6 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ─── PageHeader ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-7">
      <div>
        <h1 className="text-[26px] font-extrabold text-slate-900 tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm font-medium mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className = "", style }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}

// ─── PrimaryButton ────────────────────────────────────────────────────────────
const btnVariant = {
  primary:   "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-200/60 hover:-translate-y-0.5",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200",
  danger:    "bg-red-500 hover:bg-red-600 text-white hover:-translate-y-0.5",
};

export function PrimaryButton({ onClick, disabled, children, variant = "primary", className = "" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none! ${btnVariant[variant]} ${className}`}>
      {children}
    </button>
  );
}