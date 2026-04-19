import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { Icon, Card, PrimaryButton } from "../UI";
import { WEB_PROJECTS } from "../../data/webProjects";
import {
  ProjectVideoPreview,
  VideoLightbox,
  usePrefersReducedMotion,
  useFinePointerHover,
  pauseAllPreviewVideos,
} from "../WebProjectsShowcase";

const FEATURED = WEB_PROJECTS.slice(0, 3);

const WHAT_WE_DO = [
  {
    title: "AI voice agents",
    body:
      "Design and ship conversational flows for outbound campaigns, inbound support, and handoffs that feel human — with metrics you can trust.",
    icon: "phone",
    accent: "#6366f1",
  },
  {
    title: "Full-stack development",
    body:
      "End-to-end web apps: APIs, auth, payments, admin panels, and deployments — production-minded from day one.",
    icon: "layout",
    accent: "#8b5cf6",
  },
  {
    title: "Creative UI / UX",
    body:
      "Interfaces that match your brand: motion, accessibility, and performance so first impressions convert to retained users.",
    icon: "dashboard",
    accent: "#10b981",
  },
];

const WHY_POINTS = [
  {
    title: "Production-grade delivery",
    text: "Shipped real products with payments, logistics, 3D pipelines, and voice infra — not just demos.",
  },
  {
    title: "AI + full stack together",
    text: "Bridge models, telephony, and web apps in one coherent stack clients can actually run.",
  },
  {
    title: "Performance & SEO",
    text: "Fast loads, clean structure, and measurable funnels — especially on marketing and lead sites.",
  },
  {
    title: "Problem-first mindset",
    text: "Clarify outcomes early, iterate with your team, and document what matters for handoff.",
  },
];

function WaveformDemo() {
  const heightsPx = [14, 24, 18, 32, 22, 28, 16, 36, 20];
  return (
    <div
      className="flex h-16 items-end justify-center gap-1.5 rounded-2xl border border-indigo-100/80 bg-indigo-50/50 px-5 py-3"
      aria-hidden
    >
      {heightsPx.map((h, i) => (
        <span
          key={i}
          className="home-wave-bar w-1.5 rounded-full bg-linear-to-t from-indigo-600 to-violet-500"
          style={{
            height: h,
            animationDelay: `${i * 0.09}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function HomePage({ setPage }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canHoverPlay = useFinePointerHover();
  const [lightbox, setLightbox] = useState(null);

  const openModal = useCallback((project) => {
    pauseAllPreviewVideos();
    setLightbox(project);
  }, []);

  const closeModal = useCallback(() => setLightbox(null), []);

  const go = useCallback((id) => () => setPage(id), [setPage]);

  return (
    <div className="w-full space-y-16 pb-4 md:space-y-20 md:pb-6">
      {/* Hero */}
      <section
        className="animate-[fadeUp_0.55s_ease_both] relative overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br from-slate-950 via-indigo-950 to-violet-950 px-6 py-14 text-center shadow-[0_24px_60px_rgba(79,70,229,0.25)] md:px-12 md:py-20"
        aria-labelledby="home-hero-title"
      >
        <div
          className="hero-orb pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/35 blur-3xl"
          aria-hidden
        />
        <div
          className="hero-orb hero-orb-delay pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-8 h-px w-[min(90%,480px)] -translate-x-1/2 bg-linear-to-r from-transparent via-white/25 to-transparent"
          aria-hidden
        />

        <p className="relative text-[11px] font-bold uppercase tracking-[0.28em] text-indigo-200/90">
          LuminareAI · Portfolio & product lab
        </p>
        <h1
          id="home-hero-title"
          className="relative mt-4 text-[30px] font-extrabold leading-[1.12] tracking-tight text-white md:text-[42px] lg:text-[46px]"
        >
          Voice AI & full-stack products
          <span className="block bg-linear-to-r from-white to-indigo-200 bg-clip-text text-transparent">
            built to ship and scale.
          </span>
        </h1>
        <p className="relative mx-auto mt-5 max-w-2xl text-[15px] font-medium leading-relaxed text-slate-300 md:text-lg">
          I design and engineer conversational agents, modern web apps, and polished interfaces — so
          clients, recruiters, and founders see serious execution, not slides.
        </p>

        <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={go("web-projects")}
            className="inline-flex min-w-[200px] items-center justify-center rounded-xl bg-white px-7 py-3.5 text-[14px] font-bold text-slate-900 shadow-lg shadow-indigo-900/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-xl"
          >
            View projects
          </button>
          <button
            type="button"
            onClick={go("contact")}
            className="inline-flex min-w-[200px] items-center justify-center rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 text-[14px] font-bold text-white backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-white/10"
          >
            Contact me
          </button>
        </div>
      </section>

      {/* What we do */}
      <section className="scroll-mt-28" id="what-we-do" aria-labelledby="home-what-title">
        <div className="mb-8 text-center md:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">What we do</p>
          <h2
            id="home-what-title"
            className="mt-2 text-[24px] font-extrabold tracking-tight text-slate-900 md:text-[28px]"
          >
            One partner for voice, web, and experience
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[14px] font-medium text-slate-500 md:text-[15px]">
            From AI calling stacks to customer-facing apps — aligned with your brand and ready for real
            traffic.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {WHAT_WE_DO.map((item) => (
            <Card key={item.title}>
              <div className="p-6 md:p-7">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: `${item.accent}18`, color: item.accent }}
                >
                  <Icon name={item.icon} size={22} />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{item.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured projects */}
      <section className="scroll-mt-28" id="featured" aria-labelledby="home-featured-title">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:mb-10 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Featured work
            </p>
            <h2
              id="home-featured-title"
              className="mt-2 text-[24px] font-extrabold tracking-tight text-slate-900 md:text-[28px]"
            >
              Flagship builds
            </h2>
            <p className="mt-2 max-w-xl text-[14px] font-medium text-slate-500">
              A snapshot of production work — hover videos on desktop, tap for fullscreen on mobile.
            </p>
          </div>
          <button
            type="button"
            onClick={go("web-projects")}
            className="text-[13px] font-bold text-indigo-600 underline-offset-4 transition-colors hover:text-indigo-800 hover:underline"
          >
            See all web projects →
          </button>
        </div>

        <div className="flex flex-col gap-10 lg:gap-12">
          {FEATURED.map((project) => (
            <article
              key={project.id}
              className={`group/card overflow-hidden rounded-3xl border border-slate-100/90 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-500 ${project.ring} ${project.glow} hover:-translate-y-1 hover:shadow-2xl`}
            >
              <div
                className={`pointer-events-none h-1.5 bg-linear-to-r ${project.gradient}`}
                aria-hidden
              />
              <div className="p-6 md:flex md:gap-10 md:p-8">
                <div className="mb-6 min-w-0 flex-1 md:mb-0">
                  <h3 className="text-[20px] font-extrabold tracking-tight text-slate-900 md:text-[22px]">
                    {project.title}
                  </h3>
                  {project.subtitle && (
                    <p className="mt-1 text-[14px] font-semibold text-violet-700">{project.subtitle}</p>
                  )}
                  {project.typeLabel && (
                    <span className="mt-2 inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {project.typeLabel}
                    </span>
                  )}
                  <p className="mt-3 text-[14px] font-semibold text-indigo-600">{project.tagline}</p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">{project.description}</p>
                </div>
                <div className="w-full shrink-0 md:max-w-md lg:max-w-lg">
                  <ProjectVideoPreview
                    project={project}
                    onOpen={openModal}
                    prefersReducedMotion={prefersReducedMotion}
                    canHoverPlay={canHoverPlay}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Why choose me */}
      <section className="scroll-mt-28" id="why-me" aria-labelledby="home-why-title">
        <div className="mb-8 text-center md:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">Why work with me</p>
          <h2
            id="home-why-title"
            className="mt-2 text-[24px] font-extrabold tracking-tight text-slate-900 md:text-[28px]"
          >
            Built for clients who care about outcomes
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
          {WHY_POINTS.map((p) => (
            <Card key={p.title}>
              <div className="flex gap-4 p-5 md:p-6">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                </span>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">{p.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{p.text}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Voice-Labs preview */}
      <section
        className="scroll-mt-28 overflow-hidden rounded-3xl border border-indigo-200/60 bg-linear-to-br from-white via-indigo-50/50 to-violet-50/40 shadow-[0_12px_40px_rgba(99,102,241,0.1)]"
        aria-labelledby="home-voice-title"
      >
        <div className="grid grid-cols-1 gap-8 p-8 md:grid-cols-2 md:gap-12 md:p-10 lg:p-12">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">Voice-Labs</p>
            <h2
              id="home-voice-title"
              className="mt-2 text-[22px] font-extrabold tracking-tight text-slate-900 md:text-[26px]"
            >
              AI voice agents for real calling workflows
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-600 md:text-[15px]">
              Explore dashboards, triggers, reports, and conversational tools — the same stack used to
              prototype and run voice experiences end to end.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryButton type="button" onClick={go("dashboard")}>
                Open Voice-Labs
              </PrimaryButton>
              <PrimaryButton type="button" variant="secondary" onClick={go("samvaad")}>
                Try Samvaad
              </PrimaryButton>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Live activity (illustrative)
            </p>
            <WaveformDemo />
            <p className="mt-4 text-center text-[12px] font-medium text-slate-500">
              Waveform animation suggests real-time audio — dive into Voice-Labs for full flows.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="scroll-mt-28 overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900 px-6 py-12 text-center shadow-[0_20px_50px_rgba(15,23,42,0.35)] md:px-12 md:py-14"
        aria-labelledby="home-cta-title"
      >
        <h2 id="home-cta-title" className="text-[22px] font-extrabold tracking-tight text-white md:text-[28px]">
          Let&apos;s build something impactful together
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] font-medium text-slate-400 md:text-[15px]">
          Tell me about your product, timeline, and constraints — I&apos;ll respond with a clear next step.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <PrimaryButton type="button" onClick={go("contact")} className="min-w-[200px]">
            Contact me
          </PrimaryButton>
          <button
            type="button"
            onClick={go("about")}
            className="inline-flex min-w-[200px] items-center justify-center rounded-lg border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-150 hover:border-white/50 hover:bg-white/10"
          >
            About
          </button>
        </div>
      </section>

      {lightbox && <VideoLightbox project={lightbox} onClose={closeModal} />}
    </div>
  );
}
