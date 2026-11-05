"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { RecordModal } from "@/components/record-modal";
import { SectionHeading, StatusPill } from "@/components/page";
import { resolveConflict } from "./actions";
import type { ConflictDetail } from "./queries";
import { CONFLICT_STATUS, KIND_LABEL, StatusWord } from "./shared";

export function ConflictPanel({ detail, base, readOnly = false }: { detail: ConflictDetail | null; base: string; readOnly?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const close = () => router.push(`/attendance?${base}`, { scroll: false });

  const resolve = (id: string, choice: "keep" | "replace") => start(async () => {
    const r = await resolveConflict(id, choice);
    if (r.error) toast.error(r.error);
    else { toast.success(choice === "keep" ? "Kept the saved session." : "Replaced with the incoming session."); router.push(`/attendance?${base}`, { scroll: false }); }
  });

  const d = detail;
  return (
    <RecordModal
      title={d ? KIND_LABEL[d.kind] : "Conflict"}
      description={d && `${d.classLabel} · ${d.date} · Submitted by ${d.submitter} at ${d.submittedAt}`}
      nav={d ? { key: "conflicts", id: d.id, href: (id) => `/attendance?${base}&conflict=${id}` } : undefined}
      onClose={close}
      footer={!readOnly && d?.status === "open" && (
        <>
          <Button variant="outline" disabled={busy} onClick={() => resolve(d.id, "keep")}>Keep saved</Button>
          <Button disabled={busy} onClick={() => resolve(d.id, "replace")}>Use this one</Button>
        </>
      )}>
      {!d ? <EmptyState title="This conflict isn't available to you." /> : (
        <div className="space-y-4">
          {d.status !== "open" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">Resolved <StatusPill tone={CONFLICT_STATUS[d.status].tone}>{CONFLICT_STATUS[d.status].label}</StatusPill></p>
          )}
          <p className="text-sm text-muted-foreground">
            {d.isNew ? "No session is saved for this class yet. Use this one creates it." : "Students whose status differs between the saved session and this submission."}
          </p>

          <SectionHeading title="Differences" count={d.diffs.length} />
          {d.diffs.length === 0 ? <EmptyState title="No students differ. Both versions match." /> : (
            <div className="overflow-hidden rounded-lg bg-muted/60 text-sm">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                <span>Student</span><span>Saved</span><span>Incoming</span>
              </div>
              <ul className="divide-y">
                {d.diffs.map((x) => (
                  <li key={x.rollNo} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2">
                    <span className="min-w-0"><span className="block tabular-nums text-xs text-muted-foreground">{x.rollNo}</span>{x.name}</span>
                    <StatusWord status={x.saved} />
                    <StatusWord status={x.incoming} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </RecordModal>
  );
}
