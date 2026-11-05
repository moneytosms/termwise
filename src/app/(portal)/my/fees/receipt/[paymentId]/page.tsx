import Link from "next/link";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { amountInWords, receiptHash } from "@/domain/receipt";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { batch, campus, feeInstalment, feePayment, programme, student } from "@/server/schema";
import { PrintButton } from "../../controls";

const NOT_HERE = "This receipt isn't available on your account.";
const MODE = { mock_link: "Test payment link", bank_counter: "Bank counter" } as const;
const ist = (d: Date, style: "date" | "time") => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...(style === "date" ? { dateStyle: "medium" } : { timeStyle: "short" }) });
const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const v = await requirePortal();
  const { paymentId } = await params;

  const [r] = /^\d{1,9}$/.test(paymentId) ? await db.select({
    id: feePayment.id, amountPaise: feePayment.amountPaise, mode: feePayment.mode, reference: feePayment.reference, paidAt: feePayment.paidAt,
    label: feeInstalment.label, name: student.name, rollNo: student.rollNo, batch: batch.code, programme: programme.name, campus,
  }).from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .where(and(eq(feePayment.id, Number(paymentId)), eq(feeInstalment.studentId, v.studentId))) : [];
  if (!r) return <main className="mx-auto max-w-xl px-4 py-8"><EmptyState title={NOT_HERE} /></main>;

  const c = r.campus;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost"}`;
  const hash = receiptHash({ id: r.id, rollNo: r.rollNo, amountPaise: r.amountPaise, paidAt: r.paidAt, reference: r.reference, mode: r.mode, instalment: r.label });
  const verifyUrl = `${origin}/verify/receipt/${r.id}?h=${hash}`;
  const qr = await QRCode.toString(verifyUrl, { type: "svg", margin: 0 });
  const grouped = hash.slice(0, 32).replace(/(.{4})(?=.)/g, "$1 ");

  const address = [c.addressLine1, c.addressLine2, [c.city, c.state, c.pincode].filter(Boolean).join(", ")].filter(Boolean);
  const contact = [c.phone, c.email, c.website].filter(Boolean).join(" · ");
  const regs = [c.registrationNo && `Registration no: ${c.registrationNo}`, c.gstin && `GSTIN: ${c.gstin}`].filter(Boolean);
  const rows: [string, string][] = [
    ["Date", ist(r.paidAt, "date")],
    ["Student", r.name],
    ["Roll no", r.rollNo],
    ["Programme / batch", `${r.programme} · ${r.batch}`],
    ["Instalment", r.label],
    ["Mode", MODE[r.mode]],
    ["Reference", r.reference],
    ["Paid at", ist(r.paidAt, "time") + " IST"],
  ];

  return (
    <main className="mx-auto max-w-xl px-4 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my/fees" />}>Back to fees</Button>
        <PrintButton />
      </div>
      <article className="receipt mx-auto flex w-full max-w-[210mm] flex-col gap-6 border bg-card p-6 print:border-0 print:p-0">
        <header className="flex gap-4 border-b pb-4">
          {c.logoDataUrl && <img src={c.logoDataUrl} alt="" className="size-20 shrink-0 object-contain" />}
          <div className="min-w-0 flex-1 space-y-0.5 text-sm">
            <p className="text-lg font-semibold">{c.legalName ?? c.name}</p>
            {c.tagline && <p className="italic text-muted-foreground">{c.tagline}</p>}
            {c.affiliation && <p>{c.affiliation}</p>}
            {address.map((a) => <p key={a}>{a}</p>)}
            {contact && <p>{contact}</p>}
            {regs.length > 0 && <p>{regs.join(" · ")}</p>}
          </div>
        </header>

        <div>
          <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.02em]">Fee Receipt</h1>
          <p className="tabular-nums text-sm text-muted-foreground">Receipt no R-{String(r.id).padStart(6, "0")}</p>
        </div>

        <dl className="divide-y text-sm">
          {rows.map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-1 border-y py-3">
          <p className="flex justify-between text-base font-semibold"><span>Amount received</span><span className="tabular-nums">{inr(r.amountPaise)}</span></p>
          <p className="text-sm">{amountInWords(r.amountPaise)}</p>
        </div>

        <div className="flex items-end gap-4">
          <div className="size-24 shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} aria-label="Scan to verify this receipt" role="img" />
          <div className="min-w-0 space-y-1 text-xs">
            <p className="text-muted-foreground">Verification hash</p>
            <p className="font-mono break-all">{grouped}</p>
            <p className="text-muted-foreground">Scan the code or <a href={verifyUrl} className="underline underline-offset-4">open the verify page</a> to check this receipt.</p>
          </div>
        </div>

        {r.mode === "mock_link" && <p className="text-xs text-muted-foreground">Test receipt. No real money moved.</p>}

        <footer className="mt-auto space-y-3 border-t pt-4 text-xs text-muted-foreground">
          {c.receiptFooter && <p className="whitespace-pre-line">{c.receiptFooter}</p>}
          <p className="flex items-center gap-2"><Mark className="size-4" /> Generated by Termwise</p>
        </footer>
      </article>

      <style>{`
        @page { size: A4; margin: 12mm; }
        .receipt { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        @media print {
          .no-print { display: none !important; }
          .receipt { box-shadow: none !important; min-height: 0; }
        }
      `}</style>
    </main>
  );
}
