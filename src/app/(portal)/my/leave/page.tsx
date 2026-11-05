import { desc, eq } from "drizzle-orm";
import { PageHeader, SectionHeading, StatusPill } from "@/components/page";
import { EmptyState } from "@/components/states";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { leaveRequest } from "@/server/schema";
import { ApplyLeave, DecideLeave, WithdrawLeave } from "./leave-client";
import { dayCount, statusLabel, statusTone } from "./shared";

const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function LeavePage() {
  const v = await requirePortal();
  const [rows, student] = await Promise.all([
    db.select().from(leaveRequest).where(eq(leaveRequest.studentId, v.studentId)).orderBy(desc(leaveRequest.createdAt)),
    portalStudent(v.studentId),
  ]);
  const mentor = student?.mentor ?? null;

  if (v.role === "parent") {
    const waiting = rows.filter((r) => r.status === "pending_parent");
    const history = rows.filter((r) => r.status !== "pending_parent");
    return (
      <>
        <PageHeader title="Leave" description="You apply → parent approves → mentor approves. Approved days show as 'On leave' in attendance." />
        <SectionHeading title="Needs your approval" count={waiting.length} />
        {waiting.length === 0 ? <EmptyState title="Nothing is waiting for your approval." /> : (
          <ul className="space-y-3">
            {waiting.map((r) => (
              <Row key={r.id} r={r} mentor={mentor}>
                <DecideLeave id={r.id} />
              </Row>
            ))}
          </ul>
        )}
        <SectionHeading title="History" count={history.length} />
        {history.length === 0 ? <EmptyState title="No earlier requests." /> : (
          <ul className="space-y-3">
            {history.map((r) => <Row key={r.id} r={r} mentor={mentor} />)}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Leave"
        description="You apply → parent approves → mentor approves. Approved days show as 'On leave' in attendance."
        actions={<ApplyLeave />} />
      <SectionHeading title="Requests" count={rows.length} />
      {rows.length === 0 ? <EmptyState title="No leave requests yet." /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <Row key={r.id} r={r} mentor={mentor}>
              {(r.status === "pending_parent" || r.status === "pending_mentor") && (
                <div className="mt-3 flex justify-end"><WithdrawLeave id={r.id} /></div>
              )}
            </Row>
          ))}
        </ul>
      )}
    </>
  );
}

function Row({ r, mentor, children }: {
  r: typeof leaveRequest.$inferSelect; mentor: string | null; children?: React.ReactNode;
}) {
  const days = dayCount(r.fromDate, r.toDate);
  return (
    <li className="rounded-xl bg-card p-4 shadow-sheet md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {r.kind === "medical" ? "Medical" : "Leave"} · {days} {days === 1 ? "day" : "days"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{fmt(r.fromDate)}{r.toDate !== r.fromDate && <> – {fmt(r.toDate)}</>}</p>
        </div>
        <StatusPill tone={statusTone(r.status)}>{statusLabel(r.status, mentor)}</StatusPill>
      </div>
      <p className="mt-3 text-sm text-pretty">{r.reason}</p>
      {r.parentNote && <p className="mt-2 text-sm text-muted-foreground">Parent: {r.parentNote}</p>}
      {r.mentorNote && <p className="mt-2 text-sm text-muted-foreground">Mentor: {r.mentorNote}</p>}
      {children}
    </li>
  );
}
