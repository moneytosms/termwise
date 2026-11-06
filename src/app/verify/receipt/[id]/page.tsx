import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { receiptHash } from "@/domain/receipt";
import { db } from "@/server/db";
import { batch, campus, feeInstalment, feePayment, programme, student } from "@/server/schema";

export const dynamic = "force-dynamic";

const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "Ankit Kumar Panda" -> "Ankit P." */
const mask = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
};

function matches(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function VerifyReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ h?: string }>;
}) {
  const { id } = await params;
  const { h } = await searchParams;

  const [r] = /^\d{1,9}$/.test(id) ? await db.select({
    id: feePayment.id, amountPaise: feePayment.amountPaise, mode: feePayment.mode, reference: feePayment.reference, paidAt: feePayment.paidAt,
    label: feeInstalment.label, name: student.name, rollNo: student.rollNo, campus,
  }).from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .where(eq(feePayment.id, Number(id))) : [];

  const valid = !!r && !!h && matches(h, receiptHash({
    id: r.id, rollNo: r.rollNo, amountPaise: r.amountPaise, paidAt: r.paidAt, reference: r.reference, mode: r.mode, instalment: r.label,
  }));

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <article className="grid gap-6 rounded-md border bg-card p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing for next/image to optimise */}
        {valid && r.campus.logoDataUrl && <img src={r.campus.logoDataUrl} alt="" className="mx-auto h-16 object-contain" />}
        {valid ? (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-emerald-700">Valid receipt</p>
              <p className="mt-1 text-lg font-semibold">{r.campus.legalName ?? r.campus.name}</p>
            </div>
            <dl className="divide-y text-sm">
              {[
                ["Receipt no", `R-${String(r.id).padStart(6, "0")}`],
                ["Amount", inr(r.amountPaise)],
                ["Date", r.paidAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })],
                ["Student", mask(r.name)],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-center font-medium">This receipt could not be verified.</p>
        )}
      </article>
    </main>
  );
}
