import { PageHeader, Card, Icon } from "../components/UI";

const PILLARS = [
  {
    title: "Voice-first workflows",
    body:
      "We design conversational experiences that feel natural on the phone — clear prompts, reliable handoffs, and measurable outcomes for your team.",
    icon: "phone",
    accent: "#6366f1",
  },
  {
    title: "Web & product craft",
    body:
      "From marketing sites to full-stack apps, we ship interfaces that match your brand: fast, accessible, and built to scale with your business.",
    icon: "layout",
    accent: "#8b5cf6",
  },
  {
    title: "Quality & trust",
    body:
      "Security, observability, and iteration are part of the default — not an afterthought — so you can roll out with confidence.",
    icon: "check",
    accent: "#10b981",
  },
];

export default function AboutUs() {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader
        title="About Us"
        subtitle="LuminareAI — conversation intelligence for hospitality"
      />

      <div className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br from-white via-indigo-50/35 to-violet-50/40 p-8 shadow-[0_2px_20px_rgba(99,102,241,0.07)] md:p-10">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl"
          aria-hidden
        />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">
          Our story
        </p>
        <h2 className="mt-2 text-[22px] font-extrabold tracking-tight text-slate-900 md:text-[24px]">
          Building calm, capable AI for real teams
        </h2>
        <p className="mt-4 max-w-3xl text-[15px] font-medium leading-relaxed text-slate-600">
          LuminareAI exists to help hotels and service businesses run better conversations — outbound
          campaigns, inbound support, and the tools that tie them together. We combine pragmatic
          engineering with thoughtful design so your guests and staff stay front and center.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {PILLARS.map((p) => (
          <Card key={p.title}>
            <div className="p-6 md:p-7">
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${p.accent}18`, color: p.accent }}
              >
                <Icon name={p.icon} size={20} />
              </div>
              <h3 className="text-[16px] font-bold tracking-tight text-slate-900">{p.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{p.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-slate-100 px-6 py-5 md:px-8">
          <h2 className="text-[15px] font-bold text-slate-900">How we work</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">
            A straightforward partnership, from discovery to launch
          </p>
        </div>
        <div className="space-y-0 divide-y divide-slate-100">
          {[
            {
              step: "01",
              label: "Discover",
              text: "We align on goals, channels, and success metrics — so every build maps to outcomes you care about.",
            },
            {
              step: "02",
              label: "Design & build",
              text: "We iterate on flows, copy, and integrations with your team, keeping feedback loops tight.",
            },
            {
              step: "03",
              label: "Launch & improve",
              text: "We ship, monitor, and refine — so performance and guest experience keep getting better over time.",
            },
          ].map((row) => (
            <div key={row.step} className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-start md:gap-8 md:px-8 md:py-6">
              <span className="shrink-0 font-mono text-[12px] font-bold text-indigo-500">{row.step}</span>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900">{row.label}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">{row.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
