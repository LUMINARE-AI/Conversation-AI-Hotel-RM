import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Field, Icon, inputCls, PrimaryButton } from "../components/UI";

export default function Login({ setPage, addToast, afterLoginPage = "dashboard" }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      addToast?.("Enter email and password.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      addToast?.("Welcome back", "success");
      setPage(afterLoginPage);
    } catch (err) {
      addToast?.(err.message || "Login failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-[fadeUp_0.35s_ease_both] mx-auto max-w-md">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-indigo-500 via-violet-500 to-indigo-500" />
        <div className="px-8 pb-10 pt-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 shadow-[0_6px_20px_rgba(99,102,241,0.4)]"
              aria-hidden
            >
              <Icon name="phone" size={22} className="text-white" />
            </div>
            <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900">Voice-Labs</h1>
            <p className="mt-2 text-[14px] font-medium text-slate-500">
              Sign in with your approved account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                className={inputCls}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete="current-password"
                className={inputCls}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <PrimaryButton type="submit" disabled={submitting} className="w-full py-3">
              {submitting ? "Signing in…" : "Sign in"}
            </PrimaryButton>
          </form>

          <p className="mt-6 text-center text-[12px] font-medium text-slate-400">
            No public signup — access is granted by an administrator.
          </p>

          <button
            type="button"
            onClick={() => setPage("home")}
            className="mt-4 w-full text-center text-[13px] font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
          >
            ← Back to site
          </button>
        </div>
      </div>
    </div>
  );
}
