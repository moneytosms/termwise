"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBatch } from "./actions";
import { SelectField } from "@/components/select-field";
import { editColumn, Field, FormDialog } from "./shared";

type Row = {
  id: number; code: string; programmeId: number; programme: string;
  admissionYear: number; year: number; semester: number; students: number;
};

export function BatchesTab({ rows, programmes }: { rows: Row[]; programmes: { id: number; code: string; name: string }[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : null;
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.code}</span> },
    { accessorKey: "programme", header: "Programme" },
    { accessorKey: "admissionYear", header: "Admission year", cell: ({ row }) => <span className="tabular-nums">{row.original.admissionYear}</span> },
    { accessorKey: "year", header: "Year", cell: ({ row }) => <span className="tabular-nums">{row.original.year}</span> },
    { accessorKey: "semester", header: "Semester", cell: ({ row }) => <span className="tabular-nums">{row.original.semester}</span> },
    { accessorKey: "students", header: "Students", cell: ({ row }) => <span className="tabular-nums">{row.original.students}</span> },
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
    </>
  );
}
