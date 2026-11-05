import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { CountUp } from "@/components/count-up";
import { AttendanceMeter, PageHeader, SectionHeading, StatusPill, type Tone } from "@/components/page";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { attendancePercent, isShortage, type AttendanceStatus } from "@/domain/attendance";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { attendanceEntry, attendanceSession, leaveRequest, subject } from "@/server/schema";
import { plannerLine } from "./planner";

const REGISTER_LIMIT = 60;
const WORD: Record<AttendanceStatus, [string, Tone]> = { present: ["Present", "ok"], late: ["Late", "late"], absent: ["Absent", "absent"] };
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ subject?: string; q?: string; status?: string; from?: string; to?: string }> }) {
  const v = await requirePortal();
  const [s, rows, leaves] = await Promise.all([
    portalStudent(v.studentId),
    db.select({
      subjectId: subject.id, code: subject.code, subject: subject.name, status: attendanceEntry.status,
      periods: attendanceSession.periodCount, date: attendanceSession.date, period: attendanceSession.period,
    }).from(attendanceEntry)
      .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
      .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
      .where(eq(attendanceEntry.studentId, v.studentId))
      .orderBy(desc(attendanceSession.date), desc(attendanceSession.period)),
    db.select({ fromDate: leaveRequest.fromDate, toDate: leaveRequest.toDate, kind: leaveRequest.kind }).from(leaveRequest)
      .where(and(eq(leaveRequest.studentId, v.studentId), eq(leaveRequest.status, "approved"))),
  ]);
  if (!s) return null;

  const { subject: wanted, q = "", status = "", from = "", to = "" } = await searchParams;
  const cutoff = s.cutoff;
  const you = v.role === "student" ? "Your" : `${s.name.split(" ")[0]}'s`;

  const groups = new Map<number, { subjectId: number; code: string; name: string; rows: typeof rows }>();
  for (const r of rows) {
    const g = groups.get(r.subjectId) ?? { subjectId: r.subjectId, code: r.code, name: r.subject, rows: [] };
    g.rows.push(r);
    groups.set(r.subjectId, g);
  }
  const subjects = [...groups.values()].map((g) => {
    const held = g.rows.reduce((n, r) => n + r.periods, 0);
    const attended = g.rows.reduce((n, r) => n + (r.status === "absent" ? 0 : r.periods), 0);
    return { ...g, held, attended, percent: attendancePercent(g.rows) };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const overall = attendancePercent(rows);
  const shortSubjects = subjects.filter((x) => isShortage(x.percent, cutoff));
  const finding = overall === null ? "No classes marked yet."
    : shortSubjects.length > 0 ? `Below the ${cutoff}% line in ${shortSubjects.map((x) => x.name).join(", ")}.`
    : `Above the ${cutoff}% line in every subject.`;

  const filter = subjects.find((x) => x.code === wanted);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (!filter || r.subjectId === filter.subjectId)
    && (!needle || `${r.subject} ${r.code}`.toLowerCase().includes(needle))
    && (!status || r.status === status)
    && (!from || r.date >= from) && (!to || r.date <= to));
  const filtered = Boolean(needle || status || from || to);
  const register = shown.slice(0, REGISTER_LIMIT);
  const days: { date: string; items: typeof register }[] = [];
  for (const r of register) {
    const last = days.at(-1);
    if (last?.date === r.date) last.items.push(r);
    else days.push({ date: r.date, items: [r] });
  }
  const leaveOn = (date: string) => leaves.find((l) => l.fromDate <= date && date <= l.toDate);
  const hrefFor = (code?: string) => {
    const qs = new URLSearchParams(Object.entries({ subject: code ?? "", q, status, from, to }).filter(([, val]) => val)).toString();
    return qs ? `/my/attendance?${qs}` : "/my/attendance";
  };

  return (
    <>
      <PageHeader title="Attendance" description={`Line: ${cutoff}% per subject`} />

      <section className="overflow-hidden rounded-2xl bg-card shadow-sheet" aria-label="Overall attendance">
        <div className="p-5">
          <p className="text-sm text-muted-foreground">{you} attendance, all subjects</p>
          <p className={cn("mt-1 text-[2.5rem] leading-none font-medium tracking-[-0.03em] tabular-nums", overall !== null && isShortage(overall, cutoff) && "text-absent")}>
            {overall === null ? "–" : <CountUp value={overall} decimals={1} suffix="%" />}
          </p>
          {overall !== null && (
            <div className="relative mt-5 h-2.5 rounded-full bg-secondary" aria-hidden>
              <div className={cn("h-full origin-left animate-[grow-x_900ms_cubic-bezier(0.25,1,0.5,1)_both] rounded-full", isShortage(overall, cutoff) ? "bg-absent" : "bg-data")} style={{ width: `${overall}%` }} />
              <div className="absolute -inset-y-1.5 w-0.5 rounded bg-foreground" style={{ left: `${cutoff}%` }} />
              <span className="absolute top-5 -translate-x-1/2 text-xs text-muted-foreground" style={{ left: `${cutoff}%` }}>{cutoff}% line</span>
            </div>
          )}
          <p className="mt-9 text-sm">{finding}</p>
        </div>
      </section>

      <SectionHeading title="By subject" count={subjects.length} />
      {subjects.length === 0 ? <EmptyState title="No sessions marked yet." /> : (
        <ul className="divide-y divide-rule rounded-xl bg-card px-4 text-sm shadow-sheet">
          {subjects.map((x) => (
            <li key={x.subjectId} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate">{x.name}</span>
                  {isShortage(x.percent, cutoff) && <StatusPill tone="absent">Shortage</StatusPill>}
                </span>
                <span className="block text-xs text-muted-foreground">{x.attended} of {x.held} periods · {plannerLine(x.attended, x.held, cutoff)}</span>
              </span>
              <AttendanceMeter pct={x.percent} threshold={cutoff} />
            </li>
          ))}
        </ul>
      )}

      <SectionHeading title="Register" count={shown.length} />
      {subjects.length > 0 && (
        <nav aria-label="Filter by subject" className="mb-4 flex flex-wrap gap-2 text-sm">
          {[{ code: undefined, label: "All" }, ...subjects.map((x) => ({ code: x.code, label: x.code }))].map((f) => {
            const active = f.code === filter?.code;
            return (
              <Link key={f.label} href={hrefFor(f.code)} aria-current={active ? "page" : undefined}
                className={cn("inline-flex h-8 items-center rounded-full px-3 transition-colors", active ? "bg-foreground text-background" : "bg-secondary text-foreground/80 hover:bg-muted")}>
                {f.label}
              </Link>
            );
          })}
        </nav>
      )}

      {rows.length > 0 && (
        <form className="mb-4 flex flex-wrap items-center gap-2 text-sm" role="search" aria-label="Filter register">
          {filter && <input type="hidden" name="subject" value={filter.code} />}
          <Input name="q" type="search" placeholder="Search subject" aria-label="Search subject" defaultValue={q} className="w-full sm:w-48" />
          <select name="status" aria-label="Status" defaultValue={status} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">Any status</option>
            {Object.entries(WORD).map(([k, [w]]) => <option key={k} value={k}>{w}</option>)}
          </select>
          <Input name="from" type="date" aria-label="From date" defaultValue={from} className="w-auto" />
          <Input name="to" type="date" aria-label="To date" defaultValue={to} className="w-auto" />
          <Button type="submit" variant="outline" size="sm">Apply</Button>
          {filtered && <Link href={filter ? `/my/attendance?subject=${encodeURIComponent(filter.code)}` : "/my/attendance"} className="text-muted-foreground underline-offset-4 hover:underline">Clear</Link>}
        </form>
      )}

      {register.length === 0 ? <EmptyState title={filtered ? "No sessions match these filters." : "No sessions marked yet."} /> : (
        <div className="space-y-5">
          {days.map((day) => (
            <section key={day.date} aria-label={dayLabel(day.date)}>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{dayLabel(day.date)}</h3>
              <ul className="divide-y divide-rule rounded-xl bg-card px-4 text-sm shadow-sheet">
                {day.items.map((r) => {
                  const leave = r.status === "absent" ? leaveOn(r.date) : undefined;
                  const [word, tone] = WORD[r.status];
                  return (
                    <li key={`${r.date}-${r.period}-${r.subjectId}`} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate">{r.subject}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.periods > 1 ? `Periods ${r.period}–${r.period + r.periods - 1}` : `Period ${r.period}`}
                          {leave && ` · ${leave.kind === "medical" ? "Medical" : "Leave"}`}
                        </span>
                      </span>
                      {leave ? <StatusPill>On leave</StatusPill> : <StatusPill tone={tone}>{word}</StatusPill>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {register.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {shown.length > REGISTER_LIMIT ? `Showing ${REGISTER_LIMIT} of ${shown.length} sessions. ` : ""}
          Approved leave is shown, but still counts as absent toward the % (college rule).
        </p>
      )}
    </>
  );
}
