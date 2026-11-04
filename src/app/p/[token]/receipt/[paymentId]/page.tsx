import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { rupees } from "@/lib/utils";
import { db } from "@/server/db";
import { readParentToken } from "@/server/parent-link";
import { batch, campus, feeInstalment, feePayment, programme, student } from "@/server/schema";
import { PrintButton } from "../../controls";

const EXPIRED = "This link has expired or isn't valid. Ask the college office for a new one.";
const NOT_HERE = "This receipt isn't available on this link.";
const MODE = { mock_link: "Test payment link", bank_counter: "Bank counter" } as const;

// The token is in the URL: keep it out of search engines and Referer headers.
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string; paymentId: string }> }) {
  const { token, paymentId } = await params;
  const studentId = readParentToken(token);
  if (!studentId) return <main className="mx-auto max-w-xl px-4 py-8"><EmptyState title={EXPIRED} /></main>;

  const [r] = /^\d{1,9}$/.test(paymentId) ? await db.select({
    id: feePayment.id, amountPaise: feePayment.amountPaise, mode: feePayment.mode, reference: feePayment.reference, paidAt: feePayment.paidAt,
    label: feeInstalment.label, name: student.name, rollNo: student.rollNo, campus: campus.name,
  }).from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .where(and(eq(feePayment.id, Number(paymentId)), eq(student.id, studentId))) : [];
  if (!r) return <main className="mx-auto max-w-xl px-4 py-8"><EmptyState title={NOT_HERE} /></main>;

  const rows: [string, string][] = [
    ["Student", r.name],
    ["Roll no", r.rollNo],
    ["Instalment", r.label],
    ["Amount", rupees(r.amountPaise)],
    ["Mode", MODE[r.mode]],
    ["Reference", r.reference],
    ["Paid at", r.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST"],
  ];

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" render={<Link href={`/p/${token}`} />}>Back to fees</Button>
        <PrintButton />
      </div>
      <article className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">{r.campus}</p>
        <h1 className="text-xl font-semibold tracking-tight">Fee receipt</h1>
        <p className="font-mono text-sm text-muted-foreground">R-{String(r.id).padStart(6, "0")}</p>
        <dl className="mt-6 divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-mono">{v}</dd>
            </div>
          ))}
        </dl>
        {r.mode === "mock_link" && <p className="mt-6 text-xs text-muted-foreground">Test receipt. No real money moved.</p>}
      </article>
      <style>{`@media print { .no-print { display: none !important; } article { border: 0; } }`}</style>
    </main>
  );
}
