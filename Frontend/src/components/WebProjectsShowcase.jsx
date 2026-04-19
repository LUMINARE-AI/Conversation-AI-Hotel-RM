import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Sparkles, ShoppingBag, Sun, X, Zap } from "lucide-react";
import { WEB_PROJECTS } from "../data/webProjects";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function useFinePointerHover() {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);
  return canHover;
}

function pauseAllPreviewVideos() {
  document.querySelectorAll("[data-web-project-preview]").forEach((el) => {
    if (el instanceof HTMLVideoElement) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  });
}

function ProjectIcon({ id, className = "h-6 w-6" }) {
  const c = className;
  if (id === "woolcrafts") return <Sparkles className={c} strokeWidth={2} />;
  if (id === "binkhalid") return <ShoppingBag className={c} strokeWidth={2} />;
  return <Sun className={c} strokeWidth={2} />;
}

function ProjectVideoPreview({ project, onOpen, prefersReducedMotion, canHoverPlay }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
      },
      { rootMargin: "140px", threshold: 0.06 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !inView) return;
    v.src = project.videoSrc;
    v.load();
  }, [inView, project.videoSrc]);

  const playPreview = useCallback(() => {
    if (prefersReducedMotion || !canHoverPlay) return;
    videoRef.current?.play().catch(() => {});
  }, [prefersReducedMotion, canHoverPlay]);

  const pausePreview = useCallback(() => {
    if (!canHoverPlay) return;
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, [canHoverPlay]);

  const open = useCallback(() => {
    pauseAllPreviewVideos();
    onOpen(project);
  }, [onOpen, project]);

  const scaleClass =
    prefersReducedMotion || !canHoverPlay ? "" : "group-hover/vid:scale-[1.04]";

  return (
    <div
      ref={wrapRef}
      className={`relative aspect-video cursor-pointer overflow-hidden rounded-3xl border border-slate-200/90 bg-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5 transition-[box-shadow,transform] duration-500 ease-out group/vid hover:shadow-[0_24px_56px_rgba(99,102,241,0.2)] ${prefersReducedMotion ? "" : "hover:-translate-y-0.5"}`}
      onMouseEnter={playPreview}
      onMouseLeave={pausePreview}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      aria-label={`Play ${project.title} demo video full screen`}
    >
      <video
        ref={videoRef}
        data-web-project-preview
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${scaleClass} ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        muted
        playsInline
        loop
        preload="none"
        onLoadedData={() => setLoaded(true)}
      />
      <div
        className={`absolute inset-0 bg-slate-900 transition-opacity duration-500 ${loaded ? "opacity-0" : "opacity-100"}`}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-900/15 to-slate-900/25"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-indigo-600 shadow-[0_10px_36px_rgba(15,23,42,0.38)] ring-2 ring-white/90 transition-transform duration-300 ease-out md:h-[4.5rem] md:w-[4.5rem] ${
            prefersReducedMotion ? "" : "group-hover/vid:scale-110 group-hover/vid:shadow-indigo-500/30"
          }`}
        >
          <svg
            className="ml-1 h-8 w-8 text-indigo-600 md:h-9 md:w-9"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 md:bottom-5 md:left-5 md:right-5">
        <span className="truncate rounded-lg bg-slate-950/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/95 backdrop-blur-sm">
          HD preview
        </span>
        <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur-sm max-[639px]:text-[10px]">
          <span className="hidden sm:inline">Hover to preview · Click to expand</span>
          <span className="sm:hidden">Tap to expand</span>
        </span>
      </div>
    </div>
  );
}

function TechBadge({ children, variant = "neutral" }) {
  const styles =
    variant === "accent"
      ? "border-indigo-200/80 bg-indigo-50/90 text-indigo-800"
      : "border-slate-200/90 bg-slate-50/95 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-tight ${styles}`}
    >
      {children}
    </span>
  );
}

function VideoLightbox({ project, onClose }) {
  const closeRef = useRef(null);
  const vidRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    vidRef.current?.play().catch(() => {});
  }, [project]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/92 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-project-lightbox-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-12 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 md:-right-2 md:-top-2 md:bg-white/90 md:text-slate-700 md:hover:bg-white"
          aria-label="Close video"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
          <div className="border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
            <h2
              id="web-project-lightbox-title"
              className="text-[15px] font-bold tracking-tight text-white md:text-[17px]"
            >
              {project.title}
              {project.subtitle && (
                <span className="ml-2 font-semibold text-slate-300">
                  — {project.subtitle}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              {project.tagline}
            </p>
          </div>
          <video
            ref={vidRef}
            className="max-h-[min(78vh,720px)] w-full bg-black object-contain"
            src={project.videoSrc}
            controls
            playsInline
            autoPlay
          />
        </div>
      </div>
    </div>
  );
}

export default function WebProjectsShowcase() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canHoverPlay = useFinePointerHover();
  const [lightbox, setLightbox] = useState(null);
  const headingId = useId();

  const openModal = useCallback((project) => {
    pauseAllPreviewVideos();
    setLightbox(project);
  }, []);

  const closeModal = useCallback(() => setLightbox(null), []);

  return (
    <div className="w-full space-y-12" aria-labelledby={headingId}>
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br from-white via-indigo-50/40 to-violet-50/50 p-8 shadow-[0_2px_24px_rgba(99,102,241,0.08)] md:p-11">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl"
          aria-hidden
        />

        <div className="relative max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-600 md:text-xs">
            Selected work
          </p>
          <h2
            id={headingId}
            className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-900 md:text-[34px]"
          >
            Web projects that ship
          </h2>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-slate-500 md:text-base">
            Three flagship builds — 3D product platforms, full-stack commerce, and
            high-performance marketing sites — each crafted with the same obsession
            for polish, performance, and measurable outcomes.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-10 md:gap-12">
        {WEB_PROJECTS.map((project, i) => (
          <article
            key={project.id}
            className={`web-project-card-enter group/card relative flex flex-col overflow-hidden rounded-3xl border border-slate-100/90 bg-white/75 shadow-[0_4px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-500 ease-out ${project.ring} ${project.glow} hover:-translate-y-1 hover:shadow-2xl ${
              prefersReducedMotion ? "hover:translate-y-0" : ""
            }`}
            style={{ animationDelay: `${i * 110}ms` }}
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-2 bg-linear-to-r ${project.gradient}`}
              aria-hidden
            />
            <div
              className={`pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover/card:opacity-70 bg-linear-to-br ${project.gradient}`}
              aria-hidden
            />

            <div className="relative flex flex-1 flex-col p-6 md:p-8 lg:p-10">
              <div className="mb-5 flex items-start justify-between gap-3 md:mb-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/80 md:h-14 md:w-14">
                      <ProjectIcon id={project.id} className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[22px] font-extrabold tracking-tight text-slate-900 md:text-[26px]">
                        {project.title}
                      </h3>
                      {project.subtitle && (
                        <p className="text-[15px] font-semibold text-violet-700 md:text-base">
                          {project.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {project.typeLabel && (
                    <span className="mt-3 inline-flex rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      {project.typeLabel}
                    </span>
                  )}
                  <p className="mt-4 text-[15px] font-semibold leading-snug text-indigo-600 md:text-[16px]">
                    {project.tagline}
                  </p>
                </div>
              </div>

              <div className="mb-6 md:mb-7">
                <ProjectVideoPreview
                  project={project}
                  onOpen={openModal}
                  prefersReducedMotion={prefersReducedMotion}
                  canHoverPlay={canHoverPlay}
                />
              </div>

              <p className="mb-5 text-[15px] leading-relaxed text-slate-600 md:text-base md:leading-relaxed">
                {project.description}
              </p>

              <div className="mb-5 md:mb-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Highlights
                </p>
                <ul className="space-y-2.5 md:space-y-3">
                  {project.highlights.map((line) => (
                    <li
                      key={line}
                      className="flex gap-3 text-[14px] font-medium leading-snug text-slate-700 md:text-[15px]"
                    >
                      <span className="mt-0.5 shrink-0 text-emerald-500">
                        <Check className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {project.techJourney && (
                <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 md:px-5 md:py-4">
                  <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Tech journey
                  </p>
                  <p className="text-[13px] font-medium leading-relaxed text-slate-600 md:text-sm">
                    {project.techJourney}
                  </p>
                </div>
              )}

              <div className="mb-4 mt-auto">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Tech stack
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((t) => (
                    <TechBadge key={t}>{t}</TechBadge>
                  ))}
                </div>
              </div>

              {project.integrations?.length > 0 && (
                <div>
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Integrations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.integrations.map((t) => (
                      <TechBadge key={t} variant="accent">
                        {t}
                      </TechBadge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {lightbox && (
        <VideoLightbox project={lightbox} onClose={closeModal} />
      )}
    </div>
  );
}

export {
  ProjectVideoPreview,
  VideoLightbox,
  usePrefersReducedMotion,
  useFinePointerHover,
  pauseAllPreviewVideos,
};
