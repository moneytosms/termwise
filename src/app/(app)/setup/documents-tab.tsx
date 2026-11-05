"use client";

import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/select-field";
import { APPLICANT_CATEGORIES, CATEGORY_LABEL, type ApplicantCategory } from "@/domain/applicants";
import { deleteRequiredDocument, saveRequiredDocument } from "./document-actions";
import { Field, FormDialog } from "./shared";

type Row = { id: number; programmeId: number; programme: string; name: string; categories: string[] | null };

const appliesTo = (categories: string[] | null) =>
  categories && categories.length > 0
    ? categories.map((c) => CATEGORY_LABEL[c as ApplicantCategory] ?? c).join(", ")
    : "All";

export function DocumentsTab({ rows, programmes }: { rows: Row[]; programmes: { id: number; code: string; name: string }[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, start] = useTransition();
  const current = editing && editing !== "new" ? editing : null;

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "programme", header: "Programme", cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.programme}</span> },
    { accessorKey: "name", header: "Document" },
    { id: "applies", header: "Applies to", cell: ({ row }) => appliesTo(row.original.categories) },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => (
      <span className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}>Edit</Button>
        <Button size="sm" variant="ghost" className="text-absent" onClick={() => setDeleting(row.original)}>Delete</Button>
      </span>
    ) },
  ];
  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />Add document</Button>;

  function confirmDelete() {
    if (!deleting) return;
    start(async () => {
      const r = await deleteRequiredDocument(deleting.id);
      if (r.error) toast.error(r.error);
      else setDeleting(null);
    });
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Documents each applicant must hand in. Applicants see the ones that match their category.</p>
      <div className="mb-3 flex justify-end">{addButton}</div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search documents" exportName="documents"
        emptyTitle="No documents required yet." emptyAction={addButton}
        mobile={(r) => (
          <span className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-[13px] text-muted-foreground">{r.programme} · {appliesTo(r.categories)}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
          </span>
        )} />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={current?.id}
        title={current ? "Edit document" : "Add document"} submitLabel="Save" action={saveRequiredDocument}
        footerStart={current && (
          <Button variant="ghost" className="text-absent" onClick={() => { setDeleting(current); setEditing(null); }}>Delete</Button>
        )}>
        {current ? (
          <Field label="Programme"><span className="text-sm font-normal">{current.programme}</span></Field>
        ) : (
          <Field label="Programme">
            <SelectField name="programmeId" required aria-label="Programme" placeholder="Pick a programme"
              options={programmes.map((p) => ({ value: String(p.id), label: `${p.code} · ${p.name}` }))} />
          </Field>
        )}
        <Field label="Document name"><Input name="name" required maxLength={120} defaultValue={current?.name} /></Field>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Applies to</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {APPLICANT_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="categories" value={c} className="size-4 accent-primary"
                  defaultChecked={current?.categories?.includes(c) ?? false} />
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
          <span className="text-sm font-normal text-muted-foreground">Leave all unticked to require it from every category.</span>
        </fieldset>
      </FormDialog>
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>{deleting && `${deleting.programme} · ${deleting.name}`}. The deletion is recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={busy} onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
