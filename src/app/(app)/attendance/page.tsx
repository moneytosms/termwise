import Link from "next/link";
import { z } from "zod";
import { PageHeader, SectionHeading, StatCard, StatStrip, StatusPill } from "@/components/page";
import { EmptyState } from "@/components/states";
import { cn } from "@/lib/utils";
import { requireCan } from "@/server/access";
import { ConflictPanel } from "./conflict-panel";
import { ConflictsTable } from "./conflicts-table";
import { getConflictDetail, getSessionDetail, listConflicts, listSessions, openConflictCount, sessionStats } from "./queries";
import { SessionPanel } from "./session-panel";
import { SessionsTable } from "./sessions-table";

const isUuid = (s?: string) => !!s && z.uuid().safeParse(s).success;

export default async function AttendancePage({ searchParams }: {
  searchParams: Promise<{ tab?: string; filter?: string; session?: string; conflict?: string }>;
}) {
  const v = await requireCan("attendance");
  const { tab, filter, session, conflict } = await searchParams;
  const onConflicts = tab === "conflicts";
  const base = new URLSearchParams({ tab: onConflicts ? "conflicts" : "sessions" });
  if (!onConflicts && filter === "unmarked") base.set("filter", "unmarked");
  const baseQs = base.toString();

  const [open, stats, sessions, conflicts] = await Promise.all([
    openConflictCount(v),
    onConflicts ? null : sessionStats(v),
    onConflicts ? null : listSessions(v),
    onConflicts ? listConflicts(v) : null,
  ]);
  const sessionDetail = !onConflicts && session && isUuid(session) ? await getSessionDetail(v, session) : null;
  const conflictDetail = onConflicts && conflict && isUuid(conflict) ? await getConflictDetail(v, conflict) : null;

  const tabLink = (key: "sessions" | "conflicts", label: string, count?: number) => {
    const active = key === "conflicts" === onConflicts;
    return (
      <Link href={`/attendance?tab=${key}`} aria-current={active ? "page" : undefined}
        className={cn("-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
          active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
        {label}
        {count !== undefined && <span className="rounded-full bg-muted px-1.5 tabular-nums text-xs">{count}</span>}
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="Attendance" description="Sessions marked across the campus and sync conflicts to resolve." />
      <nav aria-label="Attendance tabs" className="mb-6 flex gap-1 border-b">
        {tabLink("sessions", "Sessions")}
        {tabLink("conflicts", "Conflicts", open)}
      </nav>

      {stats && sessions && (
        <>
          <StatStrip cols={3}>
            <StatCard label="Sessions marked today" value={stats.markedToday} tone="ok" />
            <StatCard label="Classes not marked today" value={stats.unmarked.length} tone="late"
              href={`/attendance?tab=sessions&filter=unmarked`} />
            <StatCard label="Marked the same day, 7 days" value={stats.rate === null ? "–" : `${stats.rate}%`} />
          </StatStrip>

          {filter === "unmarked" && (
            <>
              <SectionHeading title="Not marked today" count={stats.unmarked.length} />
              {stats.unmarked.length === 0 ? (
                <EmptyState title="No unmarked classes today." action={<Link href="/attendance?tab=sessions" className="text-sm font-medium underline-offset-4 hover:underline">Show all sessions</Link>} />
              ) : (
                <ul className="divide-y rounded-xl bg-card shadow-sheet">
                  {stats.unmarked.map((s) => (
                    <li key={`${s.batchId}:${s.subjectId}:${s.period}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span><span className="font-medium">{s.subject}</span> <span className="text-muted-foreground">· {s.batch} · Period {s.period} · {s.startTime}</span></span>
                      <StatusPill tone="late">Not marked</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <SectionHeading title="Sessions" count={sessions.length} />
          <SessionsTable rows={sessions} base={baseQs} />
          {!onConflicts && session && (
            <SessionPanel key={session} detail={sessionDetail} base={baseQs} />
          )}
        </>
      )}

      {conflicts && (
        <>
          <SectionHeading title="Sync conflicts" count={conflicts.length} />
          <ConflictsTable rows={conflicts} base={baseQs} />
          {conflict && <ConflictPanel key={conflict} detail={conflictDetail} base={baseQs} />}
        </>
      )}
    </>
  );
}
