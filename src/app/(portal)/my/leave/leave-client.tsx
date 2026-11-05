"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormDialog, Field } from "@/app/(app)/setup/shared";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyLeave, parentDecide, withdrawLeave } from "./actions";

export function ApplyLeave() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Apply for leave</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Apply for leave" submitLabel="Apply"
        description="Starts up to a week ago, up to 31 days long."
        action={async (fd) => {
          const r = await applyLeave({
            kind: String(fd.get("kind")), fromDate: String(fd.get("fromDate")),
            toDate: String(fd.get("toDate")), reason: String(fd.get("reason")),
          });
          if (!r.error) toast.success("Leave applied. Waiting for your parent.");
          return r;
        }}>
        <Field label="Type">
          <SelectField name="kind" required aria-label="Type" defaultValue="leave"
            options={[{ value: "leave", label: "Leave" }, { value: "medical", label: "Medical" }]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input name="fromDate" type="date" required /></Field>
          <Field label="To"><Input name="toDate" type="date" required /></Field>
        </div>
        <Field label="Reason">
          <Textarea name="reason" required minLength={5} maxLength={500} rows={3} />
        </Field>
      </FormDialog>
    </>
  );
}

export function WithdrawLeave({ id }: { id: number }) {
  const [busy, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={busy}
      onClick={() => start(async () => {
        const r = await withdrawLeave(id);
        if (r.error) toast.error(r.error);
        else toast.success("Request withdrawn.");
      })}>
      Withdraw
    </Button>
  );
}

export function DecideLeave({ id }: { id: number }) {
  const [busy, start] = useTransition();
  const [note, setNote] = useState("");
  const decide = (approve: boolean) => start(async () => {
    const r = await parentDecide(id, approve, note);
    if (r.error) toast.error(r.error);
    else toast.success(approve ? "Sent to the mentor." : "Leave rejected.");
  });
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Label htmlFor={`note-${id}`}>Note (optional)</Label>
      <Textarea id={`note-${id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => decide(true)}>Approve</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(false)}>Reject</Button>
      </div>
    </div>
  );
}
