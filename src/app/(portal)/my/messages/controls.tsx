"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sendMentorNote, setLanguage } from "./actions";

type Lang = "en" | "or";
const OPTIONS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "or", label: "ଓଡ଼ିଆ" },
];

export function LanguageToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [shown, pick] = useOptimistic(lang, (_, next: Lang) => next);
  const choose = (next: Lang) => start(async () => {
    pick(next);
    const r = await setLanguage(next);
    if (r.error) { toast.error(r.error); return; }
    router.refresh();
  });
  return (
    <div role="radiogroup" aria-label="Message language" className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={shown === o.value}
          disabled={busy}
          onClick={() => choose(o.value)}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-colors",
            shown === o.value ? "bg-card text-foreground shadow-sheet" : "text-muted-foreground hover:text-foreground",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MentorNoteForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    start(async () => {
      const r = await sendMentorNote(body);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Note sent to the mentor.");
      form.reset();
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="mentor-note" className="sr-only">Your note</label>
      <Textarea id="mentor-note" name="body" required minLength={5} maxLength={1000} rows={4} disabled={disabled || busy}
        placeholder="Ask about attendance, marks, or anything else." />
      <Button type="submit" disabled={disabled || busy}>Send note</Button>
    </form>
  );
}
