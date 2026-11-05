"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
