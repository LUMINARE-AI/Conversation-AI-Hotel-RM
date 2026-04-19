import { useState } from "react";
import { authApi } from "../../services/api";
import { Card, Field, inputCls, PrimaryButton } from "../UI";

export default function CreateUserForm({ addToast, onCreated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      addToast?.("Enter email and password.", "error");
      return;
    }
    if (password.length < 8) {
      addToast?.("Password must be at least 8 characters.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.createUser({
        email: email.trim(),
        password,
        role,
      });
      addToast?.("User created", "success");
      setEmail("");
      setPassword("");
      setRole("user");
      onCreated?.();
    } catch (err) {
      addToast?.(err.message || "Could not create user", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-7">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-bold text-slate-900">Create user</h2>
        <p className="mt-0.5 text-[13px] font-medium text-slate-400">
          New accounts appear in the list below immediately.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Field label="Email">
            <input
              type="email"
              autoComplete="off"
              className={inputCls}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <select
              className={inputCls}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-1">
            <PrimaryButton type="submit" disabled={submitting} className="w-full py-2.5 sm:w-auto">
              {submitting ? "Creating…" : "Create user"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </Card>
  );
}
