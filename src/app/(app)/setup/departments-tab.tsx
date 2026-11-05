"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { saveDepartmentPosts } from "./actions";
import { editColumn, Field, FormDialog } from "./shared";

type Row = { id: number; name: string; sanctionedPosts: number; teachers: number };

export function DepartmentsTab({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Department" },
    { accessorKey: "sanctionedPosts", header: "Sanctioned posts", cell: ({ row }) => <span className="tabular-nums">{row.original.sanctionedPosts}</span> },
    { accessorKey: "teachers", header: "Full-time teachers", cell: ({ row }) => <span className="tabular-nums">{row.original.teachers}</span> },
    editColumn<Row>(setEditing),
  ];

  return (
    <>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search departments" exportName="departments"
        emptyTitle="No departments yet." />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={editing?.id}
        title="Sanctioned posts" description={editing ? `${editing.name}: full-time teaching posts the college is sanctioned.` : undefined}
        submitLabel="Save" action={saveDepartmentPosts}>
        <Field label="Sanctioned posts" hint="Faculty and HOD posts sanctioned for this department. 0 to 500.">
          <Input name="sanctionedPosts" type="number" min={0} max={500} required defaultValue={editing?.sanctionedPosts ?? 0} />
        </Field>
      </FormDialog>
    </>
  );
}
