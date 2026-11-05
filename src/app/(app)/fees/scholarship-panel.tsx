"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/select-field";
import { categoryLabel } from "@/domain/applicants";
import { rupees } from "@/lib/utils";
import { awardScholarship, withdrawScholarship } from "./actions";
import type { FeeDetail } from "./queries";

export function ScholarshipPanel({ detail }: { detail: FeeDetail }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [schemeId, setSchemeId] = useState("");
  const [semester, setSemester] = useState(String(detail.student.semester));

  const run = (action: () => Promise<{ error?: string }>, ok: string, after?: () => void) => {
    start(async () => {
      const r = await action();
      if (r.error) { toast.error(r.error); return; }
      toast.success(ok);
      after?.();
      router.refresh();
    });
  };

  const award = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(() => awardScholarship({ studentId: detail.student.id, schemeId: Number(schemeId), semester: Number(semester) }),
      "Scholarship awarded.", () => setSchemeId(""));
  };

  return (
    <>
      <div className="space-y-2">
        {detail.awards.length === 0 ? <p className="text-sm text-muted-foreground">No scholarships awarded.</p> : (
          <ul className="space-y-2 text-sm">
            {detail.awards.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 p-3">
                <span>
                  <span className="font-medium">{a.scheme}</span>
                  <span className="block text-muted-foreground">Semester {a.semester} · <span className="tabular-nums">{rupees(a.amountPaise)}</span></span>
                </span>
                <Button type="button" size="sm" variant="outline" disabled={busy}
                  onClick={() => run(() => withdrawScholarship({ awardId: a.id }), "Scholarship withdrawn.")}>Withdraw</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail.schemes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active schemes on this campus.</p>
      ) : (
        <form onSubmit={award} className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label>Scheme</Label>
            <SelectField placeholder="Select scheme" aria-label="Scheme" value={schemeId} onValueChange={setSchemeId}
              options={detail.schemes.map((s) => ({
                value: String(s.id),
                label: `${s.name} (${s.kind === "percent" ? `${s.value}%` : rupees(s.value)}${s.categories.length ? `, ${s.categories.map(categoryLabel).join(", ")}` : ""})`,
              }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="scholarship-semester">Semester</Label>
            <Input id="scholarship-semester" type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} required />
          </div>
          <Button type="submit" size="sm" disabled={busy || !schemeId}>Award scholarship</Button>
        </form>
      )}
    </>
  );
}
