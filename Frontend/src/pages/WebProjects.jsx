import { PageHeader } from "../components/UI";
import WebProjectsShowcase from "../components/WebProjectsShowcase";

export default function WebProjects() {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader
        title="Web Projects"
        subtitle="LuminareAI — flagship builds, demos, and production launches"
      />
      <WebProjectsShowcase />
    </div>
  );
}
