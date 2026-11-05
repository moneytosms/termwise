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
        <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.015em] md:text-2xl">Today, {name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })}
          {classes && classes.length > 0 && <> · <span className="text-foreground">{classes.filter(marked).length} of {classes.length} classes marked</span></>}
        </p>
        <div className="mt-2.5"><SyncLine s={sync} /></div>
      </div>

      {classes === undefined || now === null || (classes.length === 0 && sync.online && !sync.refreshed) ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading"><Skeleton className="h-12 w-full" /><Skeleton className="h-44 w-full" /></div>
      ) : classes.length === 0 ? (
        <EmptyState icon={CalendarDays} title={sync.online ? "No classes today." : "Today's classes aren't on this phone yet. Connect once to download them."}
          action={<Link href="/classes" className={buttonVariants({ variant: "outline", size: "sm" })}>See this week</Link>} />
      ) : (
        <>
          <ol aria-label="Today's periods" className="-mx-4 flex snap-x gap-px overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
            {[...classes].sort((a, b) => a.period - b.period).map((c, i, all) => {
              const on = hero?.cls.key === c.key;
              return (
                <li key={c.key} className="min-w-28 flex-1 snap-start">
                  <Link href={markHref(c)} aria-current={on ? "step" : undefined}
                    className={cn("flex h-full flex-col gap-0.5 px-3 py-2.5 text-xs transition-colors",
                      i === 0 && "rounded-l-xl", i === all.length - 1 && "rounded-r-xl",
                      on ? "bg-foreground text-background" : "bg-card shadow-sheet hover:bg-muted/60")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium tabular-nums">{c.startTime}</span>
                      <span className={cn("size-2 rounded-full", marked(c) ? "bg-ok" : c.endTime <= (now ?? "") ? "bg-late" : on ? "bg-background/40" : "bg-input")} aria-hidden />
                    </span>
                    <span className={cn("truncate", on ? "text-background/70" : "text-muted-foreground")}>P{c.period} · {c.batchCode}</span>
                    <span className={cn(on ? "text-background/90" : marked(c) ? "text-ok" : "text-muted-foreground")}>{marked(c) ? "Marked" : c.endTime <= (now ?? "") ? "To mark" : on ? (hero?.running ? "Now" : "Next") : "Later"}</span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          {hero ? (
            <section className="rounded-xl bg-card p-5 shadow-sheet md:p-6">
              <p className="text-sm text-muted-foreground">{hero.running ? <span className="font-medium text-data">Now</span> : `Next at ${hero.cls.startTime}`} · Period {hero.cls.period}{hero.cls.periodCount > 1 && ` (${hero.cls.periodCount} periods)`}</p>
              <h2 className="mt-1 text-xl leading-snug font-semibold tracking-tight">{hero.cls.subjectName}</h2>
              <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border text-sm shadow-sheet">
                {[["Batch", hero.cls.batchCode], ["Students", hero.cls.roster.length], ["Ends", hero.cls.endTime]].map(([k, v]) => (
                  <div key={k} className="bg-card px-3 py-2.5"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium tabular-nums">{v}</dd></div>
                ))}
              </dl>
              <Link href={markHref(hero.cls)} className={cn(buttonVariants(), "mt-4 h-12 w-full text-base")}>
                {marked(hero.cls) ? <><CheckCircle2 className="size-5" aria-hidden />Edit attendance</> : <><ClipboardCheck className="size-5" aria-hidden />Mark attendance</>}
              </Link>
            </section>
          ) : (
            <section className="rounded-xl bg-card p-5 text-sm text-muted-foreground shadow-sheet">No more classes today.</section>
          )}

          {unmarkedPast.length > 0 && (
            <section>
              <SectionHeading title="Still to mark" count={unmarkedPast.length} />
              <ul className="divide-y divide-rule overflow-hidden rounded-xl bg-card shadow-sheet">
                {unmarkedPast.map((c) => (
                  <li key={c.key}>
                    <Link href={markHref(c)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/60 active:bg-muted">
                      <span className="w-11 shrink-0 text-muted-foreground tabular-nums">{c.startTime}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.subjectName}</span><span className="block text-xs text-muted-foreground">{c.batchCode} · Period {c.period}</span></span>
                      <StatusPill tone="late">To mark</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </div>
        </>
      )}

      {cards && (
        <section className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          <ModuleCard href="/marks" icon={BookOpenCheck} title="Marks due" description="Subjects still to submit" count={cards.marksDue} />
          <ModuleCard href="/students?flag=1" icon={ListTodo} title="Mentor tasks" description="Students to follow up" count={cards.openTasks} />
        </section>
      )}
    </div>
  );
}
