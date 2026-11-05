import { EmptyState } from "@/components/states";
import { PageHeader, StatCard, StatStrip } from "@/components/page";
import { requireAdmin } from "@/server/access";
import { RunNowButton } from "./run-button";
import { lastRun, listRisk } from "./queries";
import { RiskTable } from "./risk-table";

export default async function RiskPage() {
  const v = await requireAdmin();
  const [rows, last] = await Promise.all([listRisk(v), lastRun(v)]);
  const open = rows.filter((r) => r.task === "Open").length;
  const closed = rows.filter((r) => r.task === "Done" || r.task === "Dismissed").length;
  return (
    <>
      <PageHeader title="At-risk flags" description="A flag only creates a mentor task. It never changes a student's record."
        actions={<RunNowButton />} />
      <StatStrip cols={4}>
        <StatCard label="Active flags" value={rows.length} tone="late" />
        <StatCard label="Open mentor tasks" value={open} />
        <StatCard label="Closed tasks" value={closed} tone="ok" />
        <StatCard label="Last run" value={last ? last.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "Never"} />
      </StatStrip>
      <div className="mt-6">
        {rows.length === 0
          ? <EmptyState title="No students flagged. Run the check to update." action={<RunNowButton />} />
          : <RiskTable rows={rows} />}
      </div>
    </>
  );
}
