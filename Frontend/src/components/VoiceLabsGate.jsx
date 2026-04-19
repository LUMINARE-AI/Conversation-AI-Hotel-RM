import { PrimaryButton } from "./UI";

/**
 * Shown when user navigates to Voice-Labs routes without authentication.
 */
export default function VoiceLabsGate({ setPage }) {
  return (
    <div className="animate-[fadeUp_0.4s_ease_both] relative min-h-[min(70vh,560px)] overflow-hidden rounded-3xl border border-slate-200/90 bg-slate-100/80 shadow-inner">
      <div
        className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%236366f1\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 backdrop-blur-[2px]" />

      <div className="relative flex min-h-[min(70vh,560px)] flex-col items-center justify-center px-6 py-16 text-center md:px-12">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-2 ring-indigo-100 shadow-lg shadow-indigo-100/50">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 md:text-[26px]">
          Login required to access Voice-Labs
        </h1>
        <p className="mt-3 max-w-md text-[14px] font-medium leading-relaxed text-slate-600">
          Voice agents, dashboards, and calling tools are available to approved team accounts. Sign in
          with credentials issued by your administrator.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <PrimaryButton type="button" onClick={() => setPage("login")} className="min-w-[180px]">
            Sign in
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setPage("home")}
            className="inline-flex min-w-[180px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
