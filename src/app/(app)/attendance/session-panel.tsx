"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/states";
import type { AttendanceStatus } from "@/domain/attendance";
import { correctSession } from "./actions";
import type { SessionDetail } from "./queries";

export function SessionPanel({ detail, base }: { detail: SessionDetail | null; base: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>(() =>
    Object.fromEntries((detail?.entries ?? []).map((e) => [e.studentId, e.status])));
  const [reason, setReason] = useState("");
  const close = () => router.push(`/attendance?${base}`, { scroll: false });
  const d = detail;
  const changed = d ? d.entries.filter((e) => statuses[e.studentId] !== e.status).length : 0;

  const save = () => {
    if (!d) return;
    start(async () => {
      const r = await correctSession(d.id, d.entries.map((e) => ({ studentId: e.studentId, status: statuses[e.studentId] })), reason);
      if (r.error) toast.error(r.error);
      else { toast.success("Correction saved."); router.push(`/attendance?${base}`, { scroll: false }); }
    });
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {!d ? (
          <>
            <SheetHeader><SheetTitle>Attendance session</SheetTitle><SheetDescription className="sr-only">Not available</SheetDescription></SheetHeader>
            <div className="px-4"><EmptyState title="This session isn't available." /></div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{d.subject}</SheetTitle>
              <SheetDescription>{d.batch} · {d.date} · Period {d.period} · {d.faculty} · Last edited {d.editedAt}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-8">
              <ul className="divide-y rounded-lg bg-muted/60 text-sm">
                {d.entries.map((e) => (
                  <li key={e.studentId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0"><span className="block tabular-nums text-xs text-muted-foreground">{e.rollNo}</span>{e.name}</span>
                    <select aria-label={`Status for ${e.name}`} value={statuses[e.studentId]} disabled={busy}
                      onChange={(ev) => setStatuses((s) => ({ ...s, [e.studentId]: ev.target.value as AttendanceStatus }))}
                      className="h-9 rounded-lg bg-field pl-3 text-sm shadow-field outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                    </select>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for correction (required)</Label>
                <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{changed} changed</span>
                <Button onClick={save} disabled={busy || changed === 0 || !reason.trim()}>Save correction</Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
