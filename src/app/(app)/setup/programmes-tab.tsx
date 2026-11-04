"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProgramme } from "./actions";
import { editColumn, Field, FormDialog, fieldCls } from "./shared";

type Row = { id: number; code: string; name: string; departmentId: number | null; department: string | null; cutoff: number };

export function ProgrammesTab({ rows, departments }: { rows: Row[]; departments: { id: number; name: string }[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : null;
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "department", header: "Department", cell: ({ row }) => row.original.department ?? "–" },
    { accessorKey: "cutoff", header: "Attendance cutoff", cell: ({ row }) => <span className="font-mono">{row.original.cutoff}%</span> },
    editColumn<Row>(setEditing),
  ];
  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />Add programme</Button>;

  return (
    <>
      <div className="mb-3 flex justify-end">{addButton}</div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search programmes" exportName="programmes"
        emptyTitle="No programmes yet." emptyAction={addButton} />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={current?.id}
        title={current ? "Edit programme" : "Add programme"} submitLabel="Save" action={saveProgramme}>
        <Field label="Code"><Input name="code" required defaultValue={current?.code} /></Field>
        <Field label="Name"><Input name="name" required defaultValue={current?.name} /></Field>
        <Field label="Department">
          <select name="departmentId" defaultValue={current?.departmentId ?? ""} className={fieldCls}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Attendance cutoff (%)" hint="Below this, a student is in attendance shortage. 1 to 100.">
          <Input name="attendanceCutoff" type="number" min={1} max={100} required defaultValue={current?.cutoff ?? 75} />
        </Field>
      </FormDialog>
    </>
  );
}
