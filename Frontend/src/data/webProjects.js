/**
 * Demo video URLs — replace with your own hosted previews in /public/videos/ for production.
 * Format: short MP4, H.264, muted-friendly for autoplay previews.
 */
const SAMPLE = {
  a: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  b: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  c: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
};

export const WEB_PROJECTS = [
  {
    id: "woolcrafts",
    title: "Woolcrafts",
    tagline: "A 3D Wool Toy Customization Platform 🧸✨",
    description:
      "A real-time 3D customization platform where users can personalize wool toys (colors, textures, parts), save designs, and even generate AI-based 3D models.",
    highlights: [
      "Real-time customization (colors, textures, parts)",
      "Admin-controlled live gallery updates",
      "Save custom designs",
      "AI-powered 3D generation using Tripo APIs",
    ],
    techJourney:
      "Three.js → React Three Fiber → Full Stack → AWS Amplify + EC2 → Nginx → SSL → Production",
    techStack: ["Three.js", "React Three Fiber", "Node.js", "AWS Amplify", "EC2", "Nginx", "Tripo API"],
    integrations: [],
    videoSrc: SAMPLE.a,
    accent: "indigo",
    gradient: "from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15",
    ring: "ring-indigo-500/25 hover:ring-indigo-400/45",
    glow: "shadow-indigo-500/15 hover:shadow-indigo-500/25",
  },
  {
    id: "binkhalid",
    title: "BinKhalid",
    subtitle: "The Epitome of Perfume",
    typeLabel: "Full-stack E-commerce Platform",
    tagline: "Luxury commerce — payments, logistics, admin, and full customer experience.",
    description:
      "A production-ready commerce platform with payments, logistics, admin panel, and full customer experience.",
    highlights: [
      "Admin dashboard (products, orders, users, reviews)",
      "Smart checkout with auto shipping calculation",
      "User dashboard (profile, orders, tracking)",
      "JWT authentication & secure routes",
    ],
    techJourney: null,
    techStack: ["MongoDB", "React", "Tailwind CSS", "Express.js", "Node.js", "Cloudinary"],
    integrations: ["Razorpay", "Delhivery", "Resend", "GoDaddy", "Vercel", "Render"],
    videoSrc: SAMPLE.b,
    accent: "violet",
    gradient: "from-violet-500/15 via-purple-500/10 to-indigo-500/15",
    ring: "ring-violet-500/25 hover:ring-violet-400/45",
    glow: "shadow-violet-500/15 hover:shadow-violet-500/25",
  },
  {
    id: "ay-solar",
    title: "AY SolarEnergy",
    typeLabel: "Next.js Website",
    tagline: "Solar energy presence for Jaipur & Tonk — SEO, performance, and leads.",
    description:
      "A modern solar energy website built for a business based in Jaipur & Tonk, focused on SEO, performance, and lead generation.",
    highlights: [
      "SEO-first structure & performance tuning",
      "Lead-focused layout & clear CTAs",
      "Fast Next.js delivery & modern UX",
      "Regional market positioning (Jaipur & Tonk)",
    ],
    techJourney: null,
    techStack: ["Next.js", "React", "Tailwind CSS", "Vercel"],
    integrations: [],
    videoSrc: SAMPLE.c,
    accent: "amber",
    gradient: "from-amber-500/12 via-orange-500/10 to-yellow-500/12",
    ring: "ring-amber-500/25 hover:ring-amber-400/40",
    glow: "shadow-amber-500/15 hover:shadow-amber-500/22",
  },
];
