import { PageHeader } from "../components/UI";
import WebProjectsShowcase from "../components/WebProjectsShowcase";

export default function WebProjects({ setPage }) {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader
        title="Services"
        subtitle="Web builds, growth, and AI products — designed to be shipped and used"
      />
      <WebProjectsShowcase onNavigate={setPage} />
    </div>
  );
}
