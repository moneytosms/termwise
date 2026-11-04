"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays } from "lucide-react";
import { SectionHeading, StatusPill } from "@/components/page";
import { EmptyState } from "@/components/states";
import { SyncLine } from "@/components/sync-line";
import { Skeleton } from "@/components/ui/skeleton";
import { offlineDb } from "@/offline/db";
import { useSync } from "@/offline/use-sync";

/** Today comes from the phone's copy, so it works offline. */
export function Today() {
  const sync = useSync();
  const classes = useLiveQuery(() => offlineDb.today.toArray());
  const outbox = useLiveQuery(() => offlineDb.outbox.toArray(), [], []);

  return (
    <section>
      <SyncLine s={sync} />
      <SectionHeading title="Today" count={classes?.length} />
      {classes === undefined || (classes.length === 0 && sync.online && !sync.refreshed) ? <Skeleton className="h-16 w-full" /> : classes.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No classes today." />
      ) : (
        <ul className="space-y-2">
          {[...classes].sort((a, b) => a.period - b.period).map((c) => {
            const marked = Boolean(c.sessionId) || outbox.some((o) => o.key === c.key);
            return (
              <li key={c.key}>
                <Link href={`/mark#${encodeURIComponent(c.key)}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono">{c.startTime}</span> <span className="font-medium">{c.subjectName}</span>
                    <span className="block truncate text-muted-foreground">{c.batchCode}</span>
                  </span>
                  <StatusPill tone={marked ? "ok" : "late"}>{marked ? "Marked" : "To mark"}</StatusPill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
