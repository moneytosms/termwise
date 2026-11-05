"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays } from "lucide-react";
import { SectionHeading, StatusPill } from "@/components/page";
import { EmptyState } from "@/components/states";
import { SyncLine } from "@/components/sync-line";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { currentOrNext, istTime } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import { offlineDb } from "@/offline/db";
import { useSync } from "@/offline/use-sync";

function subscribeMinute(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}

/** Slide to open on: the class running now, else the next one, else the last. */
function startSlide<T extends { startTime: string; endTime: string }>(sorted: T[], now: string | null) {
  const cur = now ? currentOrNext(sorted, now) : null;
  return cur ? sorted.indexOf(cur.cls) : sorted.length - 1;
}

/** Today comes from the phone's copy, so it works offline. */
export function Today() {
  const sync = useSync();
  const classes = useLiveQuery(() => offlineDb.today.toArray());
  const outbox = useLiveQuery(() => offlineDb.outbox.toArray(), [], []);
  const now = useSyncExternalStore(subscribeMinute, () => istTime(), () => null);
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  const sorted = [...(classes ?? [])].sort((a, b) => a.period - b.period);
  const start = startSlide(sorted, now);
  const nowIdx = now && currentOrNext(sorted, now)?.running ? start : -1;

  // Classes load async, so jump to the start slide once the carousel exists and has slides.
  useEffect(() => {
    if (api && sorted.length) api.scrollTo(start, true);
  }, [api, sorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!api) return;
    const sync = () => setSelected(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => { api.off("select", sync); api.off("reInit", sync); };
  }, [api]);

  return (
    <section>
      <SyncLine s={sync} />
      <SectionHeading title="Today" count={classes?.length} />
      {classes === undefined || (classes.length === 0 && sync.online && !sync.refreshed) ? <Skeleton className="h-16 w-full" /> : classes.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No classes today." />
      ) : (
        <>
          <Carousel setApi={setApi} className="md:mx-12">
            <CarouselContent role="list" aria-label="Today's periods">
              {sorted.map((c, i) => {
                const marked = Boolean(c.sessionId) || outbox.some((o) => o.key === c.key);
                return (
                  <CarouselItem key={c.key} role="listitem">
                    <Link href={`/mark#${encodeURIComponent(c.key)}`} className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-sheet transition-colors hover:bg-muted/50 active:bg-muted">
                      <span className="min-w-0">
                        <span className="tabular-nums">{c.startTime}</span> <span className="font-medium">{c.subjectName}</span>
                        {i === nowIdx && <span className="ml-2 rounded-full bg-data-soft px-2 py-0.5 align-middle text-xs font-medium text-data">Now</span>}
                        <span className="block truncate text-muted-foreground">{c.batchCode}</span>
                      </span>
                      <StatusPill tone={marked ? "ok" : "late"}>{marked ? "Marked" : "To mark"}</StatusPill>
                    </Link>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="hidden md:inline-flex" />
            <CarouselNext className="hidden md:inline-flex" />
          </Carousel>
          {sorted.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {sorted.map((c, i) => (
                <button key={c.key} type="button" aria-label={`Class ${i + 1} of ${sorted.length}`} aria-current={i === selected}
                  onClick={() => api?.scrollTo(i)}
                  className={cn("h-1.5 rounded-full transition-all", i === selected ? "w-4 bg-data" : "w-1.5 bg-border")} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
