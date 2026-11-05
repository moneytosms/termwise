import { EmptyState } from "@/components/states";
import { PageHeader, SectionHeading, StatCard, StatStrip, StatusPill } from "@/components/page";
import { istDate } from "@/domain/attendance";
import { BALANCE, KIND_LABEL, remaining, used, yearOf, type LeaveKind, type Span } from "@/domain/staff-leave";
import { requireViewer, type Viewer } from "@/server/access";
import { HistoryTable } from "./history-table";
import { DecideForm, ApplyForm } from "./leave-forms";
import { campusLeave, myLeave } from "./queries";
import { STATUS_LABEL, STATUS_TONE, fmtDays, fmtRange } from "./shared";
import { can } from "@/domain/roles";

const KINDS = Object.keys(BALANCE) as LeaveKind[];

export default async function LeavePage() {
  const v = await requireViewer();
  const year = istDate().slice(0, 4);
  const mine = await myLeave(v);
  return (
    <>
      <PageHeader title="Leave" description={can(v.role, "staff_leave")
        ? "Leave waiting for the office, and your own leave."
        : can(v.role, "dept_leave") ? "Leave waiting for you from your department's faculty, and your own leave."
        : "Apply for casual, medical and on-duty leave. The office approves it."} />
      {(can(v.role, "staff_leave") || can(v.role, "dept_leave")) && <OfficeQueue v={v} />}
      <SectionHeading title={`Your leave in ${year}`} />
      <Balances leaves={mine} year={year} />
      <div className="mt-4 rounded-xl bg-card p-4 shadow-sheet">
        <h3 className="mb-3 font-medium">Apply for leave</h3>
        <ApplyForm />
      </div>
      <SectionHeading title="Your requests" count={mine.length} />
      <HistoryTable rows={mine} />
    </>
  );
}

function Balances({ leaves, year }: { leaves: Span[]; year: string }) {
  return (
    <StatStrip cols={3}>
      {KINDS.map((k) => {
        const cap = BALANCE[k];
        const left = remaining(k, year, leaves);
        const taken = used(k, year, leaves);
        return (
          <StatCard key={k} label={KIND_LABEL[k]}
            value={left === null ? taken : left}
            hint={cap === null ? (taken === 1 ? "day used, no limit" : "days used, no limit") : `left of ${cap} · ${taken} used`} />
        );
      })}
    </StatStrip>
  );
}

async function OfficeQueue({ v }: { v: Viewer }) {
  const { pending, held, decided } = await campusLeave(v);
  // Balance before each pending request: the person's other pending and approved leave only.
  const before = (p: (typeof pending)[number]) => {
    const year = yearOf(p.fromDate);
    const others = held.filter((h) => h.staffId === p.staffId && h.id !== p.id);
    return (["casual", "medical"] as const)
      .map((k) => `${KIND_LABEL[k]} ${remaining(k, year, others)} left`).join(" · ");
  };
  return (
    <>
      <SectionHeading title={can(v.role, "staff_leave") ? "Waiting for the office" : "Waiting for you"} count={pending.length} />
      {pending.length === 0 ? <EmptyState title="No leave waiting." /> : (
        <ul className="space-y-3">
          {pending.map((p) => (
            <li key={p.id} className="rounded-xl bg-card p-4 shadow-sheet">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="font-medium">{p.staffName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    {KIND_LABEL[p.kind]} · {fmtRange(p.fromDate, p.toDate)} · {fmtDays(p.fromDate, p.toDate)}
                  </p>
                </div>
                <StatusPill tone={STATUS_TONE.pending}>{STATUS_LABEL.pending}</StatusPill>
              </div>
              <p className="mt-2 text-sm">{p.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">Before this request: {before(p)}</p>
              {p.staffId === v.staffId
                ? <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">Your own leave. Another office admin has to decide it.</p>
                : <DecideForm id={p.id} />}
            </li>
          ))}
        </ul>
      )}

      <SectionHeading title="Recent decisions" count={decided.length} />
      {decided.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : (
        <div className="rounded-xl bg-card p-4 shadow-sheet">
          <ul className="divide-y divide-rule">
            {decided.map((d) => (
              <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <p className="font-medium">{d.staffName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                      {KIND_LABEL[d.kind]} · {fmtRange(d.fromDate, d.toDate)} · {d.decidedBy ? `by ${d.decidedBy}` : "decided"}
                    </p>
                  </div>
                  <StatusPill tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</StatusPill>
                </div>
                {d.note && <p className="mt-1 text-sm text-muted-foreground">Note: {d.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
