import { EmptyState } from "@/components/states";
import { Panel, PageHeader, SectionHeading, StatCard, StatStrip, StatusPill, type Tone } from "@/components/page";
import { requireViewer, type Viewer } from "@/server/access";
import { adminRequests, facultyRequests } from "./queries";
import { CloseRequest, LeaveDecision } from "./request-forms";

const LEAVE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_parent: { label: "Waiting for parent", tone: "default" },
  pending_mentor: { label: "Waiting for mentor", tone: "late" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "absent" },
  withdrawn: { label: "Withdrawn", tone: "default" },
};

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
const shortDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

type Leave = Awaited<ReturnType<typeof facultyRequests>>["toDecide"][number];
type Note = Awaited<ReturnType<typeof facultyRequests>>["openNotes"][number];

export default async function RequestsPage() {
  const v = await requireViewer();
  return v.role === "office_admin" ? <AdminView v={v} /> : <FacultyView v={v} />;
}

async function FacultyView({ v }: { v: Viewer }) {
  const { toDecide, openNotes, doneNotes, decided } = await facultyRequests(v);
  return (
    <>
      <PageHeader title="Requests" description="Your mentees' leave and notes from parents." />

      <SectionHeading title="Leave to approve" count={toDecide.length} />
      {toDecide.length === 0 ? <EmptyState title="Nothing waiting." /> : (
        <ul className="space-y-3">
          {toDecide.map((l) => <li key={l.id}><LeaveCard l={l}><LeaveDecision id={l.id} /></LeaveCard></li>)}
        </ul>
      )}

      <SectionHeading title="Notes from parents" count={openNotes.length} />
      {openNotes.length === 0 ? <EmptyState title="Nothing waiting." /> : (
        <ul className="space-y-3">
          {openNotes.map((n) => <li key={n.id}><NoteCard n={n}><CloseRequest id={n.id} /></NoteCard></li>)}
        </ul>
      )}
      {doneNotes.length > 0 && (
        <Collapsed title="Answered notes" count={doneNotes.length}>
          {doneNotes.map((n) => <NoteCard key={n.id} n={n} />)}
        </Collapsed>
      )}

      <div className="mt-10">
        <Collapsed title="Recent leave decisions" count={decided.length}>
          {decided.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : decided.map((l) => (
            <LeaveCard key={l.id} l={l} />
          ))}
        </Collapsed>
      </div>
    </>
  );
}

async function AdminView({ v }: { v: Viewer }) {
  const { corrections, byStatus, latest } = await adminRequests(v);
  const count = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0;
  return (
    <>
      <PageHeader title="Requests" description="Record corrections from families, and leave across the campus." />

      <SectionHeading title="Record corrections" count={corrections.length} />
      {corrections.length === 0 ? <EmptyState title="Nothing waiting." /> : (
        <ul className="space-y-3">
          {corrections.map((n) => <li key={n.id}><NoteCard n={n}><CloseRequest id={n.id} /></NoteCard></li>)}
        </ul>
      )}

      <SectionHeading title="Leave on campus" />
      <StatStrip cols={4}>
        <StatCard label="Waiting for parent" value={count("pending_parent")} />
        <StatCard label="Waiting for mentor" value={count("pending_mentor")} tone="late" />
        <StatCard label="Approved" value={count("approved")} tone="ok" />
        <StatCard label="Rejected" value={count("rejected")} tone="absent" />
      </StatStrip>
      <div className="mt-6">
        <Panel title="Latest leave requests" figure={latest.length}>
          {latest.length === 0 ? <p className="text-sm text-muted-foreground">No leave requests yet.</p> : (
            <ul className="divide-y divide-rule">
              {latest.map((l) => (
                <li key={l.id} className="py-3 first:pt-0 last:pb-0">
                  <LeaveSummary l={l} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function LeaveCard({ l, children }: { l: Leave; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sheet">
      <LeaveSummary l={l} />
      <p className="mt-2 text-sm">{l.reason}</p>
      {l.parentNote && <p className="mt-2 text-sm text-muted-foreground">Parent: {l.parentNote}</p>}
      {l.mentorNote && <p className="mt-2 text-sm text-muted-foreground">Your note: {l.mentorNote}</p>}
      {children}
    </div>
  );
}

function LeaveSummary({ l }: { l: Leave }) {
  const s = LEAVE_STATUS[l.status] ?? LEAVE_STATUS.withdrawn;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <p className="font-medium">{l.studentName} <span className="font-normal text-muted-foreground tabular-nums">{l.rollNo}</span></p>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {l.kind === "medical" ? "Medical" : "Leave"} · {day(l.fromDate)}
          {l.toDate !== l.fromDate && <> – {day(l.toDate)}</>} · {dayCount(l.fromDate, l.toDate)} {dayCount(l.fromDate, l.toDate) === 1 ? "day" : "days"}
        </p>
      </div>
      <StatusPill tone={s.tone}>{s.label}</StatusPill>
    </div>
  );
}

function NoteCard({ n, children }: { n: Note; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sheet">
      <p className="font-medium">{n.studentName} <span className="font-normal text-muted-foreground tabular-nums">{n.rollNo}</span></p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        From {n.fromName} · {n.closedAt ? `Done ${shortDate(n.closedAt)}` : shortDate(n.createdAt)}
      </p>
      <p className="mt-2 text-sm whitespace-pre-line">{n.body}</p>
      {n.reply && <p className="mt-2 text-sm text-muted-foreground">Reply: {n.reply}</p>}
      {children}
    </div>
  );
}

function Collapsed({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group mt-6">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        {title} <span className="tabular-nums">{count}</span>
        <span className="ml-auto text-xs group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
