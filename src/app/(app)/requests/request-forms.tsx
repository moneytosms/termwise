"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceStatus } from "@/domain/attendance";
import { decideAppeal } from "./appeal-actions";
import { closeRequest, decideLeave } from "./actions";

export function LeaveDecision({ id }: { id: number }) {
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
      <Textarea aria-label="Note to student (optional)" placeholder="Note to student (optional)" rows={2} maxLength={500}
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => decide("approved")}>Approve</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("rejected")}>Reject</Button>
      </div>
    </div>
  );
}

export function CloseRequest({ id }: { id: number }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start(async () => {
      const r = await closeRequest({ id, reply });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Marked done.");
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t pt-3">
      <Textarea aria-label="Reply (optional)" placeholder="Reply (optional)" rows={2} maxLength={500}
        value={reply} onChange={(e) => setReply(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>Mark done</Button>
    </form>
  );
}

/** Accept needs the corrected mark or status; reject needs a response. */
export function AppealDecision({ id, kind, max }: { id: number; kind: "mark" | "attendance"; max: number }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [value, setValue] = useState(kind === "mark" ? "" : "present");
  const [busy, start] = useTransition();
  const decide = (action: "accept" | "reject") => start(async () => {
    const newValue = action === "reject" ? undefined
      : kind === "mark" ? (value === "" ? undefined : Number(value)) : (value as AttendanceStatus);
    const r = await decideAppeal(id, action, response, newValue);
    if (r.error) { toast.error(r.error); return; }
    toast.success(action === "accept" ? "Appeal accepted." : "Appeal rejected.");
    router.refresh();
  });
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {kind === "mark" ? (
        <Input type="number" aria-label="Corrected marks" placeholder={`Corrected marks, 0 to ${max}`} min={0} max={max} step="any"
          value={value} onChange={(e) => setValue(e.target.value)} />
      ) : (
        <select aria-label="Corrected status" value={value} onChange={(e) => setValue(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm">
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
        </select>
      )}
      <Textarea aria-label="Response (required to reject)" placeholder="Response (required to reject)" rows={2} maxLength={500}
        value={response} onChange={(e) => setResponse(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => decide("accept")}>Accept</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("reject")}>Reject</Button>
      </div>
    </div>
  );
}
