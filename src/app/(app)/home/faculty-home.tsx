"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpenCheck, CalendarDays, CheckCircle2, ClipboardCheck, ListTodo } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";
import { ModuleCard, SectionHeading, StatusPill } from "@/components/page";
import { SyncLine } from "@/components/sync-line";
import { currentOrNext, istTime } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import { offlineDb, type TodayClass } from "@/offline/db";
import { useSync } from "@/offline/use-sync";

type Cards = { marksDue: number; openTasks: number };
const markHref = (c: TodayClass) => `/mark#${encodeURIComponent(c.key)}`;

function subscribeMinute(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}

export function FacultyHome({ name }: { name: string }) {
  const sync = useSync();
  const classes = useLiveQuery(() => offlineDb.today.toArray());
  const outbox = useLiveQuery(() => offlineDb.outbox.toArray(), [], []);
  const [cards, setCards] = useState<Cards | null>(null);
  const now = useSyncExternalStore(subscribeMinute, () => istTime(), () => null);

  useEffect(() => {
    // Tasks need a connection and hold more than the offline data rule allows, so they aren't kept on the phone.
    fetch("/api/faculty-cards").then((r) => (r.ok ? r.json() : null)).then(setCards).catch(() => setCards(null));
  }, []);

  const marked = (c: TodayClass) => Boolean(c.sessionId) || outbox.some((o) => o.key === c.key);
  const hero = classes && now ? currentOrNext(classes, now) : null;
  const unmarkedPast = classes && now ? classes.filter((c) => c.endTime <= now && !marked(c)) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome {name.split(" ")[0]}</h1>
        <div className="mt-2"><SyncLine s={sync} /></div>
      </div>

      {classes === undefined || now === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading"><Skeleton className="h-12 w-full" /><Skeleton className="h-44 w-full" /></div>
      ) : classes.length === 0 ? (
        <EmptyState icon={CalendarDays} title={sync.online ? "No classes today." : "Today's classes aren't on this phone yet. Connect once to download them."}
          action={<Link href="/classes" className={buttonVariants({ variant: "outline", size: "sm" })}>See this week</Link>} />
      ) : (
        <>
          <ol aria-label="Today's periods" className="flex gap-2 overflow-x-auto pb-1">
            {[...classes].sort((a, b) => a.period - b.period).map((c) => (
              <li key={c.key}>
                <Link href={markHref(c)} className={cn("flex min-w-20 flex-col rounded-xl border bg-card px-3 py-2 text-xs",
                  hero?.cls.key === c.key && "border-primary ring-1 ring-primary")}>
                  <span className="font-mono">{c.startTime}</span>
                  <span className="truncate text-muted-foreground">{c.batchCode}</span>
                  <span className={marked(c) ? "text-ok" : "text-muted-foreground"}>{marked(c) ? "Marked" : "To mark"}</span>
                </Link>
              </li>
            ))}
          </ol>

          {hero ? (
            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{hero.running ? "Now" : `Next at ${hero.cls.startTime}`} · Period {hero.cls.period}{hero.cls.periodCount > 1 && ` (${hero.cls.periodCount} periods)`}</p>
              <h2 className="mt-1 text-xl font-semibold">{hero.cls.subjectName}</h2>
              <p className="text-sm text-muted-foreground">{hero.cls.batchCode} · {hero.cls.roster.length} students · until {hero.cls.endTime}</p>
              <Link href={markHref(hero.cls)} className={cn(buttonVariants(), "mt-4 h-12 w-full text-base")}>
                {marked(hero.cls) ? <><CheckCircle2 className="size-5" aria-hidden />Edit attendance</> : <><ClipboardCheck className="size-5" aria-hidden />Mark attendance</>}
              </Link>
            </section>
          ) : (
            <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No more classes today.</section>
          )}

          {unmarkedPast.length > 0 && (
            <section>
              <SectionHeading title="Still to mark" count={unmarkedPast.length} />
              <ul className="space-y-2">
                {unmarkedPast.map((c) => (
                  <li key={c.key}>
                    <Link href={markHref(c)} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                      <span>{c.subjectName} <span className="text-muted-foreground">· {c.batchCode} · {c.startTime}</span></span>
                      <StatusPill tone="late">To mark</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {cards && (
        <section className="grid gap-3 sm:grid-cols-2">
          <ModuleCard href="/marks" icon={BookOpenCheck} title="Marks due" description="Subjects still to submit" count={cards.marksDue} />
          <ModuleCard href="/students?flag=1" icon={ListTodo} title="Mentor tasks" description="Students to follow up" count={cards.openTasks} />
        </section>
      )}
    </div>
  );
}
