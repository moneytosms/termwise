"use client";

import { useState } from "react";
import { SECTION_LABEL } from "@/domain/marks";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusPill, type Tone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSubject } from "./actions";
import { SelectField } from "@/components/select-field";
import { editColumn, Field, FormDialog } from "./shared";

type Row = {
  id: number; batchId: number; batch: string; code: string; name: string;
  facultyId: number | null; faculty: string | null; marksStatus: "draft" | "submitted" | "locked";
  kind: "theory" | "lab"; internalMax: number; midMax: number; endMax: number; theoryScale: number; labExamMax: number; vivaMax: number; ceMax: number;
};

const MARKS: Record<Row["marksStatus"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "default" },
  submitted: { label: "Submitted", tone: "late" },
  locked: { label: "Locked", tone: "ok" },
};

export function SubjectsTab({ rows, batches, faculty }: {
  rows: Row[];
  batches: { id: number; code: string }[];
  faculty: { id: number; name: string }[];
}) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : null;
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.code}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.batch}</span> },
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }) => row.original.faculty ?? "Unassigned" },
    { accessorKey: "kind", header: "Kind", cell: ({ row }) => (row.original.kind === "lab" ? "Lab" : "Theory") },
    { accessorKey: "marksStatus", header: "Marks status", cell: ({ row }) => {
      const m = MARKS[row.original.marksStatus];
      return <StatusPill tone={m.tone}>{m.label}</StatusPill>;
    } },
    editColumn<Row>(setEditing),
  ];
  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />Add subject</Button>;

  return (
    <>
      <div className="mb-3 flex justify-end">{addButton}</div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search subjects" exportName="subjects"
        emptyTitle="No subjects yet." emptyAction={addButton} />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={current?.id}
        title={current ? "Edit subject" : "Add subject"} submitLabel="Save" action={saveSubject}
        description="Marks status changes from the Marks screen, not here.">
        <Field label="Batch">
          <SelectField name="batchId" required placeholder="Pick a batch" aria-label="Batch" defaultValue={String(current?.batchId ?? "")}
            options={batches.map((b) => ({ value: String(b.id), label: b.code }))} />
        </Field>
        <Field label="Code"><Input name="code" required defaultValue={current?.code} /></Field>
        <Field label="Name"><Input name="name" required defaultValue={current?.name} /></Field>
        <Field label="Faculty">
          <SelectField name="facultyId" searchable aria-label="Faculty" defaultValue={String(current?.facultyId ?? "")}
            options={[{ value: "", label: "Unassigned" }, ...faculty.map((f) => ({ value: String(f.id), label: f.name }))]} />
        </Field>
        <SchemeFields key={current?.id ?? "new"} current={current} />
      </FormDialog>
    </>
  );
}

/** Kind and mark caps. Switching to lab sets theory scale to 70; switching to theory sets it to 100. */
function SchemeFields({ current }: { current: Row | null }) {
  const [kind, setKind] = useState<"theory" | "lab">(current?.kind ?? "theory");
  const [theoryScale, setTheoryScale] = useState(String(current?.theoryScale ?? 100));
  const pick = (k: "theory" | "lab") => {
    setKind(k);
    setTheoryScale(k === "lab" ? "70" : "100");
  };
  const cap = (name: string, label: string, value: number) => (
    <Field label={label}><Input name={name} type="number" min={1} max={100} required defaultValue={value} /></Field>
  );
  return (
    <fieldset className="grid gap-4 border-t border-rule pt-4">
      <legend className="mb-2 text-sm font-medium">Marks scheme</legend>
      <Field label="Kind">
        <SelectField name="kind" aria-label="Kind" value={kind} onValueChange={(v) => pick(v as "theory" | "lab")}
          options={[{ value: "theory", label: "Theory" }, { value: "lab", label: "Lab" }]} />
      </Field>
      {/* Lab caps are always submitted so a theory save passes validation; theory ignores them. */}
      <div className="grid grid-cols-2 gap-4">
        {cap("internalMax", "Internal max", current?.internalMax ?? 40)}
        {cap("midMax", `${SECTION_LABEL.mid} max`, current?.midMax ?? 20)}
        {cap("endMax", `${SECTION_LABEL.end} max`, current?.endMax ?? 40)}
        <Field label="Theory scale (%)"><Input name="theoryScale" type="number" min={1} max={100} required value={theoryScale}
          onChange={(e) => setTheoryScale(e.target.value)} /></Field>
        {cap("labExamMax", `${SECTION_LABEL.lab_exam} max`, current?.labExamMax ?? 15)}
        {cap("vivaMax", `${SECTION_LABEL.viva} max`, current?.vivaMax ?? 10)}
        {cap("ceMax", "CE max", current?.ceMax ?? 5)}
      </div>
    </fieldset>
  );
}
