"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/select-field";
import { APPLICANT_CATEGORIES, categoryLabel } from "@/domain/applicants";
import { rupees } from "@/lib/utils";
import { saveFeeStructure } from "./actions";
import { editColumn, Field, FormDialog } from "./shared";

type Row = { id: number; code: string; name: string; defaultPaise: number; fees: Record<string, number> };

export function FeeStructureTab({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "Programme", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.code}</span> },
    { accessorKey: "defaultPaise", header: "Default", cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.defaultPaise)}</span> },
    ...APPLICANT_CATEGORIES.map((c): ColumnDef<Row> => ({
      id: c,
      header: categoryLabel(c),
      cell: ({ row }) => {
        const own = row.original.fees[c];
        return own === undefined
          ? <span className="text-muted-foreground">Default</span>
          : <span className="tabular-nums">{rupees(own)}</span>;
      },
    })),
    editColumn<Row>(setEditing),
  ];

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Semester fee by category. A category without its own fee pays the programme default. Changing a fee here does not change instalments already set up for students.
      </p>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search programmes" exportName="fee-structure"
        emptyTitle="No programmes yet." />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title="Set semester fee" submitLabel="Save" action={saveFeeStructure}>
        <Field label="Programme">
          <SelectField name="programmeId" aria-label="Programme" defaultValue={String(editing?.id ?? "")}
            options={rows.map((r) => ({ value: String(r.id), label: r.name }))} />
        </Field>
        <Field label="Category">
          <SelectField name="category" aria-label="Category" defaultValue="general"
            options={APPLICANT_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))} />
        </Field>
        <Field label="Semester fee (₹)" hint="Leave blank to remove this category's fee, so it pays the programme default.">
          <Input name="fee" type="number" min={0} step={1} inputMode="numeric" />
        </Field>
      </FormDialog>
    </>
  );
}
