"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";
import { StatusPill } from "@/components/page";
import { SyncLine } from "@/components/sync-line";
import { nextStatus, type AttendanceStatus } from "@/domain/attendance";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { offlineDb } from "@/offline/db";
import { flushOutbox, requestBackgroundSync } from "@/offline/sync";
import { useSync } from "@/offline/use-sync";

const STYLE: Record<AttendanceStatus, string> = { present: "", absent: "bg-absent-soft text-absent", late: "bg-late-soft text-late" };
const LABEL: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late" };

export function MarkAttendance() {
  // The class travels in the hash: a query string would make Next refetch this page, which fails offline.
  const key = useSyncExternalStore(() => () => {}, () => decodeURIComponent(location.hash.slice(1)), () => "");
  const router = useRouter();
  const sync = useSync();
  const cls = useLiveQuery(async () => (await offlineDb.today.get(key)) ?? null, [key]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [find, setFind] = useState("");
  const [filter, setFilter] = useState<"all" | "absent" | "late">("all");
  const [confirming, setConfirming] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();

  // Start from whatever exists: this phone's queued copy, else the saved session, else everyone Present.
  useEffect(() => {
    if (!cls || loaded) return;
    void (async () => {
      const queued = await offlineDb.outbox.get(key);
      let entries = queued?.entries;
      if (!entries && cls.sessionId) {
        const r = await fetch(`/api/sessions/${cls.sessionId}`).catch(() => null);
        if (r?.ok) entries = (await r.json()).entries;
      }
      if (entries) setStatuses(Object.fromEntries(entries.map((e) => [e.studentId, e.status])));
      setLoaded(true);
    })();
  }, [cls, key, loaded]);

  const shown = useMemo(() => {
    if (!cls) return [];
    const q = find.trim().toLowerCase();
    return cls.roster.filter((s) => (filter === "all" || (statuses[s.id] ?? "present") === filter)
      && (!q || s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)));
  }, [cls, find, filter, statuses]);

  if (cls === undefined || (cls === null && sync.online && !sync.refreshed)) return <div className="space-y-2" aria-busy="true" aria-label="Loading">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  if (cls === null) {
    return (
      <EmptyState title="This class isn't on this phone. Connect once to download today's classes."
        action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={sync.retry}>Retry</Button><Link href="/home" className={buttonVariants({ size: "sm", variant: "ghost" })}>Back to Home</Link></div>} />
    );
  }

  const status = (id: number): AttendanceStatus => statuses[id] ?? "present";
  const tap = (id: number) => {
    setStatuses((s) => ({ ...s, [id]: nextStatus(s[id] ?? "present") }));
    if (find) { setFind(""); findRef.current?.focus(); }
  };
  const marked = cls.roster.filter((s) => status(s.id) !== "present");
  const absent = marked.filter((s) => status(s.id) === "absent");
  const late = marked.filter((s) => status(s.id) === "late");

  async function save() {
    if (!cls) return;
    const existing = await offlineDb.outbox.get(key);
    await offlineDb.outbox.put({
      key, state: "pending",
      sessionId: cls.sessionId ?? existing?.sessionId ?? crypto.randomUUID(),
      batchId: cls.batchId, subjectId: cls.subjectId, date: cls.date, period: cls.period, periodCount: cls.periodCount,
      entries: cls.roster.map((s) => ({ studentId: s.id, status: status(s.id) })),
      editedAt: new Date().toISOString(), markedBy: cls.staffId,
    });
    void requestBackgroundSync();
    void flushOutbox();
    router.push("/home");
  }

  return (
    <div className="-mx-4 -mt-5 pb-36 md:mx-auto md:mt-0 md:max-w-xl md:pb-28">
      <div className="sticky top-13 z-30 space-y-3 border-b border-border/70 bg-background px-4 py-3 md:top-0 md:border-0">
        <div className="flex items-center gap-2">
          <Link href="/home" aria-label="Back to Home" className={buttonVariants({ variant: "ghost", size: "icon" })}><ArrowLeft className="size-5" aria-hidden /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg leading-tight font-semibold tracking-tight">{cls.subjectName}</h1>
            <p className="text-xs text-muted-foreground">{cls.batchCode} · Period {cls.period}{cls.periodCount > 1 && ` (${cls.periodCount} periods)`} · {cls.startTime}</p>
          </div>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${cls.roster.length - marked.length} present, ${late.length} late, ${absent.length} absent`}>
          <span className="bg-data transition-[flex-grow] duration-300" style={{ flexGrow: cls.roster.length - marked.length }} />
          <span className="bg-late transition-[flex-grow] duration-300" style={{ flexGrow: late.length }} />
          <span className="bg-absent transition-[flex-grow] duration-300" style={{ flexGrow: absent.length }} />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input ref={findRef} aria-label="Find by name or roll number" placeholder="Find by name or roll number" className="pl-9" value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        <div role="group" aria-label="Show" className="inline-flex gap-1 rounded-lg bg-secondary p-1 text-xs font-medium">
          {([["all", "All"], ["absent", `Absent (${absent.length})`], ["late", `Late (${late.length})`]] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
              className={cn("h-7 rounded-md px-3 transition-colors", filter === v ? "bg-card text-foreground shadow-sheet" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <p>Tap once for absent, twice for late, three times to reset.</p>
        <p className="flex gap-2"><span className="font-medium text-absent">A</span>absent<span className="font-medium text-late">L</span>late</p>
      </div>

      <ul className="mx-4 mt-3 divide-y divide-rule overflow-hidden rounded-xl bg-card shadow-sheet">
        {shown.map((s) => (
          <li key={s.id}>
            <button onClick={() => tap(s.id)} aria-label={`${s.name}, ${LABEL[status(s.id)]}. Tap to change.`}
              className={cn("flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors duration-100 hover:bg-muted/50 active:bg-muted", STYLE[status(s.id)])}>
              <span className="w-11 shrink-0 text-sm text-muted-foreground tabular-nums">{s.rollNo.split("-").pop()}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{s.name}</span>
              {status(s.id) === "present"
                ? <span className="text-sm text-muted-foreground">Present</span>
                : <StatusPill tone={status(s.id) === "absent" ? "absent" : "late"}>{LABEL[status(s.id)]}</StatusPill>}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">{find ? <>No one matches “{find}”.</> : filter === "all" ? "No students." : `No one ${filter} yet.`}</li>}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-50 space-y-2.5 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:left-60">
        <SyncLine s={sync} />
        <Button className="h-12 w-full text-base md:mx-auto md:flex md:max-w-xl" onClick={() => (settings.confirmAttendance ? setConfirming(true) : void save())}>
          Submit · {cls.roster.length - absent.length} present, {absent.length} absent
        </Button>
      </div>

      <Sheet open={confirming} onOpenChange={setConfirming}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Save attendance?</SheetTitle>
            <SheetDescription>{cls.subjectName} · {cls.batchCode} · {cls.roster.length} students</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              {([["Present", cls.roster.length - marked.length, "bg-data-soft text-data"], ["Absent", absent.length, "bg-absent-soft text-absent"], ["Late", late.length, "bg-late-soft text-late"]] as const).map(([label, n, tone]) => (
                <div key={label} className={cn("rounded-lg px-2 py-2.5", tone)}>
                  <p className="text-lg leading-none font-semibold tabular-nums">{n}</p>
                  <p className="mt-1 text-xs">{label}</p>
                </div>
              ))}
            </div>
            {([["Absent", absent, "text-absent", "No one absent"], ["Late", late, "text-late", "No one late"]] as const).map(([label, group, tone, empty]) => (
              <div key={label}>
                <p className={cn("font-medium", tone)}>{label} ({group.length})</p>
                {group.length === 0 ? <p className="mt-1 text-muted-foreground">{empty}</p> : (
                  <ul className="mt-1 divide-y divide-rule">
                    {group.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate">{s.name}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{s.rollNo}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button className="h-12" onClick={save}>Confirm and save</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Keep editing</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
