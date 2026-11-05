"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestCorrection } from "./actions";

export function CorrectionForm() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body"));
    start(async () => {
      const r = await requestCorrection(body);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Request sent to the office.");
      form.reset();
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="correction">What needs correcting</Label>
        <Textarea id="correction" name="body" required minLength={10} maxLength={500} rows={4}
          placeholder="What is wrong, and what should it say?" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>Send request</Button>
      </div>
    </form>
  );
}
