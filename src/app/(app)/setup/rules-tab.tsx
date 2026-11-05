"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { SectionHeading } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRules } from "./actions";
import { Field } from "./shared";

export function RulesTab({ rules }: { rules: { riskDropPoints: number; riskMarksPercent: number; riskMinSessions: number } }) {
  const [busy, start] = useTransition();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveRules(fd);
      if (r.error) toast.error(r.error);
      else toast.success("Applies on the next daily run.");
    });
  }

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted-foreground">
        Faculty may edit attendance until the end of the day; after that, an office admin corrects it with a reason.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        The attendance cutoff is set per programme on the{" "}
        <Link href="/setup?tab=programmes" className="font-medium underline underline-offset-4">Programmes tab</Link>.
      </p>

      <SectionHeading title="At-risk rules" />
      <form onSubmit={save} className="grid gap-4">
        <Field label="Attendance drop (points, 4 weeks)" hint="Flag when overall attendance falls by this many points. 1 to 100.">
          <Input name="riskDropPoints" type="number" min={1} max={100} required defaultValue={rules.riskDropPoints} />
        </Field>
        <Field label="Marks below (% of components entered)" hint="Flag when marks so far fall below this. 1 to 100.">
          <Input name="riskMarksPercent" type="number" min={1} max={100} required defaultValue={rules.riskMarksPercent} />
        </Field>
        <Field label="Minimum sessions before flagging" hint="No flags until this many attendance sessions are held. 1 to 200.">
          <Input name="riskMinSessions" type="number" min={1} max={200} required defaultValue={rules.riskMinSessions} />
        </Field>
        <p className="text-sm text-muted-foreground">AI never changes these. The daily run applies them as written.</p>
        <div>
          <Button type="submit" disabled={busy}>Save rules</Button>
        </div>
      </form>
    </div>
  );
}
