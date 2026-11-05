"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABEL, type LeaveKind } from "@/domain/staff-leave";
import { applyLeave, decideLeave, withdrawLeave } from "./actions";

export function ApplyForm() {
  const router = useRouter();
  const [kind, setKind] = useState<LeaveKind>("casual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start(async () => {
      const r = await applyLeave({ kind, from, to, reason });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Leave applied. The office will decide.");
      setFrom("");
      setTo("");
      setReason("");
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)}
            className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm">
            {(Object.keys(KIND_LABEL) as LeaveKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">From</span>
          <Input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">To</span>
          <Input type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <Textarea aria-label="Reason" placeholder="Reason" rows={2} maxLength={500} required
        value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>Apply</Button>
    </form>
  );
}

export function WithdrawButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const withdraw = () => start(async () => {
    const r = await withdrawLeave(id);
    if (r.error) { toast.error(r.error); return; }
    toast.success("Leave withdrawn.");
    router.refresh();
  });
  return <Button size="sm" variant="outline" disabled={busy} onClick={withdraw}>Withdraw</Button>;
}

/** The note is optional when approving and required when rejecting. */
export function DecideForm({ id }: { id: number }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  const decide = (decision: "approved" | "rejected") => start(async () => {
    const r = await decideLeave({ id, decision, note });
    if (r.error) { toast.error(r.error); return; }
    toast.success(decision === "approved" ? "Leave approved." : "Leave rejected.");
    router.refresh();
  });
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Textarea aria-label="Note to staff (required to reject)" placeholder="Note to staff (required to reject)" rows={2} maxLength={500}
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => decide("approved")}>Approve</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("rejected")}>Reject</Button>
      </div>
    </div>
  );
}
