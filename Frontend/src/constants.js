/** Voice / calling product area — shown under the Voice-Labs dropdown */
export const VOICE_LABS_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "customers", label: "Customers", icon: "customers" },
  { id: "call", label: "Call Trigger", icon: "phone" },
  { id: "reports", label: "Reports", icon: "reports" },
  { id: "upload", label: "Upload", icon: "upload" },
  { id: "samvaad", label: "Experience Voice-Labs", icon: "samvaad" },
];

export const VOICE_LABS_PAGE_IDS = VOICE_LABS_NAV.map((n) => n.id);

/** Top-level marketing / site pages */
export const SITE_NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "web-projects", label: "Web Projects", icon: "layout" },
  { id: "about", label: "About Us", icon: "users" },
  { id: "contact", label: "Contact Us", icon: "mail" },
];

/** @deprecated Use VOICE_LABS_NAV — kept for any external imports */
export const NAV = VOICE_LABS_NAV;