"use client";

import { useEffect, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { advanceBatch, previewBatchTerm, saveBatch, type TermPreview } from "./actions";
import { SelectField } from "@/components/select-field";
import { rupees } from "@/lib/utils";
import { editColumn, Field, FormDialog } from "./shared";

type Row = {
  id: number; code: string; programmeId: number; programme: string;
  admissionYear: number; year: number; semester: number; students: number;
};

/** Preview of advancing a batch, then confirm. A blocker or error disables the confirm. */
function AdvanceDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [preview, setPreview] = useState<TermPreview | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => { previewBatchTerm(row.id).then(setPreview); }, [row.id]);
  const plan = preview?.plan;
  const confirm = () => start(async () => {
    const r = await advanceBatch(row.id);
    if (r.error) toast.error(r.error);
    else { toast.success(plan?.kind === "graduate" ? `${row.code} graduated.` : `${row.code} advanced.`); onClose(); }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Advance {row.code}</DialogTitle>
          <DialogDescription>Locks must be complete before the batch moves on.</DialogDescription>
        </DialogHeader>
        {!preview && <p className="text-sm text-muted-foreground">Checking the batch…</p>}
        {preview?.error && <p role="alert" className="text-sm text-destructive">{preview.error}</p>}
        {preview?.blocker && <p role="alert" className="text-sm text-destructive">{preview.blocker}</p>}
        {plan?.kind === "graduate" && (
          <p className="text-sm">{plan.students} student{plan.students === 1 ? "" : "s"} will graduate. Their records stay, and they leave the active lists.</p>
        )}
        {plan?.kind === "promote" && (
          <div className="grid gap-2 text-sm">
            <p>Move to Year {plan.year}, Semester {plan.semester}. {plan.students} student{plan.students === 1 ? "" : "s"} carry over and {plan.subjects} subject{plan.subjects === 1 ? "" : "s"} are copied to the new semester.</p>
            <p className="text-muted-foreground">Next instalments: {plan.fees.map((f) => `${f.category.toUpperCase()} ${rupees(f.paise)}`).join(" · ")}</p>
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button disabled={busy || !plan} onClick={confirm}>{plan?.kind === "graduate" ? "Graduate batch" : "Advance batch"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchesTab({ rows, programmes }: { rows: Row[]; programmes: { id: number; code: string; name: string }[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [advancing, setAdvancing] = useState<Row | null>(null);
  const current = editing && editing !== "new" ? editing : null;
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.code}</span> },
    { accessorKey: "programme", header: "Programme" },
    { accessorKey: "admissionYear", header: "Admission year", cell: ({ row }) => <span className="tabular-nums">{row.original.admissionYear}</span> },
    { accessorKey: "year", header: "Year", cell: ({ row }) => <span className="tabular-nums">{row.original.year}</span> },
    { accessorKey: "semester", header: "Semester", cell: ({ row }) => <span className="tabular-nums">{row.original.semester}</span> },
    { accessorKey: "students", header: "Students", cell: ({ row }) => <span className="tabular-nums">{row.original.students}</span> },
    {
      id: "advance",
      header: () => <span className="sr-only">Advance</span>,
      cell: ({ row }) => <Button size="sm" variant="ghost" onClick={() => setAdvancing(row.original)}>Advance</Button>,
    },
    editColumn<Row>(setEditing),
  ];
  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />Add batch</Button>;

  return (
    <>
      <div className="mb-3 flex justify-end">{addButton}</div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search batches" exportName="batches"
        emptyTitle="No batches yet." emptyAction={addButton} />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={current?.id}
        title={current ? "Edit batch" : "Add batch"} submitLabel="Save" action={saveBatch}>
        <Field label="Code" hint="Unique across the college.">
          <Input name="code" required defaultValue={current?.code} />
        </Field>
        <Field label="Programme">
          <SelectField name="programmeId" required placeholder="Pick a programme" aria-label="Programme" defaultValue={String(current?.programmeId ?? "")}
            options={programmes.map((p) => ({ value: String(p.id), label: `${p.code} · ${p.name}` }))} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Admission year">
            <Input name="admissionYear" type="number" min={2000} max={2100} required defaultValue={current?.admissionYear} />
          </Field>
          <Field label="Year">
            <Input name="year" type="number" min={1} max={10} required defaultValue={current?.year ?? 1} />
          </Field>
          <Field label="Semester">
            <Input name="semester" type="number" min={1} max={12} required defaultValue={current?.semester ?? 1} />
          </Field>
        </div>
      </FormDialog>
      {advancing && <AdvanceDialog row={advancing} onClose={() => setAdvancing(null)} />}
    </>
  );
}
