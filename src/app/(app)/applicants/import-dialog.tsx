"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/select-field";
import { APPLICANT_CSV_TEMPLATE, type CsvIssue } from "@/domain/applicants";
import { importApplicants } from "./actions";

export function ImportDialog({ batches }: { batches: { id: number; code: string; programme: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<CsvIssue[]>([]);
  const [busy, start] = useTransition();

  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(APPLICANT_CSV_TEMPLATE)}`;

  function submit() {
    if (!file || !batchId) return;
    start(async () => {
      const csvText = await file.text();
      const r = await importApplicants(Number(batchId), csvText);
      if (r.error) {
        setErrors(r.errors ?? []);
        toast.error(r.error);
        return;
      }
      toast.success(`Imported ${r.count} applicants`);
      setErrors([]);
      setFile(null);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Import CSV</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors([]); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import applicants</DialogTitle>
            <DialogDescription>One row per applicant. The batch sets the programme for every row.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Batch
              <SelectField aria-label="Batch" placeholder="Pick a batch" value={batchId} onValueChange={setBatchId}
                options={batches.map((b) => ({ value: String(b.id), label: `${b.code} · ${b.programme}` }))} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              CSV file
              <input type="file" accept=".csv" className="text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors([]); }} />
            </label>
            <a href={template} download="applicants-template.csv" className="text-sm underline underline-offset-4">Download template</a>
            {errors.length > 0 && (
              <div className="grid gap-1 rounded-xl bg-absent-soft p-3 text-sm">
                <p className="font-medium text-absent">Nothing was imported. Fix these lines:</p>
                <ul className="grid gap-1">
                  {errors.map((e, i) => (
                    <li key={i}>Line {e.line}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !file || !batchId} onClick={submit}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
