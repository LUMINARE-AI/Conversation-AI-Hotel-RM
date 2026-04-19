import { useEffect, useRef, useState } from "react";

const BRAND = {
  name: "LuminareAI",
  tagline: "Intelligent voice experiences for modern hospitality.",
  description:
    "Conversation AI, calling workflows, and web experiences — crafted with clarity and scale in mind.",
};

const FOOTER_NAV = [
  { id: "home", label: "Home" },
  { id: "dashboard", label: "Voice-Labs" },
  { id: "web-projects", label: "Web Projects" },
  { id: "about", label: "About Us" },
  { id: "contact", label: "Contact Us" },
];

function IconMail({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconMapPin({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconLinkedIn({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconGitHub({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function IconX({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIAL = [
  { label: "LinkedIn", href: "https://linkedin.com", Icon: IconLinkedIn },
  { label: "GitHub", href: "https://github.com", Icon: IconGitHub },
  { label: "X (Twitter)", href: "https://twitter.com", Icon: IconX },
];

const CONTACT = {
  email: "hello@luminare.ai",
  location: "India",
};

/** Layered SVG waves — wide paths so horizontal drift loops seamlessly */
function FooterWaves() {
  return (
    <div
      className="pointer-events-none relative h-[72px] w-full overflow-hidden md:h-[96px]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-linear-to-b from-slate-100 via-slate-100 to-transparent" />

      {/* Back wave — slowest, soft indigo (parallax depth) */}
      <svg
        className="footer-wave-layer footer-wave-drift-slow absolute bottom-0 left-0 h-[72px] w-[200%] min-w-[1600px] text-indigo-200/55 md:h-[96px]"
        preserveAspectRatio="none"
        viewBox="0 0 2400 120"
      >
        <path
          fill="currentColor"
          d="M0,80 C400,20 800,140 1200,80 S2000,20 2400,80 L2400,120 L0,120 Z"
        />
      </svg>

      {/* Mid wave — violet tint, reverse direction */}
      <svg
        className="footer-wave-layer footer-wave-drift-mid absolute bottom-0 left-0 h-[64px] w-[200%] min-w-[1600px] text-violet-300/40 md:h-[84px]"
        preserveAspectRatio="none"
        viewBox="0 0 2400 120"
      >
        <path
          fill="currentColor"
          d="M0,88 C380,40 820,118 1220,78 S1980,32 2400,86 L2400,120 L0,120 Z"
        />
      </svg>

      {/* Front wave — slate, subtle */}
      <svg
        className="footer-wave-layer footer-wave-drift-front absolute bottom-0 left-0 h-[56px] w-[200%] min-w-[1600px] text-slate-200/90 md:h-[72px]"
        preserveAspectRatio="none"
        viewBox="0 0 2400 120"
      >
        <path
          fill="currentColor"
          d="M0,92 C420,58 780,108 1180,84 S2020,48 2400,90 L2400,120 L0,120 Z"
        />
      </svg>

      {/* Gradient fade into footer body */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-slate-100 to-transparent md:h-10" />
    </div>
  );
}

function SocialLink({ href, label, Icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-500 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:border-indigo-300/80 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-[0_8px_24px_rgba(99,102,241,0.2)]"
    >
      <Icon className="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-6" />
    </a>
  );
}

export default function Footer({ setPage }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer ref={ref} className="relative mt-auto w-full">
      <FooterWaves />

      <div
        className={`border-t border-slate-200/80 bg-linear-to-b from-slate-100 to-slate-50/95 ${
          visible ? "footer-fade-in" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="mx-auto max-w-310 px-7 pb-12 pt-2 md:pb-14 md:pt-4">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Brand */}
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  aria-hidden
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-[20px] font-black tracking-tight text-slate-900">
                  {BRAND.name}
                </span>
              </div>
              <p className="mt-3 text-[13px] font-semibold text-indigo-600">
                {BRAND.tagline}
              </p>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-slate-500">
                {BRAND.description}
              </p>
            </div>

            {/* Navigation */}
            <nav
              className="lg:col-span-3"
              aria-label="Footer navigation"
            >
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Navigate
              </h2>
              <ul className="mt-4 space-y-2.5">
                {FOOTER_NAV.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setPage(item.id)}
                      className="group relative text-left text-[13.5px] font-semibold text-slate-600 transition-colors hover:text-indigo-600"
                    >
                      <span className="relative">
                        {item.label}
                        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-indigo-500 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Contact + Social */}
            <div className="flex flex-col gap-8 lg:col-span-4">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Contact
                </h2>
                <ul className="mt-4 space-y-3">
                  <li>
                    <a
                      href={`mailto:${CONTACT.email}`}
                      className="group inline-flex items-center gap-2.5 text-[13.5px] font-medium text-slate-600 transition-colors hover:text-indigo-600"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-indigo-500 shadow-sm ring-1 ring-slate-200/80 transition-all group-hover:ring-indigo-200">
                        <IconMail className="h-4 w-4" />
                      </span>
                      {CONTACT.email}
                    </a>
                  </li>
                  <li className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-600">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-400 shadow-sm ring-1 ring-slate-200/80">
                      <IconMapPin className="h-4 w-4" />
                    </span>
                    {CONTACT.location}
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Social
                </h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {SOCIAL.map((s) => (
                    <SocialLink key={s.label} href={s.href} label={s.label} Icon={s.Icon} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 md:flex-row">
            <p className="text-center text-[12px] font-medium text-slate-400 md:text-left">
              © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Built with precision · Designed to scale
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
