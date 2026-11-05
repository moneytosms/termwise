"use client";

import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const fieldCls = "h-9 w-full rounded-lg px-3 text-base md:text-sm border border-input bg-field transition-[box-shadow,background-color,border-color] duration-150 outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Add or edit form in a Dialog. Errors toast and the typed input stays. `id` makes it an edit. */
export function FormDialog({ open, onOpenChange, title, description, id, submitLabel, action, footerStart, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  id?: number;
  submitLabel: string;
  action: (fd: FormData) => Promise<{ error?: string }>;
  footerStart?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [busy, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await action(fd);
            if (r.error) toast.error(r.error);
            else onOpenChange(false);
          });
        }}>
          {id !== undefined && <input type="hidden" name="id" value={id} />}
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            {footerStart && <div className="sm:mr-auto">{footerStart}</div>}
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={busy}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Row action column: a header only screen readers see, so it isn't exported or hidden. */
export function editColumn<T>(onEdit: (row: T) => void): ColumnDef<T> {
  return {
    id: "edit",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <Button size="sm" variant="ghost" onClick={() => onEdit(row.original)}>Edit</Button>,
  };
}
