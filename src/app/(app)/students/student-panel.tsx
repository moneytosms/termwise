"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { RecordModal } from "@/components/record-modal";
import { EmptyState } from "@/components/states";
import { AttendanceMeter, SectionHeading, StatusPill } from "@/components/page";
import { Initials } from "./students-table";
import { dues } from "@/domain/fees";
import { classesToReach, istDate } from "@/domain/attendance";
import { rupees } from "@/lib/utils";
import { SOURCE } from "../risk/labels";
import { closeMentorTask } from "./actions";
import type { StudentDetail } from "./queries";

const card = "rounded-xl bg-card p-3.5 text-sm shadow-sheet";

export function StudentPanel({ detail, isAdmin }: { detail: StudentDetail | null; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const close = () => router.push("/students", { scroll: false });
  const d = detail;

  const finish = (taskId: number, status: "done" | "dismissed") => start(async () => {
    const r = await closeMentorTask(taskId, status);
    if (r.error) toast.error(r.error); else router.refresh();
  });

  if (!d) {
    return (
      <RecordModal title="Student" description="Not available" onClose={close}>
        <EmptyState title="This student isn't available to you." />
      </RecordModal>
    );
  }

  const feeDue = d.instalments ? dues(d.instalments, istDate()).totalPaise : 0;
  const shortSubjects = d.subjects.filter((s) => s.percent !== null && s.percent < d.student.cutoff);
  const openFlags = d.flags.filter((f) => f.taskStatus === "open" && !isAdmin);
  const onTrack = shortSubjects.length === 0 && feeDue === 0 && openFlags.length === 0;

  return (
    <RecordModal
      wide
      title={d.student.name}
      description={`${d.student.rollNo} · ${d.student.programme} · Year ${d.student.year}`}
      leading={<Initials name={d.student.name} />}
      onClose={close}
      nav={{ key: "students", id: String(d.student.id), href: (id) => `/students?student=${id}` }}>
      <div className="space-y-2 pb-2">
        <SectionHeading title="Next steps" />
        {onTrack ? <p className="text-sm text-muted-foreground">On track. Nothing to do.</p> : (
          <div className="space-y-2">
            {shortSubjects.map((s) => {
              const n = classesToReach(s.attended, s.held, d.student.cutoff);
              return (
                <div key={s.name} className={card}>
                  {n === Infinity
                    ? `Cannot reach ${d.student.cutoff}% in ${s.name} any more.`
                    : `Needs ${n} more classes in a row to reach ${d.student.cutoff}% in ${s.name}.`}
                </div>
              );
            })}
            {feeDue > 0 && (
              <div className={`flex items-center justify-between gap-3 ${card}`}>
                <span><span className="font-semibold tabular-nums">{rupees(feeDue)}</span> due</span>
                <Link href={`/fees?student=${d.student.id}`} className={buttonVariants({ size: "sm" })}>Open fees</Link>
              </div>
            )}
            {openFlags.length > 0 && <div className={card}>Follow up on the at-risk flag below.</div>}
          </div>
        )}
      </div>

      <div className="space-y-2 pb-8">
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm shadow-sheet">
          <div className="bg-card p-3.5"><dt className="text-muted-foreground">Attendance</dt><dd className={`mt-1 text-xl font-medium tabular-nums ${d.overall !== null && d.overall < d.student.cutoff ? "text-absent" : ""}`}>{d.overall ?? "–"}{d.overall !== null && "%"}</dd></div>
          {d.instalments
            ? <div className="bg-card p-3.5"><dt className="text-muted-foreground">Fee due</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{rupees(feeDue)}</dd></div>
            : <div className="bg-card p-3.5"><dt className="text-muted-foreground">Line</dt><dd className="mt-1 text-xl font-medium tabular-nums">{d.student.cutoff}%</dd></div>}
        </dl>
        <p className="pt-1 text-sm text-muted-foreground">Mentor: <span className="text-foreground">{d.student.mentor ?? "None"}</span></p>

        {d.flags.length > 0 && (
          <>
            <SectionHeading title="At risk" count={d.flags.length} />
            {d.flags.map((f, i) => (
              <div key={i} className="rounded-xl bg-late-soft p-3.5 text-sm text-foreground">
                <p>{f.reason}</p>
                {f.source === "llm" && <p className="mt-1 text-xs text-muted-foreground">{SOURCE.llm}</p>}
                {f.taskId && f.taskStatus === "open" && !isAdmin && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => finish(f.taskId!, "done")}>Followed up</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => finish(f.taskId!, "dismissed")}>Dismiss</Button>
                  </div>
                )}
                {f.taskStatus && f.taskStatus !== "open" && <p className="mt-1 text-xs text-muted-foreground">Mentor task {f.taskStatus}</p>}
                {f.taskStatus === "open" && isAdmin && <p className="mt-1 text-xs text-muted-foreground">Mentor task open with {d.student.mentor ?? "no mentor"}</p>}
              </div>
            ))}
          </>
        )}

        <SectionHeading title="Attendance by subject" count={d.subjects.length} />
        {d.subjects.length === 0 ? <p className="text-sm text-muted-foreground">No sessions marked yet.</p> : (
          <ul className="space-y-2.5 text-sm">
            {d.subjects.map((s) => {
              const short = s.percent !== null && s.percent < d.student.cutoff;
              return (
                <li key={s.name} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2"><span className="truncate">{s.name}</span>{short && <StatusPill tone="absent">Shortage</StatusPill>}</span>
                  <AttendanceMeter pct={s.percent} threshold={d.student.cutoff} />
                </li>
              );
            })}
          </ul>
        )}

        <SectionHeading title="Internal marks" />
        {d.marks.length === 0 ? <p className="text-sm text-muted-foreground">No marks entered yet.</p> : (
          <ul className="space-y-1 text-sm">
            {[...new Set(d.marks.map((m) => m.subject))].map((name) => {
              const rows = d.marks.filter((m) => m.subject === name);
              const total = rows.reduce((n, m) => n + (m.marks ?? 0), 0);
              return (
                <li key={name} className="flex items-center justify-between gap-2">
                  <span className="truncate">{name}</span>
                  <span className="flex items-center gap-2">
                    {rows[0].status === "locked" && <StatusPill>Locked</StatusPill>}
                    <span className="tabular-nums">{total}<span className="text-muted-foreground">/40</span></span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {d.instalments && (
          <>
            <SectionHeading title="Fees" count={d.instalments.length} />
            <ul className="space-y-1 text-sm">
              {d.instalments.map((i) => (
                <li key={i.id} className="flex justify-between gap-2"><span>{i.label} <span className="text-muted-foreground">· due {i.dueDate}</span></span><span className="tabular-nums">{rupees(Math.max(0, i.amountPaise - i.scholarshipPaise - i.paidPaise))}</span></li>
              ))}
            </ul>
          </>
        )}

        {isAdmin && (
          <>
            <SectionHeading title="History" count={d.history.length} />
            {d.history.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : (
              <ul className="space-y-1 text-sm">
                {d.history.map((h) => <li key={h.id}><span className="text-muted-foreground">{new Date(h.at).toLocaleDateString("en-IN")}</span> {h.action} by {h.actorName}{h.reason && `: ${h.reason}`}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
    </RecordModal>
  );
}
