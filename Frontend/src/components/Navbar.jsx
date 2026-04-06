import { Icon } from "./UI";
import { NAV } from "../constants";

export default function Navbar({ page, setPage }) {
  return (
    /* Outer bar — full-width slate bg so breadcrumb strip below aligns */
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-100 px-6 pt-3">

      {/* Floating pill */}
      <div
        className="mx-auto max-w-310 h-18.5 bg-white rounded-4xl border border-slate-200/80 flex items-center justify-between px-5"
        style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}
      >

        {/* Brand — loud */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 flex items-center justify-center"
            style={{ boxShadow: "0 4px 10px rgba(99,102,241,0.35)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-[21px] font-black text-slate-900 tracking-tight leading-none select-none">
            LuminareAI
          </span>
        </div>

        {/* Nav links — absolute center */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`px-4 py-2 rounded-xl text-[12.5px] font-semibold tracking-widest uppercase transition-all duration-150 cursor-pointer border-none
                ${page === n.id
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-slate-500 bg-transparent hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="relative w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 flex items-center justify-center transition-colors">
            <Icon name="bell" size={16} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 border-2 border-white" />
          </button>
          <button
            className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-[13px] font-semibold tracking-wide transition-colors"
            onClick={() => setPage("call")}
          >
            + New Call
          </button>
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer select-none"
            style={{ boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
            A
          </div>
        </div>

      </div>
    </header>
  );
}