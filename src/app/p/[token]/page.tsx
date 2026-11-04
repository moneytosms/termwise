import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { paidSql } from "@/app/(app)/fees/queries";
import { SectionHeading, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { attendancePercent, istDate, isShortage, type AttendanceStatus } from "@/domain/attendance";
import { dues, instalmentDue } from "@/domain/fees";
import { rupees } from "@/lib/utils";
import { db } from "@/server/db";
import { readParentToken } from "@/server/parent-link";
import { attendanceEntry, attendanceSession, batch, campus, feeInstalment, feePayment, programme, student, subject } from "@/server/schema";
import { PayButton } from "./controls";

const EXPIRED = "This link has expired or isn't valid. Ask the college office for a new one.";
const ist = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

// The token is in the URL: keep it out of search engines and Referer headers.
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ParentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const studentId = readParentToken(token);
  if (!studentId) return <main className="mx-auto max-w-xl px-4 py-8"><EmptyState title={EXPIRED} /></main>;

  const [s] = await db.select({
    name: student.name, rollNo: student.rollNo, programme: programme.name, year: batch.year, cutoff: programme.attendanceCutoff, campus: campus.name,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .where(eq(student.id, studentId));
  if (!s) return <main className="mx-auto max-w-xl px-4 py-8"><EmptyState title={EXPIRED} /></main>;

  const att = await db.select({ subject: subject.name, status: attendanceEntry.status, periods: attendanceSession.periodCount })
    .from(attendanceEntry)
    .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .where(eq(attendanceEntry.studentId, studentId));
  const bySubject = new Map<string, { status: AttendanceStatus; periods: number }[]>();
  for (const a of att) bySubject.set(a.subject, [...(bySubject.get(a.subject) ?? []), a]);
  const subjects = [...bySubject].flatMap(([name, rows]) => {
    const percent = attendancePercent(rows);
    return percent === null ? [] : [{ name, percent }];
  }).sort((a, b) => a.name.localeCompare(b.name));
  const overall = attendancePercent(att);

  const instalments = await db.select({
    id: feeInstalment.id, label: feeInstalment.label, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise,
    scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
  }).from(feeInstalment).where(eq(feeInstalment.studentId, studentId)).orderBy(feeInstalment.dueDate);
  const payments = await db.select({ id: feePayment.id, label: feeInstalment.label, amountPaise: feePayment.amountPaise, paidAt: feePayment.paidAt })
    .from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .where(eq(feeInstalment.studentId, studentId))
    .orderBy(desc(feePayment.paidAt));

  const today = istDate();
  const totalDue = dues(instalments, today).totalPaise;

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{s.campus}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground"><span className="font-mono">{s.rollNo}</span> · {s.programme} · Year {s.year}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <p className="rounded-xl border bg-card p-4"><span className="block font-mono text-2xl">{overall ?? "–"}{overall !== null && "%"}</span><span className="text-muted-foreground">Attendance</span></p>
        <p className="rounded-xl border bg-card p-4"><span className="block font-mono text-2xl">{rupees(totalDue)}</span><span className="text-muted-foreground">Fee due</span></p>
      </div>

      <SectionHeading title="Attendance by subject" count={subjects.length} />
      {subjects.length === 0 ? <p className="text-sm text-muted-foreground">No sessions marked yet.</p> : (
        <ul className="space-y-2 text-sm">
          {subjects.map((x) => {
            const short = isShortage(x.percent, s.cutoff);
            return (
              <li key={x.name}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{x.name}</span>
                  <span className="flex items-center gap-2">{short && <StatusPill tone="absent">Shortage</StatusPill>}<span className="font-mono">{x.percent}%</span></span>
                </div>
                <div className="relative mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                  <div className={short ? "h-full rounded-full bg-absent" : "h-full rounded-full bg-primary"} style={{ width: `${x.percent}%` }} />
                  <div className="absolute inset-y-[-2px] w-px bg-foreground" style={{ left: `${s.cutoff}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SectionHeading title="Fees" count={instalments.length} />
      {instalments.length === 0 ? <EmptyState title="No fee records yet." /> : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">Test mode: payments here are simulated. No real money moves.</p>
          <ul className="space-y-3">
            {instalments.map((i) => {
              const due = instalmentDue(i);
              return (
                <li key={i.id} className="rounded-xl border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{i.label} <span className="text-muted-foreground">· due {i.dueDate}</span></span>
                    {due === 0 ? <StatusPill tone="ok">Paid</StatusPill> : i.dueDate < today ? <StatusPill tone="absent">Overdue</StatusPill> : <StatusPill tone="late">Due</StatusPill>}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">Amount</dt><dd className="text-right font-mono">{rupees(i.amountPaise)}</dd>
                    <dt className="text-muted-foreground">Scholarship</dt><dd className="text-right font-mono">{rupees(i.scholarshipPaise)}</dd>
                    <dt className="text-muted-foreground">Paid</dt><dd className="text-right font-mono">{rupees(i.paidPaise)}</dd>
                    <dt className="text-muted-foreground">Due</dt><dd className="text-right font-mono">{rupees(due)}</dd>
                  </dl>
                  {due > 0 && <PayButton token={token} instalmentId={i.id} duePaise={due} />}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <SectionHeading title="Payments" count={payments.length} />
      {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">{p.label}<span className="block text-xs text-muted-foreground">{ist(p.paidAt)}</span></span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono">{rupees(p.amountPaise)}</span>
                <Button size="sm" variant="outline" render={<Link href={`/p/${token}/receipt/${p.id}`} />}>Receipt</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
