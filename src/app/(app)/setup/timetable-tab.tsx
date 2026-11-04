"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSlot, saveSlot } from "./actions";
import { Field, FormDialog, fieldCls } from "./shared";

type Slot = {
  id: number; dayOfWeek: number; period: number; periodCount: number; startTime: string; endTime: string;
  subjectId: number | null; subject: string | null; label: string | null;
};

/** Day numbers follow the database: 0 is Sunday. The grid starts on Monday. */
const DAYS = [
  { n: 1, short: "Mon", long: "Monday" }, { n: 2, short: "Tue", long: "Tuesday" }, { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" }, { n: 5, short: "Fri", long: "Friday" }, { n: 6, short: "Sat", long: "Saturday" },
  { n: 0, short: "Sun", long: "Sunday" },
];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

type Cell = { dayOfWeek: number; period: number; slot?: Slot };

export function TimetableTab({ batches, batchId, slots, subjects }: {
  batches: { id: number; code: string }[];
  batchId: number;
  slots: Slot[];
  subjects: { id: number; code: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Cell | null>(null);
  const [busy, start] = useTransition();
  const byCell = new Map(slots.map((s) => [`${s.dayOfWeek}-${s.period}`, s]));
  // Periods a lab spans after its first one belong to that lab's cell.
  const covered = new Set(slots.flatMap((s) => Array.from({ length: s.periodCount - 1 }, (_, i) => `${s.dayOfWeek}-${s.period + i + 1}`)));
  const slot = editing?.slot;

  function remove() {
    if (!editing) return;
    const { dayOfWeek, period } = editing;
    start(async () => {
      const r = await deleteSlot({ batchId, dayOfWeek, period });
      if (r.error) toast.error(r.error);
      else setEditing(null);
    });
  }

  return (
    <>
      <label className="mb-4 flex items-center gap-2 text-sm font-medium">
        Batch
        <select value={batchId} onChange={(e) => router.push(`/setup?tab=timetable&batch=${e.target.value}`)} className={`${fieldCls} w-auto`}>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
      </label>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="w-16 p-2 font-medium">Period</th>
              {DAYS.map((d) => <th key={d.n} scope="col" className="p-2 font-medium">{d.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p} className="border-b last:border-0">
                <th scope="row" className="p-2 text-left font-mono font-medium">{p}</th>
                {DAYS.map((d) => {
                  if (covered.has(`${d.n}-${p}`)) return null;
                  const s = byCell.get(`${d.n}-${p}`);
                  return (
                    <td key={d.n} rowSpan={s?.periodCount ?? 1} className="p-1 align-top">
                      <button type="button" aria-label={`${d.long}, period ${p}${s ? `: ${s.subject ?? s.label}` : ""}`}
                        onClick={() => setEditing({ dayOfWeek: d.n, period: p, slot: s })}
                        className="flex h-full min-h-14 w-full min-w-24 flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors hover:bg-muted">
                        {s ? (
                          <>
                            <span className="font-medium">{s.subject ?? s.label}</span>
                            <span className="font-mono text-xs text-muted-foreground">{s.startTime}</span>
                          </>
                        ) : <span className="text-muted-foreground">Add</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `${DAYS.find((d) => d.n === editing.dayOfWeek)?.long}, period ${editing.period}` : "Slot"}
        description="A slot with a label and no subject takes no attendance."
        submitLabel="Save" action={saveSlot}
        footerStart={slot && <Button type="button" variant="destructive" disabled={busy} onClick={remove}>Remove</Button>}>
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="dayOfWeek" value={editing?.dayOfWeek ?? 1} />
        <input type="hidden" name="period" value={editing?.period ?? 1} />
        <Field label="Subject">
          <select name="subjectId" defaultValue={slot?.subjectId ?? ""} className={fieldCls}>
            <option value="">No subject (label only)</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select>
        </Field>
        <Field label="Label" hint="For club, sports or interaction slots with no subject.">
          <Input name="label" placeholder="Club activity" maxLength={60} defaultValue={slot?.label ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input name="startTime" type="time" required defaultValue={slot?.startTime ?? ""} />
          </Field>
          <Field label="End">
            <Input name="endTime" type="time" required defaultValue={slot?.endTime ?? ""} />
          </Field>
        </div>
        <Field label="Periods covered" hint="1 for a normal period. Use 2 or more for a lab.">
          <Input name="periodCount" type="number" min={1} max={9} required defaultValue={slot?.periodCount ?? 1} />
        </Field>
      </FormDialog>
    </>
  );
}
