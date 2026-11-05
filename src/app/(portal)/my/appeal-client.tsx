"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormDialog, Field } from "@/app/(app)/setup/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { raiseAppeal } from "./appeal-actions";

/** `target` is the mark component id, or the attendance session id. */
export function AppealButton({ kind, target, label }: { kind: "mark" | "attendance"; target: number | string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" aria-label={`Appeal ${label}`} onClick={() => setOpen(true)}>Appeal</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Appeal" submitLabel="Send appeal"
        description={`${label}. The office reviews it and its decision is final.`}
        action={async (fd) => {
          const r = await raiseAppeal(fd);
          if (!r.error) toast.success("Appeal sent to the office.");
          return r;
        }}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name={kind === "mark" ? "componentId" : "sessionId"} value={target} />
        <Field label="Reason">
          <Textarea name="reason" required minLength={10} maxLength={500} rows={4} />
        </Field>
      </FormDialog>
    </>
  );
}
