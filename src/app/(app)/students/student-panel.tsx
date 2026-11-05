"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/states";
import { AttendanceMeter, SectionHeading, StatusPill } from "@/components/page";
import { Initials } from "./students-table";
import { dues } from "@/domain/fees";
import { istDate } from "@/domain/attendance";
import { rupees } from "@/lib/utils";
import { closeMentorTask } from "./actions";
import type { StudentDetail } from "./queries";

export function StudentPanel({ detail, isAdmin }: { detail: StudentDetail | null; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const close = () => router.push("/students", { scroll: false });
  const d = detail;

  const finish = (taskId: number, status: "done" | "dismissed") => start(async () => {
    const r = await closeMentorTask(taskId, status);
    if (r.error) toast.error(r.error); else router.refresh();
  });

  return (
    <Sheet open onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {!d ? (
          <>
            <SheetHeader><SheetTitle>Student</SheetTitle><SheetDescription className="sr-only">Not available</SheetDescription></SheetHeader>
            <div className="px-4"><EmptyState title="This student isn't available to you." /></div>
          </>
        ) : (
          <>
            <SheetHeader className="flex-row items-center gap-3 border-b border-border pb-4">
              <Initials name={d.student.name} />
              <div className="min-w-0">
                <SheetTitle className="text-lg">{d.student.name}</SheetTitle>
                <SheetDescription>{d.student.rollNo} · {d.student.programme} · Year {d.student.year}</SheetDescription>
              </div>
            </SheetHeader>
            <div className="space-y-2 px-4 pb-8">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm shadow-sheet">
                <div className="bg-card p-3.5"><dt className="text-muted-foreground">Attendance</dt><dd className={`mt-1 text-xl font-medium tabular-nums ${d.overall !== null && d.overall < d.student.cutoff ? "text-absent" : ""}`}>{d.overall ?? "–"}{d.overall !== null && "%"}</dd></div>
                {d.instalments
                  ? <div className="bg-card p-3.5"><dt className="text-muted-foreground">Fee due</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{rupees(dues(d.instalments, istDate()).totalPaise)}</dd></div>
                  : <div className="bg-card p-3.5"><dt className="text-muted-foreground">Line</dt><dd className="mt-1 text-xl font-medium tabular-nums">{d.student.cutoff}%</dd></div>}
              </dl>
              <p className="pt-1 text-sm text-muted-foreground">Mentor: <span className="text-foreground">{d.student.mentor ?? "None"}</span></p>

              {d.flags.length > 0 && (
                <>
                  <SectionHeading title="At risk" count={d.flags.length} />
                  {d.flags.map((f, i) => (
                    <div key={i} className="rounded-xl bg-late-soft p-3.5 text-sm text-foreground">
                      <p>{f.reason}</p>
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
