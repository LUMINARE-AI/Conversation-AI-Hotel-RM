import { PageHeader } from "../UI";

/**
 * Wraps admin content with the same header rhythm as Voice-Labs pages.
 */
export default function AdminLayout({ title, subtitle, action, children }) {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
}
