import { useState } from "react";
import { PageHeader, Card, Field, Icon, inputCls, PrimaryButton } from "../components/UI";

const CONTACT_EMAIL = "hello@luminare.ai";
const LOCATION = "India";

const textareaCls = `${inputCls} min-h-[140px] resize-y`;

export default function ContactUs({ addToast }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      addToast?.("Please fill in name, email, and message.", "error");
      return;
    }
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      addToast?.("Thanks — we'll get back to you soon.", "success");
      setName("");
      setEmail("");
      setMessage("");
    }, 600);
  }

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader
        title="Contact Us"
        subtitle="LuminareAI — we'd love to hear from you"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <Card>
            <div className="border-b border-slate-100 px-6 py-5 md:px-8">
              <h2 className="text-[15px] font-bold text-slate-900">Send a message</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">
                Share a few details and we’ll reply by email.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 lg:p-9">
              <Field label="Name">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Message">
                <textarea
                  className={textareaCls}
                  placeholder="How can we help?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                />
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <PrimaryButton type="submit" disabled={sending}>
                  {sending ? "Sending…" : "Send message"}
                </PrimaryButton>
                <span className="text-[12px] font-medium text-slate-400">
                  This is a demo — no data is sent to a server yet.
                </span>
              </div>
            </form>
          </Card>
        </div>

        <aside className="flex flex-col gap-5 lg:col-span-5">
          <Card>
            <div className="p-6 md:p-7">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Direct
              </h2>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-3 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
                  <Icon name="mail" size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</p>
                  <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{CONTACT_EMAIL}</p>
                </div>
              </a>

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                  <Icon name="customers" size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Location</p>
                  <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{LOCATION}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6 md:p-7">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Response time
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
                We typically respond within one to two business days. For urgent production issues,
                mention your environment and priority in the message.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
