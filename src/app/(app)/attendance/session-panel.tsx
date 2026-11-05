"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/states";
import { RecordModal } from "@/components/record-modal";
import { SelectField } from "@/components/select-field";
import type { AttendanceStatus } from "@/domain/attendance";
import { correctSession } from "./actions";
import type { SessionDetail } from "./queries";

const STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
];

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
    <RecordModal
      title={d ? d.subject : "Attendance session"}
      description={d && `${d.batch} · ${d.date} · Period ${d.period} · ${d.faculty} · Last edited ${d.editedAt}`}
      nav={d ? { key: "sessions", id: d.id, href: (id) => `/attendance?${base}&session=${id}` } : undefined}
      onClose={close}
      footer={d && (
        <>
          <span className="mr-auto self-center text-sm text-muted-foreground">{changed} changed</span>
          <Button onClick={save} disabled={busy || changed === 0 || !reason.trim()}>Save correction</Button>
        </>
      )}>
      {!d ? <EmptyState title="This session isn't available." /> : (
        <div className="space-y-4">
          <ul className="divide-y rounded-lg bg-muted/60 text-sm">
            {d.entries.map((e) => (
              <li key={e.studentId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0"><span className="block tabular-nums text-xs text-muted-foreground">{e.rollNo}</span>{e.name}</span>
                <SelectField aria-label={`Status for ${e.name}`} options={STATUS_OPTIONS} value={statuses[e.studentId]}
                  onValueChange={(v) => { if (!busy) setStatuses((s) => ({ ...s, [e.studentId]: v as AttendanceStatus })); }} />
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for correction (required)</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          </div>
        </div>
      )}
    </RecordModal>
  );
}
