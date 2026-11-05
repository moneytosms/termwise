"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { canEditMarks, INTERNAL_TOTAL, validateComponents, validateMark, type MarksAction, type Role } from "@/domain/marks";
import { EmptyState } from "@/components/states";
import type { SheetData } from "../queries";
import { saveComponents, saveMarks, transitionMarks } from "../actions";
import { STATUS } from "../shared";

const key = (componentId: number, studentId: number) => `${componentId}:${studentId}`;
const parse = (s: string) => (s.trim() === "" ? null : Number(s));

export function MarksSheet({ data, role }: { data: SheetData; role: Role }) {
  const { subject: s, components, students } = data;
  const router = useRouter();
  const [busy, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [part, setPart] = useState(components[0]?.id ?? 0);
  const [reasonFor, setReasonFor] = useState<MarksAction | null>(null);
  const [why, setWhy] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const saved = useMemo(() => new Map(data.marks.map((m) => [key(m.componentId, m.studentId), m.marks])), [data.marks]);
  const maxOf = new Map(components.map((c) => [c.id, c.maxMarks]));
  const editable = canEditMarks(s.status, role);

  const shown = (c: number, st: number) => {
    const k = key(c, st);
    return k in drafts ? drafts[k] : (saved.get(k)?.toString() ?? "");
  };
  const errors = new Map<string, string>();
  for (const [k, str] of Object.entries(drafts)) {
    const err = validateMark(parse(str), maxOf.get(Number(k.split(":")[0])) ?? 0);
    if (err) errors.set(k, err);
  }
  const changes = Object.entries(drafts).flatMap(([k, str]) => {
    const [componentId, studentId] = k.split(":").map(Number);
    const value = parse(str);
    return value === (saved.get(k) ?? null) ? [] : [{ componentId, studentId, value }];
  });
  const total = (st: number) => components.reduce((n, c) => {
    const k = key(c.id, st);
    const v = k in drafts ? parse(drafts[k]) : (saved.get(k) ?? null);
    return v !== null && Number.isFinite(v) ? n + v : n;
  }, 0);
  const edit = (k: string, v: string) => setDrafts((d) => ({ ...d, [k]: v }));
  const changedKeys = new Set(changes.map((c) => key(c.componentId, c.studentId)));
  const phoneComponent = components.find((c) => c.id === part) ?? components[0];

  const save = () => start(async () => {
    const r = await saveMarks(s.id, changes);
    if (r.error) { toast.error(r.error); return; }
    setDrafts({});
    toast.success(`Saved ${changes.length} ${changes.length === 1 ? "mark" : "marks"}`);
    router.refresh();
  });

  const act = (action: MarksAction, note?: string) => start(async () => {
    const r = await transitionMarks(s.id, action, note);
    if (r.error) { toast.error(r.error); return; }
    setReasonFor(null);
    router.refresh();
  });

  const reasonTitle = reasonFor === "send_back" ? "Send back to faculty" : "Reopen marks";

  return (
    <>
      {!editable && <p className="mb-3 text-sm text-muted-foreground">Read only: these marks are {STATUS[s.status].label.toLowerCase()}.</p>}

      {components.length === 0 ? (
        <EmptyState title="No components yet. Faculty add them in Draft." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl bg-card shadow-sheet md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  {components.map((c) => <TableHead key={c.id} className="text-right">{c.name} <span className="text-muted-foreground/70">/{c.maxMarks}</span></TableHead>)}
                  <TableHead className="text-right">Total <span className="text-muted-foreground/70">/{INTERNAL_TOTAL}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell><span className="block font-medium">{st.name}</span><span className="block text-xs text-muted-foreground">{st.rollNo}</span></TableCell>
                    {components.map((c) => (
                      <TableCell key={c.id} className="text-right">
                        <MarkInput editable={editable} value={shown(c.id, st.id)} error={errors.get(key(c.id, st.id))} max={c.maxMarks}
                          changed={changedKeys.has(key(c.id, st.id))} label={`${c.name}, ${st.name}`} onChange={(v) => edit(key(c.id, st.id), v)} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{total(st.id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden">
            <div role="tablist" aria-label="Component" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
              {components.map((c) => (
                <button key={c.id} role="tab" aria-selected={c.id === phoneComponent.id} onClick={() => setPart(c.id)}
                  className={`h-10 shrink-0 rounded-full px-4 text-sm transition-colors ${c.id === phoneComponent.id ? "bg-foreground font-medium text-background" : "bg-card text-muted-foreground shadow-sheet"}`}>
                  {c.name} <span className="opacity-70">/{c.maxMarks}</span>
                </button>
              ))}
            </div>
            <ul className="divide-y divide-rule rounded-xl bg-card shadow-sheet">
              {students.map((st) => {
                const c = phoneComponent;
                return (
                  <li key={st.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{st.name}</p>
                      <p className="text-[13px] text-muted-foreground">{st.rollNo} · total {total(st.id)}/{INTERNAL_TOTAL}</p>
                    </div>
                    <MarkInput editable={editable} value={shown(c.id, st.id)} error={errors.get(key(c.id, st.id))} max={c.maxMarks}
                      changed={changedKeys.has(key(c.id, st.id))} large label={`${c.name}, ${st.name}`} onChange={(v) => edit(key(c.id, st.id), v)} />
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2.5 shadow-float md:bottom-4">
        {changes.length > 0
          ? <span className="mr-auto flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-data" aria-hidden />{changes.length} unsaved {changes.length === 1 ? "change" : "changes"}{errors.size > 0 && <span className="text-absent">· {errors.size} to fix</span>}</span>
          : <span className="mr-auto text-sm text-muted-foreground">{editable ? "All marks saved" : `${STATUS[s.status].label}`}</span>}
        {editable && changes.length > 0 && (
          <Button onClick={save} disabled={busy || errors.size > 0}>Save {changes.length}</Button>
        )}
        {role === "faculty" && s.status === "draft" && (
          <>
            <Button variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>Edit components</Button>
            <Button variant={changes.length > 0 ? "outline" : "default"} disabled={busy || changes.length > 0} onClick={() => act("submit")}>Submit</Button>
          </>
        )}
        {role === "office_admin" && s.status === "submitted" && (
          <>
            <Button variant="outline" disabled={busy} onClick={() => { setWhy(""); setReasonFor("send_back"); }}>Send back</Button>
            <Button disabled={busy} onClick={() => act("lock")}>Lock</Button>
          </>
        )}
        {role === "office_admin" && s.status === "locked" && (
          <Button variant="outline" disabled={busy} onClick={() => { setWhy(""); setReasonFor("reopen"); }}>Reopen</Button>
        )}
      </div>

      <Dialog open={reasonFor !== null} onOpenChange={(o) => { if (!o) setReasonFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonTitle}</DialogTitle>
            <DialogDescription>The reason is kept in the history for this subject.</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Reason" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} placeholder="Reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonFor(null)}>Cancel</Button>
            <Button disabled={busy || !why.trim()} onClick={() => reasonFor && act(reasonFor, why)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editOpen && <ComponentsDialog subjectId={s.id} components={components} onClose={() => setEditOpen(false)} />}
    </>
  );
}

function MarkInput({ editable, value, error, max, label, onChange, changed, large }: {
  editable: boolean; value: string; error?: string; max: number; label: string; onChange: (v: string) => void; changed?: boolean; large?: boolean;
}) {
  if (!editable) return <span className={value ? "" : "text-muted-foreground"}>{value || "–"}</span>;
  return (
    <div className={`ml-auto text-left ${large ? "w-24" : "w-20"}`}>
      <Input aria-label={label} type="number" inputMode="decimal" min={0} max={max} step="any" value={value}
        aria-invalid={!!error} onChange={(e) => onChange(e.target.value)}
        className={`text-right tabular-nums ${large ? "h-11 text-base" : "h-8"} ${changed ? "bg-data-soft border-data" : ""}`} />
      {error && <p className="mt-1 text-xs text-absent">{error}</p>}
    </div>
  );
}

type Row = { id?: number; name: string; max: string };

function ComponentsDialog({ subjectId, components, onClose }: {
  subjectId: number; components: SheetData["components"]; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => components.map((c) => ({ id: c.id, name: c.name, max: String(c.maxMarks) })));
  const input = rows.map((r) => ({ id: r.id, name: r.name, maxMarks: Number(r.max) }));
  const err = validateComponents(input);
  const sum = input.reduce((n, c) => n + c.maxMarks, 0);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => start(async () => {
    const r = await saveComponents(subjectId, input);
    if (r.error) { toast.error(r.error); return; }
    onClose();
    router.refresh();
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit components</DialogTitle>
          <DialogDescription>Components must total {INTERNAL_TOTAL}. A component with marks entered can&apos;t be removed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={`Component ${i + 1} name`} value={r.name} maxLength={60} placeholder="Name"
                onChange={(e) => update(i, { name: e.target.value })} className="flex-1" />
              <Input aria-label={`Component ${i + 1} max marks`} type="number" inputMode="numeric" min={1} value={r.max}
                onChange={(e) => update(i, { max: e.target.value })} className="w-24 text-right tabular-nums" />
              <Button variant="ghost" size="icon" aria-label={`Remove component ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { name: "", max: "" }])}><Plus aria-hidden />Add component</Button>
          <p className={`text-sm ${err ? "text-absent" : "text-muted-foreground"}`}>
            {err ?? `Total ${sum} of ${INTERNAL_TOTAL}.`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || err !== null} onClick={save}>Save components</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
