import { EmptyState } from "@/components/states";
import { PageHeader, StatCard, StatStrip } from "@/components/page";
import { redirect } from "next/navigation";
import { can } from "@/domain/roles";
import { requireViewer } from "@/server/access";
import { RunNowButton } from "./run-button";
import { lastRun, listRisk } from "./queries";
import { RiskTable } from "./risk-table";

export default async function RiskPage() {
  const v = await requireViewer();
  if (!can(v.role, "risk") && !can(v.role, "risk_view")) redirect("/home");
  const canRun = can(v.role, "risk");
  const [rows, last] = await Promise.all([listRisk(v), lastRun(v)]);
  const open = rows.filter((r) => r.task === "Open").length;
  const closed = rows.filter((r) => r.task === "Done" || r.task === "Dismissed").length;
  return (
    <>
      <PageHeader title="At-risk flags" description="A flag only creates a mentor task. It never changes a student's record."
        actions={canRun ? <RunNowButton /> : undefined} />
      <StatStrip cols={4}>
        <StatCard label="Active flags" value={rows.length} tone="late" />
        <StatCard label="Open mentor tasks" value={open} />
        <StatCard label="Closed tasks" value={closed} tone="ok" />
        <StatCard label="Last run" value={last ? last.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "Never"} />
      </StatStrip>
      <div className="mt-6">
        {rows.length === 0
          ? <EmptyState title={canRun ? "No students flagged. Run the check to update." : "No students flagged."} action={canRun ? <RunNowButton /> : undefined} />
          : <RiskTable rows={rows} />}
      </div>
    </>
  );
}
