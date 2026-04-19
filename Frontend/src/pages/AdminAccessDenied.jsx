import { PageHeader, Card, PrimaryButton } from "../components/UI";

export default function AdminAccessDenied({ setPage }) {
  return (
    <div className="animate-[fadeUp_0.35s_ease_both] mx-auto max-w-lg">
      <PageHeader title="Access denied" subtitle="Admin privileges required." />
      <Card className="p-8 text-center">
        <p className="text-[14px] font-medium leading-relaxed text-slate-600">
          Your account is signed in but does not have permission to open the admin panel. Contact an
          administrator if you need access.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <PrimaryButton variant="secondary" onClick={() => setPage("home")}>
            Back to home
          </PrimaryButton>
          <PrimaryButton onClick={() => setPage("dashboard")}>Voice-Labs dashboard</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
