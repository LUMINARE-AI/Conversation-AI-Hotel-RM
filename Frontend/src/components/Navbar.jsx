import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./UI";
import { SITE_NAV, VOICE_LABS_NAV, VOICE_LABS_PAGE_IDS } from "../constants";

const HOME_NAV_ITEM = SITE_NAV.find((n) => n.id === "home");
const SITE_NAV_WITHOUT_HOME = SITE_NAV.filter((n) => n.id !== "home");

const navBtnBase =
  "px-4 py-2 rounded-xl text-[12.5px] font-semibold tracking-widest uppercase transition-all duration-150 cursor-pointer border-none";

function navBtnClass(active) {
  return `${navBtnBase} ${
    active
      ? "text-indigo-600 bg-indigo-50"
      : "text-slate-500 bg-transparent hover:text-slate-900 hover:bg-slate-100"
  }`;
}

function dropdownItemClass(active) {
  return `group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold tracking-wide transition-all duration-150 cursor-pointer border-none ${
    active
      ? "bg-indigo-50 text-indigo-600"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

/** First letter for avatar — updates with logged-in user email. */
function userInitial(user) {
  const e = user?.email?.trim();
  if (!e) return "?";
  return e.charAt(0).toUpperCase();
}

const ctaDark =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 text-[12px] font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-slate-800";

export default function Navbar({ page, setPage, user = null, onLogout }) {
  const voiceLabsActive = VOICE_LABS_PAGE_IDS.includes(page);
  const [voiceLabsOpen, setVoiceLabsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  const go = useCallback(
    (id) => {
      setPage(id);
      setVoiceLabsOpen(false);
      setMobileOpen(false);
    },
    [setPage]
  );

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!dropdownRef.current?.contains(e.target)) setVoiceLabsOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setVoiceLabsOpen(false);
        setMobileOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-100 px-6 pt-3">
      <div
        className="mx-auto flex h-18.5 max-w-310 items-center gap-3 rounded-4xl border border-slate-200/80 bg-white px-4 sm:px-5"
        style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}
      >
        {/* Brand */}
        <button
          type="button"
          onClick={() => go("home")}
          className="flex shrink-0 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left transition-opacity hover:opacity-90"
          aria-label="Go to home"
        >
          <div
            className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 flex items-center justify-center"
            style={{ boxShadow: "0 4px 10px rgba(99,102,241,0.35)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-[21px] font-black text-slate-900 tracking-tight leading-none select-none">
            LuminareAI
          </span>
        </button>

        {/* Desktop nav — flex center column so it never overlaps left/right */}
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
          aria-label="Main"
        >
          {HOME_NAV_ITEM && (
            <button
              type="button"
              onClick={() => go("home")}
              className={navBtnClass(page === "home")}
            >
              {HOME_NAV_ITEM.label}
            </button>
          )}
          <div className="relative" ref={dropdownRef}>
            <button
              ref={triggerRef}
              type="button"
              id={`${menuId}-trigger`}
              aria-haspopup="true"
              aria-expanded={voiceLabsOpen}
              aria-controls={voiceLabsOpen ? `${menuId}-menu` : undefined}
              onClick={() => setVoiceLabsOpen((o) => !o)}
              className={`${navBtnClass(voiceLabsActive)} inline-flex items-center gap-1.5`}
            >
              Voice-Labs
              <span
                className={`inline-flex transition-transform duration-200 ${voiceLabsOpen ? "rotate-180" : ""}`}
                aria-hidden
              >
                <Icon name="chevronDown" size={14} className="text-slate-400" />
              </span>
            </button>

            <div
              id={`${menuId}-menu`}
              role="menu"
              aria-labelledby={`${menuId}-trigger`}
              className={`absolute left-0 top-full z-50 mt-1.5 min-w-[min(100vw-3rem,16.5rem)] rounded-2xl border border-slate-200/80 bg-white/90 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-all duration-200 ease-out origin-top ${
                voiceLabsOpen
                  ? "visible scale-100 opacity-100 translate-y-0"
                  : "invisible pointer-events-none scale-95 opacity-0 -translate-y-1"
              }`}
              style={{ boxShadow: "0 12px 40px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)" }}
            >
              {VOICE_LABS_NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => go(n.id)}
                  className={dropdownItemClass(page === n.id)}
                >
                  <span className="text-slate-400 transition-colors group-hover:text-indigo-500">
                    <Icon name={n.icon} size={16} />
                  </span>
                  <span className="uppercase tracking-widest text-[11px] font-semibold">{n.label}</span>
                </button>
              ))}
            </div>
          </div>

          {SITE_NAV_WITHOUT_HOME.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              className={navBtnClass(page === n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        {/* Right CTAs — shrink-0; email shown only as avatar initial + tooltip */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          {!user && (
            <button type="button" onClick={() => go("login")} className={`${ctaDark} hidden sm:inline-flex`}>
              Sign in
            </button>
          )}
          {user && (
            <>
              {user.role === "admin" && (
                <button
                  type="button"
                  onClick={() => go("admin")}
                  className={`hidden shrink-0 sm:inline-flex ${navBtnClass(page === "admin")}`}
                >
                  Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onLogout?.();
                  go("home");
                }}
                className={`${ctaDark} hidden sm:inline-flex`}
              >
                Log out
              </button>
            </>
          )}
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls={`${menuId}-mobile`}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={18} />
          </button>
          {user && (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-sm font-bold uppercase text-white select-none"
              style={{ boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}
              title={user.email || "Signed in"}
              aria-label={user.email ? `Signed in as ${user.email}` : "Account"}
            >
              {userInitial(user)}
            </div>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        id={`${menuId}-mobile`}
        className={`lg:hidden mx-auto max-w-310 overflow-hidden transition-all duration-300 ease-out ${
          mobileOpen ? "max-h-[85vh] opacity-100 mt-3 pb-2" : "max-h-0 opacity-0 mt-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="rounded-3xl border border-slate-200/80 bg-white/95 p-3 shadow-xl backdrop-blur-md"
          style={{ boxShadow: "0 12px 40px rgba(15,23,42,0.1)" }}
        >
          {HOME_NAV_ITEM && (
            <button
              type="button"
              onClick={() => go("home")}
              className={`mb-3 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold tracking-widest uppercase transition-all duration-150 ${
                page === "home"
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="text-slate-400">
                <Icon name={HOME_NAV_ITEM.icon} size={16} />
              </span>
              {HOME_NAV_ITEM.label}
            </button>
          )}
          <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Voice-Labs
          </p>
          <div className="mb-3 space-y-0.5 border-b border-slate-100 pb-3">
            {VOICE_LABS_NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className={`${dropdownItemClass(page === n.id)} uppercase tracking-widest text-[11px]`}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
              </button>
            ))}
          </div>
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Site</p>
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => go("admin")}
              className={`mb-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold tracking-widest uppercase transition-all duration-150 ${
                page === "admin"
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="text-slate-400">
                <Icon name="settings" size={16} />
              </span>
              Admin
            </button>
          )}
          <div className="space-y-0.5">
            {SITE_NAV_WITHOUT_HOME.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold tracking-widest uppercase transition-all duration-150 ${
                  page === n.id
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="text-slate-400">
                  <Icon name={n.icon} size={16} />
                </span>
                {n.label}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 sm:hidden">
            {!user ? (
              <button type="button" className={`${ctaDark} w-full`} onClick={() => go("login")}>
                Sign in
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {user.role === "admin" && (
                  <button
                    type="button"
                    className={`w-full ${navBtnClass(page === "admin")}`}
                    onClick={() => go("admin")}
                  >
                    Admin
                  </button>
                )}
                <button
                  type="button"
                  className={`${ctaDark} w-full`}
                  onClick={() => {
                    onLogout?.();
                    go("home");
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
