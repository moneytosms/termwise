"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusPill, type Tone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSubject } from "./actions";
import { editColumn, Field, FormDialog, fieldCls } from "./shared";

type Row = {
  id: number; batchId: number; batch: string; code: string; name: string;
  facultyId: number | null; faculty: string | null; marksStatus: "draft" | "submitted" | "locked";
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
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => <span className="font-mono text-sm">{row.original.batch}</span> },
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }) => row.original.faculty ?? "Unassigned" },
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
          <select name="batchId" required defaultValue={current?.batchId ?? ""} className={fieldCls}>
            <option value="" disabled>Pick a batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
        </Field>
        <Field label="Code"><Input name="code" required defaultValue={current?.code} /></Field>
        <Field label="Name"><Input name="name" required defaultValue={current?.name} /></Field>
        <Field label="Faculty">
          <select name="facultyId" defaultValue={current?.facultyId ?? ""} className={fieldCls}>
            <option value="">Unassigned</option>
            {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      </FormDialog>
    </>
  );
}
