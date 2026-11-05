"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Panel, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { setConsent } from "./actions";

export function ConsentPanel({ givenOn, held }: { givenOn: string | null; held: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const change = (given: boolean) => start(async () => {
    const r = await setConsent(given);
    if (r.error) { toast.error(r.error); return; }
    toast.success(given ? "Consent given. Held messages are released." : "Consent withdrawn.");
    router.refresh();
  });
  return (
    <Panel title="Consent (DPDP)">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Status</span>
          {givenOn ? <StatusPill tone="ok">Given on {givenOn}</StatusPill> : <StatusPill tone="late">Not given</StatusPill>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Messages held</span>
          <span className="tabular-nums">{held}</span>
        </div>
        <p className="text-muted-foreground">The college holds its messages to you until you give consent.</p>
        {givenOn
          ? <Button variant="outline" disabled={busy} onClick={() => change(false)}>Withdraw consent</Button>
          : <Button disabled={busy} onClick={() => change(true)}>Give consent</Button>}
      </div>
    </Panel>
  );
}
