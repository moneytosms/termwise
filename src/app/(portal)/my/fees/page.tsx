import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { paidSql } from "@/app/(app)/fees/queries";
import { PageHeader, SectionHeading, StatCard, StatStrip, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { istDate } from "@/domain/attendance";
import { dues, instalmentDue } from "@/domain/fees";
import { rupees } from "@/lib/utils";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { feeInstalment, feePayment } from "@/server/schema";
import { PayButton } from "./controls";

const ist = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function FeesPage() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  if (!s) return <EmptyState title="No student record found." />;
  const first = s.name.split(" ")[0];
  const you = (self: string, parent: string) => (v.role === "parent" ? parent : self);

  const instalments = await db.select({
    id: feeInstalment.id, label: feeInstalment.label, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise,
    scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
  }).from(feeInstalment).where(eq(feeInstalment.studentId, v.studentId)).orderBy(feeInstalment.dueDate);
  const payments = await db.select({ id: feePayment.id, label: feeInstalment.label, amountPaise: feePayment.amountPaise, paidAt: feePayment.paidAt })
    .from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .where(eq(feeInstalment.studentId, v.studentId))
    .orderBy(desc(feePayment.paidAt));

  const today = istDate();
  const year = today.slice(0, 4);
  const { totalPaise, overduePaise } = dues(instalments, today);
  const overdueCount = instalments.filter((i) => instalmentDue(i) > 0 && i.dueDate < today).length;
  const paidThisYear = payments.filter((p) => istDate(p.paidAt).slice(0, 4) === year).reduce((n, p) => n + p.amountPaise, 0);
  const scholarship = instalments.reduce((n, i) => n + i.scholarshipPaise, 0);

  return (
    <>
      <PageHeader title="Fees" description="Test mode: payments are simulated." />

      <StatStrip>
        <StatCard label={you("Total due", `${first}'s total due`)} value={rupees(totalPaise)} hint={overduePaise ? `${rupees(overduePaise)} overdue` : undefined} tone={overduePaise ? "absent" : "default"} />
        <StatCard label="Overdue instalments" value={overdueCount} tone={overdueCount ? "absent" : "default"} />
        <StatCard label={`Paid in ${year}`} value={rupees(paidThisYear)} />
        <StatCard label="Scholarship" value={rupees(scholarship)} />
      </StatStrip>

      <SectionHeading title={you("Your instalments", `${first}'s instalments`)} count={instalments.length} />
      {instalments.length === 0 ? <EmptyState title="No fee records yet." /> : (
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
                {due > 0 && <PayButton instalmentId={i.id} duePaise={due} />}
              </li>
            );
          })}
        </ul>
      )}

      <SectionHeading title={you("Your payments", `${first}'s payments`)} count={payments.length} />
      {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
        <ul className="divide-y divide-rule rounded-xl bg-card text-sm shadow-sheet">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">{p.label}<span className="block text-xs text-muted-foreground">{ist(p.paidAt)}</span></span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-medium tabular-nums">{rupees(p.amountPaise)}</span>
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/my/fees/receipt/${p.id}`} />}>Receipt</Button>
                </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
