"use client";

import Link from "next/link";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/page";
import type { SyncState } from "@/offline/use-sync";

/** Saved, pending or failed, always in words. */
export function SyncLine({ s }: { s: SyncState }) {
  const n = s.pending + s.failed;
  if (s.signedOut) return (
    <p role="status" className="flex items-center gap-2 text-sm text-late">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">Sign-in expired.{n > 0 && ` ${n} saved on this phone.`}</span>
      <Link href="/sign-in" className="font-medium underline">Sign in</Link>
    </p>
  );
  if (s.failed) return (
    <p role="status" className="flex items-center gap-2 text-sm text-absent">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span className="flex-1"><StatusPill tone="absent">{s.failed} failed to send</StatusPill> Still on this phone.</span>
      <Button size="sm" variant="outline" onClick={s.retry}>Retry</Button>
    </p>
  );
  if (s.pending) return (
    <p role="status" className="flex items-center gap-2 text-sm text-late">
      {s.online ? <RefreshCw className="size-4 shrink-0 animate-spin" aria-hidden /> : <CloudOff className="size-4 shrink-0" aria-hidden />}
      <span><StatusPill tone="late">{s.pending} pending</StatusPill> {s.online ? "Sending…" : "Saved on this phone; sends when back online."}</span>
    </p>
  );
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      {!s.online && <CloudOff className="size-4 shrink-0" aria-hidden />}
      <span>{s.online ? <StatusPill tone="ok">All saved</StatusPill> : "Offline. You can still mark attendance."}</span>
    </p>
  );
}
