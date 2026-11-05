"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { SectionHeading, StatusPill } from "@/components/page";
import { RecordModal } from "@/components/record-modal";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { istDate } from "@/domain/attendance";
import { instalmentDue } from "@/domain/fees";
import { rupees } from "@/lib/utils";
import { recordPayment } from "./actions";
import type { FeeDetail } from "./queries";

export function FeePanel({ detail }: { detail: FeeDetail | null }) {
  const router = useRouter();
  const close = () => router.push("/fees", { scroll: false });
  const today = istDate();

  if (!detail) {
    return (
      <RecordModal title="Student" description="Not available" onClose={close}>
        <EmptyState title="This student isn't available to you." />
      </RecordModal>
    );
  }

  return (
    <RecordModal
      title={detail.student.name}
      description={<><span className="tabular-nums">{detail.student.rollNo}</span> · {detail.student.batch}</>}
      onClose={close}
      nav={{ key: "fees", id: String(detail.student.id), href: (id) => `/fees?student=${id}` }}>
      <div className="space-y-2 pb-4">
              <SectionHeading title="Instalments" count={detail.instalments.length} />
              {detail.instalments.length === 0 ? <EmptyState title="No fee records yet." /> : (
                <div className="space-y-3">
                  {detail.instalments.map((i) => {
                    const due = instalmentDue(i);
                    return (
                      <div key={i.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{i.label}</span>
                          {due === 0 ? <StatusPill tone="ok">Paid</StatusPill> : i.dueDate < today ? <StatusPill tone="absent">Overdue</StatusPill> : <StatusPill tone="late">Due</StatusPill>}
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                          <dt className="text-muted-foreground">Amount</dt><dd className="text-right tabular-nums">{rupees(i.amountPaise)}</dd>
                          <dt className="text-muted-foreground">Scholarship</dt><dd className="text-right tabular-nums">{rupees(i.scholarshipPaise)}</dd>
                          <dt className="text-muted-foreground">Paid</dt><dd className="text-right tabular-nums">{rupees(i.paidPaise)}</dd>
                          <dt className="text-muted-foreground">Due</dt><dd className="text-right tabular-nums">{rupees(due)}</dd>
                          <dt className="text-muted-foreground">Due date</dt><dd className="text-right tabular-nums">{i.dueDate}</dd>
                        </dl>
                        {due > 0 && <PaymentForm instalmentId={i.id} duePaise={due} />}
                      </div>
                    );
                  })}
                </div>
              )}

              <SectionHeading title="Payments" count={detail.payments.length} />
              {detail.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="rounded-lg bg-muted/60 p-3">
                      <div className="flex justify-between gap-2"><span className="tabular-nums">{rupees(p.amountPaise)}</span><span className="text-muted-foreground">{p.label}</span></div>
                      <p className="text-muted-foreground">
                        {p.mode === "bank_counter" ? "Bank counter" : p.mode} · Ref <span className="tabular-nums">{p.reference}</span> · {p.paidAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
      </div>
    </RecordModal>
  );
}

function PaymentForm({ instalmentId, duePaise }: { instalmentId: number; duePaise: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await recordPayment({ instalmentId, rupees: Number(fd.get("rupees")), reference: String(fd.get("reference")) });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Payment recorded.");
      form.reset();
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`amount-${instalmentId}`}>Amount (₹)</Label>
          <Input id={`amount-${instalmentId}`} name="rupees" type="number" inputMode="decimal" step="0.01" min="0.01" max={duePaise / 100} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ref-${instalmentId}`}>Bank reference</Label>
          <Input id={`ref-${instalmentId}`} name="reference" maxLength={40} required />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={busy}>Record payment</Button>
    </form>
  );
}
