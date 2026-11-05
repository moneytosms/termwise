"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { canEditMarks, finalScore, sectionMax, sectionsFor, SECTION_LABEL, validateComponents, validateMark, type Kind, type MarksAction, type Role, type Section } from "@/domain/marks";
import { EmptyState } from "@/components/states";
import type { SheetData } from "../queries";
import { saveComponents, saveMarks, transitionMarks } from "../actions";
import { STATUS } from "../shared";
import { can } from "@/domain/roles";

const key = (componentId: number, studentId: number) => `${componentId}:${studentId}`;
const parse = (s: string) => (s.trim() === "" ? null : Number(s));
type Student = SheetData["students"][number];
type Filter = "all" | "missing" | "below" | "full";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "missing", label: "Missing marks" },
  { value: "below", label: "Below pass" },
  { value: "full", label: "Full marks" },
];
const PASS_SHARE = 0.4;
type Col = SheetData["components"][number];

/** Components grouped in section order (internal, mid, end, then lab sections for lab subjects). */
const bySection = (cs: Col[], kind: Kind) => sectionsFor(kind).flatMap((sec) => cs.filter((c) => c.section === sec));

export function MarksSheet({ data, role }: { data: SheetData; role: Role }) {
  const { subject: s, students } = data;
  const components = bySection(data.components, s.kind);
  const groups = sectionsFor(s.kind).map((sec) => ({ sec, cols: components.filter((c) => c.section === sec) })).filter((g) => g.cols.length > 0);
  const router = useRouter();
  const [busy, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [part, setPart] = useState(components[0]?.id ?? 0);
  const [reasonFor, setReasonFor] = useState<MarksAction | null>(null);
  const [why, setWhy] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [sort, setSort] = useState("roll:asc");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const saved = useMemo(() => new Map(data.marks.map((m) => [key(m.componentId, m.studentId), m.marks])), [data.marks]);
  const maxOf = new Map(components.map((c) => [c.id, c.maxMarks]));
  const sectionSums = (st: number, read: (c: Col) => number | null) => {
    const out: Partial<Record<Section, number>> = {};
    for (const c of components) {
      const v = read(c);
      if (v !== null && Number.isFinite(v)) out[c.section] = (out[c.section] ?? 0) + v;
    }
    return out;
  };
  const savedOf = (st: number) => sectionSums(st, (c) => saved.get(key(c.id, st)) ?? null);
  const draftOf = (st: number) => sectionSums(st, (c) => {
    const k = key(c.id, st);
    return k in drafts ? parse(drafts[k]) : (saved.get(k) ?? null);
  });
  const finalOf = (sums: Partial<Record<Section, number>>) => finalScore(s, sums).total;
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
  const total = (st: number) => draftOf(st).internal ?? 0;
  const edit = (k: string, v: string) => setDrafts((d) => ({ ...d, [k]: v }));
  const changedKeys = new Set(changes.map((c) => key(c.componentId, c.studentId)));
  const phoneComponent = components.find((c) => c.id === part) ?? components[0];

  // Sort and filter read saved marks, not drafts, so rows don't jump while typing.
  const [by, dir] = sort.split(":");
  const savedTotal = (id: number) => savedOf(id).internal ?? 0;
  const rank = (st: Student) => (by === "roll" ? st.rollNo : by === "name" ? st.name : by === "total" ? savedTotal(st.id)
    : by === "final" ? finalOf(savedOf(st.id)) : Number(saved.get(key(Number(by), st.id)) ?? -1));
  const q = query.trim().toLowerCase();
  const keep = (st: Student) => {
    const t = savedTotal(st.id);
    const ok = filter === "all" || (filter === "missing" ? components.some((c) => saved.get(key(c.id, st.id)) == null)
      : filter === "below" ? t < PASS_SHARE * s.internalMax : t === s.internalMax);
    return ok && (!q || st.name.toLowerCase().includes(q) || st.rollNo.toLowerCase().includes(q));
  };
  const visible = students.filter(keep).sort((a, b) => {
    const x = rank(a);
    const y = rank(b);
    const d = typeof x === "string" ? x.localeCompare(String(y), undefined, { numeric: true }) : Number(x) - Number(y);
    return dir === "desc" ? -d : d;
  });
  const sortItems = [
    { value: "roll:asc", label: "Roll no" },
    { value: "name:asc", label: "Name" },
    { value: "total:desc", label: "Internal high to low" },
    { value: "total:asc", label: "Internal low to high" },
    { value: "final:desc", label: "Final high to low" },
    ...components.map((c) => ({ value: `${c.id}:desc`, label: `${c.name} high to low` })),
  ];
  const sortBy = (k: string, first: "asc" | "desc") => setSort(by === k ? `${k}:${dir === "asc" ? "desc" : "asc"}` : `${k}:${first}`);
  const ariaSort = (k: string) => (by === k ? (dir === "asc" ? "ascending" : "descending") : undefined);
  const sortHead = (k: string, label: React.ReactNode, first: "asc" | "desc") => (
    <button type="button" onClick={() => sortBy(k, first)} className="inline-flex items-center gap-1 hover:text-foreground">
      {label}
      {by === k && (dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
    </button>
  );
  const blankHint = (c: number, st: number) => (filter === "missing" && shown(c, st) === "" ? "bg-late-soft" : "");

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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input type="search" aria-label="Search students" placeholder="Name or roll no" value={query}
              onChange={(e) => setQuery(e.target.value)} className="h-8 w-48" />
            <Select items={sortItems} value={sort} onValueChange={(v) => { if (v) setSort(v); }}>
              <SelectTrigger size="sm" aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>{sortItems.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select items={FILTERS} value={filter} onValueChange={(v) => { if (v) setFilter(v as Filter); }}>
              <SelectTrigger size="sm" aria-label="Filter"><SelectValue /></SelectTrigger>
              <SelectContent>{FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">Showing {visible.length} of {students.length}</span>
          </div>

          <div className="hidden overflow-x-auto rounded-xl bg-card shadow-sheet md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead />
                  {groups.map((g) => (
                    <TableHead key={g.sec} colSpan={g.cols.length} className="border-l border-rule text-center text-xs uppercase tracking-wide">
                      {SECTION_LABEL[g.sec]} <span className="text-muted-foreground/70">/{sectionMax(s, g.sec)}</span>
                    </TableHead>
                  ))}
                  <TableHead colSpan={2} />
                </TableRow>
                <TableRow>
                  <TableHead aria-sort={ariaSort("roll")}>{sortHead("roll", "Student", "asc")}</TableHead>
                  {components.map((c) => (
                    <TableHead key={c.id} className="text-right" aria-sort={ariaSort(String(c.id))}>
                      {sortHead(String(c.id), <>{c.name} <span className="text-muted-foreground/70">/{c.maxMarks}</span></>, "desc")}
                    </TableHead>
                  ))}
                  <TableHead className="text-right" aria-sort={ariaSort("total")}>
                    {sortHead("total", <>Internal <span className="text-muted-foreground/70">/{s.internalMax}</span></>, "desc")}
                  </TableHead>
                  <TableHead className="text-right" aria-sort={ariaSort("final")}>
                    {sortHead("final", <>Final <span className="text-muted-foreground/70">/100</span></>, "desc")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((st) => (
                  <TableRow key={st.id} className="hover:bg-muted/40">
                    <TableCell><span className="block font-medium">{st.name}</span><span className="block text-xs text-muted-foreground">{st.rollNo}</span></TableCell>
                    {components.map((c) => (
                      <TableCell key={c.id} className={`text-right ${blankHint(c.id, st.id)}`}>
                        <MarkInput editable={editable} value={shown(c.id, st.id)} error={errors.get(key(c.id, st.id))} max={c.maxMarks}
                          changed={changedKeys.has(key(c.id, st.id))} label={`${c.name}, ${st.name}`} onChange={(v) => edit(key(c.id, st.id), v)} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{total(st.id)}</TableCell>
                    <TableCell className="text-right font-medium">{finalOf(draftOf(st.id))}</TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow><TableCell colSpan={components.length + 3} className="text-center text-muted-foreground">No students match.</TableCell></TableRow>
                )}
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
              {visible.map((st) => {
                const c = phoneComponent;
                return (
                  <li key={st.id} className={`flex items-center gap-3 px-4 py-2.5 ${blankHint(c.id, st.id)}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{st.name}</p>
                      <p className="text-[13px] text-muted-foreground">{st.rollNo} · internal {total(st.id)}/{s.internalMax} · final {finalOf(draftOf(st.id))}/100</p>
                    </div>
                    <MarkInput editable={editable} value={shown(c.id, st.id)} error={errors.get(key(c.id, st.id))} max={c.maxMarks}
                      changed={changedKeys.has(key(c.id, st.id))} large label={`${c.name}, ${st.name}`} onChange={(v) => edit(key(c.id, st.id), v)} />
                  </li>
                );
              })}
              {visible.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No students match.</li>}
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
        {can(role, "teach") && s.status === "draft" && (
          <>
            <Button variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>Edit components</Button>
            <Button variant={changes.length > 0 ? "outline" : "default"} disabled={busy || changes.length > 0} onClick={() => act("submit")}>Submit</Button>
          </>
        )}
        {can(role, "moderate_marks") && s.status === "submitted" && (
          <>
            <Button variant="outline" disabled={busy} onClick={() => { setWhy(""); setReasonFor("send_back"); }}>Send back</Button>
            <Button disabled={busy} onClick={() => act("lock")}>Lock</Button>
          </>
        )}
        {can(role, "moderate_marks") && s.status === "locked" && (
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

      {editOpen && <ComponentsDialog subject={s} components={components} onClose={() => setEditOpen(false)} />}
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

type Row = { id?: number; name: string; max: string; section: Section };

/** Internal rows are editable. Mid, end and lab sections are fixed by the scheme; a missing one is added on save. */
function ComponentsDialog({ subject: s, components, onClose }: {
  subject: SheetData["subject"]; components: SheetData["components"]; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => [
    ...components.filter((c) => c.section === "internal").map((c) => ({ id: c.id, name: c.name, max: String(c.maxMarks), section: c.section })),
    ...sectionsFor(s.kind).filter((sec) => sec !== "internal").map((sec): Row => {
      const c = components.find((x) => x.section === sec);
      return c ? { id: c.id, name: c.name, max: String(c.maxMarks), section: sec } : { name: SECTION_LABEL[sec], max: String(sectionMax(s, sec)), section: sec };
    }),
  ]);
  const fixed = (r: Row) => r.section !== "internal";
  const input = rows.map((r) => (fixed(r)
    ? { id: r.id, name: r.name, maxMarks: sectionMax(s, r.section), section: r.section }
    : { id: r.id, name: r.name, maxMarks: Number(r.max), section: r.section }));
  const err = validateComponents(input, s);
  const internal = input.filter((c) => c.section === "internal").reduce((n, c) => n + c.maxMarks, 0);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => start(async () => {
    const r = await saveComponents(s.id, input);
    if (r.error) { toast.error(r.error); return; }
    onClose();
    router.refresh();
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit components</DialogTitle>
          <DialogDescription>Internal components must total {s.internalMax}. Other sections come from the subject&apos;s scheme. A component with marks entered can&apos;t be removed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, i) => (fixed(r) ? (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{r.name} <span className="text-muted-foreground">({SECTION_LABEL[r.section]}, fixed)</span></span>
              <span className="w-24 text-right tabular-nums">{sectionMax(s, r.section)}</span>
              <span className="size-9" aria-hidden />
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={`Component ${i + 1} name`} value={r.name} maxLength={60} placeholder="Name"
                onChange={(e) => update(i, { name: e.target.value })} className="flex-1" />
              <Input aria-label={`Component ${i + 1} max marks`} type="number" inputMode="numeric" min={1} value={r.max}
                onChange={(e) => update(i, { max: e.target.value })} className="w-24 text-right tabular-nums" />
              <Button variant="ghost" size="icon" aria-label={`Remove component ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>
            </div>
          )))}
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { name: "", max: "", section: "internal" }])}><Plus aria-hidden />Add internal component</Button>
          <p className={`text-sm ${err ? "text-absent" : "text-muted-foreground"}`}>
            {err ?? `Internal total ${internal} of ${s.internalMax}.`}
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
