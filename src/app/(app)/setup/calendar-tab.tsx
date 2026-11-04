"use client";

import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteCalendarDay, saveCalendarDay } from "./actions";
import { Field, FormDialog, fieldCls } from "./shared";

type Row = { id: number; date: string; kind: "holiday" | "exam" | "event"; label: string };

const KIND: Record<Row["kind"], string> = { holiday: "Holiday", exam: "Exam", event: "Event" };
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function CalendarTab({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, start] = useTransition();
  const current = editing && editing !== "new" ? editing : null;

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="font-mono text-sm">{fmtDate(row.original.date)}</span> },
    { accessorKey: "kind", header: "Kind", cell: ({ row }) => KIND[row.original.kind] },
    { accessorKey: "label", header: "Label" },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => (
      <span className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}>Edit</Button>
        <Button size="sm" variant="ghost" className="text-absent" onClick={() => setDeleting(row.original)}>Delete</Button>
      </span>
    ) },
  ];
  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />Add day</Button>;

  function confirmDelete() {
    if (!deleting) return;
    start(async () => {
      const r = await deleteCalendarDay(deleting.id);
      if (r.error) toast.error(r.error);
      else setDeleting(null);
    });
  }

  return (
    <>
      <div className="mb-3 flex justify-end">{addButton}</div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search calendar" exportName="calendar"
        emptyTitle="No holidays, exams or events yet." emptyAction={addButton} />
      <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={current?.id}
        title={current ? "Edit day" : "Add day"} submitLabel="Save" action={saveCalendarDay}>
        <Field label="Date"><Input name="date" type="date" required defaultValue={current?.date} /></Field>
        <Field label="Kind">
          <select name="kind" required defaultValue={current?.kind ?? "holiday"} className={fieldCls}>
            <option value="holiday">Holiday</option>
            <option value="exam">Exam</option>
            <option value="event">Event</option>
          </select>
        </Field>
        <Field label="Label"><Input name="label" required defaultValue={current?.label} /></Field>
      </FormDialog>
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this day?</DialogTitle>
            <DialogDescription>{deleting && `${fmtDate(deleting.date)} · ${deleting.label}`}. The deletion is recorded in the audit log.</DialogDescription>
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
