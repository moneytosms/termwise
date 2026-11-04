"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";
import { SyncLine } from "@/components/sync-line";
import { nextStatus, type AttendanceStatus } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import { offlineDb } from "@/offline/db";
import { flushOutbox, requestBackgroundSync } from "@/offline/sync";
import { useSync } from "@/offline/use-sync";

const STYLE: Record<AttendanceStatus, string> = { present: "", absent: "bg-absent-soft", late: "bg-late-soft" };
const LABEL: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late" };
const LABEL_COLOUR: Record<AttendanceStatus, string> = { present: "text-muted-foreground", absent: "font-medium text-absent", late: "font-medium text-late" };

export function MarkAttendance() {
  // The class travels in the hash: a query string would make Next refetch this page, which fails offline.
  const key = useSyncExternalStore(() => () => {}, () => decodeURIComponent(location.hash.slice(1)), () => "");
  const router = useRouter();
  const sync = useSync();
  const cls = useLiveQuery(async () => (await offlineDb.today.get(key)) ?? null, [key]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [find, setFind] = useState("");
  const [confirming, setConfirming] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);

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
    return q ? cls.roster.filter((s) => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)) : cls.roster;
  }, [cls, find]);

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
    <div className="-mx-4 -mt-6 pb-28 md:mx-auto md:mt-0 md:max-w-xl">
      <div className="sticky top-0 z-30 space-y-2 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/home" aria-label="Back to Home" className={buttonVariants({ variant: "ghost", size: "icon" })}><ArrowLeft className="size-5" aria-hidden /></Link>
          <div className="min-w-0">
            <h1 className="truncate font-semibold">{cls.subjectName}</h1>
            <p className="text-xs text-muted-foreground">{cls.batchCode} · Period {cls.period}{cls.periodCount > 1 && ` (${cls.periodCount} periods)`} · {cls.startTime}</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input ref={findRef} aria-label="Find by name or roll number" placeholder="Find by name or roll number" className="pl-9" value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        {marked.length > 0 && (
          <ul aria-label="Absent and late" className="flex gap-1.5 overflow-x-auto">
            {marked.map((s) => (
              <li key={s.id}>
                <button onClick={() => setStatuses((x) => ({ ...x, [s.id]: "present" }))} aria-label={`Undo ${s.name}`}
                  className={cn("flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs", STYLE[status(s.id)])}>
                  {s.name.split(" ")[0]} · {LABEL[status(s.id)]}<X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul>
        {shown.map((s) => (
          <li key={s.id}>
            <button onClick={() => tap(s.id)} aria-label={`${s.name}, ${LABEL[status(s.id)]}. Tap to change.`}
              className={cn("flex min-h-14 w-full items-center gap-3 border-b px-4 text-left", STYLE[status(s.id)])}>
              <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{s.rollNo.split("-").pop()}</span>
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className={cn("text-sm", LABEL_COLOUR[status(s.id)])}>{LABEL[status(s.id)]}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No one matches “{find}”.</li>}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-50 space-y-2 border-t bg-card px-4 py-3 md:left-60">
        <SyncLine s={sync} />
        <Button className="h-12 w-full text-base" onClick={() => setConfirming(true)}>
          Submit · {cls.roster.length - absent.length} present, {absent.length} absent
        </Button>
      </div>

      <Sheet open={confirming} onOpenChange={setConfirming}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Save attendance?</SheetTitle>
            <SheetDescription>{cls.subjectName} · {cls.batchCode} · {cls.roster.length} students</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 text-sm">
            <p><span className="font-medium text-absent">Absent ({absent.length})</span>: {absent.map((s) => s.name).join(", ") || "None"}</p>
            <p><span className="font-medium text-late">Late ({late.length})</span>: {late.map((s) => s.name).join(", ") || "None"}</p>
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
