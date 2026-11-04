"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDailyCheck } from "./actions";

export function RunNowButton() {
  const [running, start] = useTransition();
  const run = () => start(async () => {
    const r = await runDailyCheck();
    if (r.error) { toast.error(r.error); return; }
    const s = r.summary!;
    toast.success(`Flagged ${s.flagged}, cleared ${s.cleared}, not enough data ${s.notEnoughData}, messages logged ${s.messagesLogged}, blocked ${s.messagesBlocked}.`);
  });
  return <Button onClick={run} disabled={running}>{running ? "Running…" : "Run now"}</Button>;
}
