"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/select-field";
import { APPLICANT_CATEGORIES, CATEGORY_LABEL } from "@/domain/applicants";
import { rupees } from "@/lib/utils";
import { saveScheme } from "./actions";
import { editColumn, Field, FormDialog } from "./shared";

type Row = {
  id: number; name: string; fundingSource: "government" | "institution" | "non_government";
  kind: "fixed" | "percent"; value: number; categories: string[]; active: boolean;
};

const FUNDING_LABEL = { government: "Government", institution: "Institution", non_government: "Non-government" } as const;
const amountOf = (r: Row) => (r.kind === "percent" ? `${r.value}%` : rupees(r.value));
const appliesTo = (categories: string[]) =>
  categories.length > 0 ? categories.map((c) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c).join(", ") : "All";

export function SchemesTab({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : null;
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Scheme" },
    { id: "funding", header: "Funding", cell: ({ row }) => FUNDING_LABEL[row.original.fundingSource] },
    { id: "amount", header: "Amount", cell: ({ row }) => <span className="tabular-nums">{amountOf(row.original)}</span> },
    { id: "applies", header: "Applies to", cell: ({ row }) => appliesTo(row.original.categories) },
    { id: "active", header: "Status", cell: ({ row }) => (row.original.active ? "Active" : "Inactive") },
    editColumn<Row>(setEditing),
  ];
  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />Add scheme</Button>;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Scholarship schemes the office admin can award to a student for a semester. A percentage is of the semester fee.</p>
      <div className="mb-3 flex justify-end">{addButton}</div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search schemes" exportName="scholarship-schemes"
        emptyTitle="No scholarship schemes yet." emptyAction={addButton} />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={current?.id}
        title={current ? "Edit scheme" : "Add scheme"} submitLabel="Save" action={saveScheme}>
        <Field label="Name"><Input name="name" required maxLength={120} defaultValue={current?.name} /></Field>
        <Field label="Funding source">
          <SelectField name="fundingSource" required aria-label="Funding source" defaultValue={current?.fundingSource ?? ""}
            placeholder="Pick a funding source"
            options={Object.entries(FUNDING_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Kind">
          <SelectField name="kind" required aria-label="Kind" defaultValue={current?.kind ?? "percent"}
            options={[{ value: "percent", label: "Percent of semester fee" }, { value: "fixed", label: "Fixed amount (₹)" }]} />
        </Field>
        <Field label="Value" hint="A whole percent from 1 to 100, or a rupee amount for a fixed award.">
          <Input name="value" type="number" inputMode="decimal" step="0.01" min="0.01" required
            defaultValue={current ? (current.kind === "fixed" ? current.value / 100 : current.value) : undefined} />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Limited to</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {APPLICANT_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="categories" value={c} className="size-4 accent-primary"
                  defaultChecked={current?.categories.includes(c) ?? false} />
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
          <span className="text-sm font-normal text-muted-foreground">Leave all unticked to open the scheme to every category.</span>
        </fieldset>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="active" className="size-4 accent-primary" defaultChecked={current?.active ?? true} />
          Active
        </label>
      </FormDialog>
    </>
  );
}
