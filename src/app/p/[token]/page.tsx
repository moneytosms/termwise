import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { paidSql } from "@/app/(app)/fees/queries";
import { AttendanceMeter, SectionHeading, StatusPill } from "@/components/page";
import { CountUp } from "@/components/count-up";
import { Mark } from "@/components/mark";
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

  const shortSubjects = subjects.filter((x) => isShortage(x.percent, s.cutoff));
  const finding = overall === null ? "No classes marked yet."
    : shortSubjects.length > 0 ? `Below the ${s.cutoff}% line in ${shortSubjects.map((x) => x.name).join(", ")}.`
    : `Above the ${s.cutoff}% line in every subject.`;
  const overdue = instalments.filter((i) => instalmentDue(i) > 0 && i.dueDate < today).length;

  return (
    <main className="mx-auto max-w-xl px-4 pt-5 pb-12 md:pt-10">
      <p className="mb-8 flex items-center gap-2 text-sm text-muted-foreground"><Mark className="size-6" /><span className="font-semibold text-foreground">Termwise</span> · {s.campus}</p>
      <header>
        <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em] md:text-[1.75rem]">{s.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{s.rollNo} · {s.programme} · Year {s.year}</p>
      </header>

      <section className="mt-6 overflow-hidden rounded-2xl bg-card shadow-sheet" aria-label="Summary">
        <div className="p-5">
          <p className="text-sm text-muted-foreground">Attendance, all subjects</p>
          <p className={`mt-1 text-[2.5rem] leading-none font-medium tracking-[-0.03em] tabular-nums ${overall !== null && isShortage(overall, s.cutoff) ? "text-absent" : ""}`}>
            {overall === null ? "–" : <CountUp value={overall} decimals={1} suffix="%" />}
          </p>
          {overall !== null && (
            <div className="relative mt-5 h-2.5 rounded-full bg-secondary" aria-hidden>
              <div className={`h-full origin-left animate-[grow-x_900ms_cubic-bezier(0.25,1,0.5,1)_both] rounded-full ${isShortage(overall, s.cutoff) ? "bg-absent" : "bg-data"}`} style={{ width: `${overall}%` }} />
              <div className="absolute -inset-y-1.5 w-0.5 rounded bg-foreground" style={{ left: `${s.cutoff}%` }} />
              <span className="absolute top-5 -translate-x-1/2 text-xs text-muted-foreground" style={{ left: `${s.cutoff}%` }}>{s.cutoff}% line</span>
            </div>
          )}
          <p className="mt-9 text-sm">{finding}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50 px-5 py-4">
          <span className="text-sm text-muted-foreground">Fee due</span>
          <span className="flex items-center gap-2">
            {overdue > 0 && <StatusPill tone="absent">{overdue} overdue</StatusPill>}
            <span className="text-xl font-semibold tabular-nums">{rupees(totalDue)}</span>
          </span>
        </div>
      </section>

      <SectionHeading title="Attendance by subject" count={subjects.length} />
      {subjects.length === 0 ? <p className="text-sm text-muted-foreground">No sessions marked yet.</p> : (
        <ul className="divide-y divide-rule rounded-xl bg-card px-4 text-sm shadow-sheet">
          {subjects.map((x) => {
            const short = isShortage(x.percent, s.cutoff);
            return (
              <li key={x.name} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2"><span className="truncate">{x.name}</span>{short && <StatusPill tone="absent">Shortage</StatusPill>}</span>
                <AttendanceMeter pct={x.percent} threshold={s.cutoff} />
              </li>
            );
          })}
        </ul>
      )}

      <SectionHeading title="Fees" count={instalments.length} />
      {instalments.length === 0 ? <EmptyState title="No fee records yet." /> : (
        <>
          <ul className="space-y-2">
            {instalments.map((i) => {
              const due = instalmentDue(i);
              return (
                <li key={i.id} className="rounded-xl bg-card p-4 text-sm shadow-sheet">
                  <div className="flex items-center justify-between gap-2">
                    <span><span className="font-medium">{i.label}</span><span className="block text-xs text-muted-foreground">Due {i.dueDate}</span></span>
                    {due === 0 ? <StatusPill tone="ok">Paid</StatusPill> : i.dueDate < today ? <StatusPill tone="absent">Overdue</StatusPill> : <StatusPill tone="late">Due</StatusPill>}
                  </div>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
                    <dt className="text-muted-foreground">Amount</dt><dd className="text-right">{rupees(i.amountPaise)}</dd>
                    <dt className="text-muted-foreground">Scholarship</dt><dd className="text-right">{i.scholarshipPaise ? `−${rupees(i.scholarshipPaise)}` : rupees(0)}</dd>
                    <dt className="text-muted-foreground">Paid</dt><dd className="text-right">{i.paidPaise ? `−${rupees(i.paidPaise)}` : rupees(0)}</dd>
                    <dt className="pt-1 font-medium">Due</dt><dd className="pt-1 text-right font-semibold">{rupees(due)}</dd>
                  </dl>
                  {due > 0 && <PayButton token={token} instalmentId={i.id} duePaise={due} />}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Test mode: payments here are simulated. No real money moves.</p>
        </>
      )}

      <SectionHeading title="Payments" count={payments.length} />
      {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
        <ul className="divide-y divide-rule rounded-xl bg-card text-sm shadow-sheet">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">{p.label}<span className="block text-xs text-muted-foreground">{ist(p.paidAt)}</span></span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-medium tabular-nums">{rupees(p.amountPaise)}</span>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/p/${token}/receipt/${p.id}`} />}>Receipt</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-10 text-xs text-muted-foreground">Read-only view from {s.campus}. This link expires; ask the college office for a new one.</p>
    </main>
  );
}
