import Link from "next/link";
import { HBars, StackedBar, TrendLine } from "@/components/charts";
import { PageHeader, Panel, PanelLink, StatCard, StatStrip, StatusPill } from "@/components/page";
import { sessionStats } from "../attendance/queries";
import { istDate } from "@/domain/attendance";
import { dues } from "@/domain/fees";
import type { Viewer } from "@/server/access";
import { cn, rupees } from "@/lib/utils";
import {
  activeFlags, addDays, aging, campusProgrammes, countShort, dailyTotals, feeRows, feesToDate, flagsCreated, marksByStatus,
  openConflicts, shortageByGroup, studentAttendance, subjectAttendance, weeklyTrend,
} from "./queries";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const LINE = 75;
/** A subject turns red once this share of its students is below the line. */
const RED_SHARE = 25;

/** "+3 vs last week", "−2 vs last week" or "same as last week". */
const vsLastWeek = (now: number, then: number, fmt: (n: number) => string = String) =>
  now === then ? "same as last week" : `${now > then ? "+" : "−"}${fmt(Math.abs(now - then))} vs last week`;

const weekLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">{children}</p>;
}

export async function AdminHome({ viewer, programmeId }: { viewer: Viewer; programmeId?: number }) {
  const today = istDate();
  const lastWeek = addDays(today, -7);
  const weekAgo = daysAgo(7);
  const twoWeeksAgo = daysAgo(14);

  const [nowRows, thenRows, subjects, days, fees, active, flagsNew, flagsPrior, conflicts, conflictsThen, marks, stats, programmes] = await Promise.all([
    studentAttendance(viewer, today),
    studentAttendance(viewer, lastWeek),
    subjectAttendance(viewer),
    dailyTotals(viewer, addDays(today, -55)),
    feeRows(viewer, weekAgo),
    activeFlags(viewer),
    flagsCreated(viewer, weekAgo),
    flagsCreated(viewer, twoWeeksAgo, weekAgo),
    openConflicts(viewer),
    openConflicts(viewer, weekAgo),
    marksByStatus(viewer),
    sessionStats(viewer),
    campusProgrammes(viewer),
  ]);

  const short = countShort(nowRows);
  const shortThen = countShort(thenRows);
  const overdue = dues(fees, today).overduePaise;
  const overdueThen = dues(fees.map((f) => ({ ...f, paidPaise: f.paidBeforePaise })), lastWeek).overduePaise;
  const { billedPaise, collectedPaise } = feesToDate(fees, today);
  const agingRows = aging(fees, today);
  const agingTotal = agingRows.reduce((t, b) => t + b.paise, 0);

  const programme = programmes.find((p) => p.id === programmeId) ?? null;
  const trend = weeklyTrend(days, today, programme?.id ?? null).map((w) => ({
    label: weekLabel(w.weekStart), pct: w.pct,
    title: `Week of ${weekLabel(w.weekStart)}: ${w.pct === null ? "no sessions" : `${w.pct}%`}`,
  }));
  // Drop weeks before the term's first session so the line uses the full width.
  const first = trend.findIndex((w) => w.pct !== null);
  if (first > 0) trend.splice(0, Math.min(first, trend.length - 2));
  const trendNow = trend[trend.length - 1].pct;
  const hasTrend = first >= 0;
  const held = trend.flatMap((w) => (w.pct === null ? [] : [w.pct]));
  const line = programme?.cutoff ?? LINE;
  const prev = trend.length > 1 ? trend[trend.length - 2].pct : null;
  const toggles = [{ code: "All", href: "/home", on: !programme }, ...programmes.map((p) => ({ code: p.code, href: `/home?programme=${p.id}`, on: programme?.id === p.id }))];

  const subjectGroups = shortageByGroup(subjects);
  const unmarked = stats.unmarked.length;
  const unpaidPaise = Math.max(0, billedPaise - collectedPaise);
  const subjectsTotal = marks.draft + marks.submitted + marks.locked;

  const dateLine = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
  const finding = [
    unmarked > 0 && `${unmarked} ${unmarked === 1 ? "class" : "classes"} not marked yet`,
    conflicts > 0 && `${conflicts} sync ${conflicts === 1 ? "conflict" : "conflicts"} to resolve`,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title="Today" description={<>{dateLine}{finding && <> · <span className="text-foreground">{finding}</span></>}</>} />

      <StatStrip cols={4}>
        <StatCard label="Students below the line" value={short} href="/students?attendance=Shortage" tone={short > 0 ? "absent" : "default"} hint={vsLastWeek(short, shortThen)} />
        <StatCard label="Open at-risk flags" value={active} href="/risk" hint={`${flagsNew} new this week · ${vsLastWeek(flagsNew, flagsPrior)}`} />
        <StatCard label="Unresolved sync conflicts" value={conflicts} href="/attendance?tab=conflicts" tone={conflicts > 0 ? "absent" : "default"} hint={vsLastWeek(conflicts, conflictsThen)} />
        <StatCard label="Fees overdue" value={rupees(overdue)} href="/fees?status=Overdue" tone={overdue > 0 ? "absent" : "default"} hint={vsLastWeek(overdue, overdueThen, rupees)} />
      </StatStrip>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={`Attendance by week, last ${trend.length}`}
          figure={trendNow === null ? "–" : <>{trendNow}<span className="text-base text-muted-foreground">%</span></>}
          action={programmes.length > 1 && (
            <nav aria-label="Trend by programme" className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs">
              {toggles.map((t) => (
                <Link key={t.code} href={t.href} aria-current={t.on ? "page" : undefined}
                  className={cn(t.on ? "font-medium text-foreground underline underline-offset-4" : "text-muted-foreground hover:text-foreground")}>{t.code}</Link>
              ))}
            </nav>
          )}>
          {hasTrend ? (
            <>
              <TrendLine className="flex-1" points={trend} reference={line} label={`${programme?.code ?? "Campus"} attendance by week`} />
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-rule text-sm sm:grid-cols-4">
                {[
                  ["This week", trendNow === null ? "–" : `${trendNow}%`, trendNow !== null && prev !== null ? `${trendNow >= prev ? "+" : ""}${Math.round((trendNow - prev) * 10) / 10} pts vs last week` : "No previous week"],
                  ["Best week", `${Math.max(...held)}%`, `${held.length} ${held.length === 1 ? "week" : "weeks"} with classes`],
                  ["Lowest week", `${Math.min(...held)}%`, `${Math.round((Math.min(...held) - line) * 10) / 10} pts from the line`],
                  ["Weeks below line", String(held.filter((v) => v < line).length), held.some((v) => v < line) ? "Check the subjects panel" : "All weeks above the line"],
                ].map(([k, v, hint]) => (
                  <div key={k} className="bg-card px-3 py-2.5">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-lg font-medium tabular-nums">{v}</dd>
                    <dd className="text-xs text-muted-foreground">{hint}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-foreground/60" aria-hidden />{programme?.cutoff ?? LINE}% shortage line</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-absent" aria-hidden />Week below the line</span>
                <span>Late counts as present</span>
              </p>
            </>
          ) : <Empty>No sessions in the last 8 weeks.</Empty>}
        </Panel>

        <Panel title="Students below the line" figure={short} action={<PanelLink href="/students?attendance=Shortage">All students</PanelLink>}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Share of each subject&apos;s students under the line. Red at {RED_SHARE}% or more.</p>
          {subjectGroups.length === 0 ? <Empty>No attendance sessions yet.</Empty> : (
            <HBars max={100} rows={subjectGroups.slice(0, 8).map((g) => ({
              key: g.key, label: g.label, sub: `${g.short} of ${g.students} students`, value: g.share, valueLabel: `${g.share}%`,
              alert: g.share >= RED_SHARE, title: `${g.label}: ${g.short} of ${g.students} students below the line`,
            }))} />
          )}
          {subjectGroups.length > 8 && <p className="mt-3 text-xs text-muted-foreground">Top 8 of {subjectGroups.length} subjects.</p>}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Fees due so far" figure={billedPaise ? `${Math.round((collectedPaise / billedPaise) * 100)}%` : "–"} action={<PanelLink href="/fees?status=Overdue">View all</PanelLink>}>
          {billedPaise === 0 ? <Empty>No fee instalment is due yet.</Empty> : (
            <>
              <StackedBar label="Fees due so far, collected" parts={[
                { name: "Collected", value: Math.min(collectedPaise, billedPaise), text: rupees(collectedPaise), className: "bg-data" },
                { name: "Unpaid", value: unpaidPaise, text: rupees(unpaidPaise), className: "bg-late" },
              ]} />
              <p className="mt-5 mb-3 text-xs text-muted-foreground">Overdue by days past due, {rupees(overdue)} in all</p>
              {agingTotal === 0 ? <Empty>No fees are overdue.</Empty> : (
                <HBars max={agingTotal} rows={agingRows.map((b, i) => ({
                  key: b.label, label: b.label, sub: `${b.count} ${b.count === 1 ? "instalment" : "instalments"}`, value: b.paise,
                  valueLabel: rupees(b.paise), alert: i === 2, title: `${b.label}: ${rupees(b.paise)} across ${b.count} instalments`,
                }))} />
              )}
            </>
          )}
        </Panel>

        <Panel title="Marks by status">
          {subjectsTotal === 0 ? <Empty>No subjects on this campus yet.</Empty> : (
            <>
              <StackedBar label="Subjects by marks status" parts={[
                { name: "Draft", value: marks.draft, className: "bg-late" },
                { name: "Submitted", value: marks.submitted, className: "bg-data" },
                { name: "Locked", value: marks.locked, className: "bg-ok" },
              ]} />
              <p className="mt-5 text-sm">
                {marks.draft > 0
                  ? <PanelLink href="/marks?status=draft">{marks.draft} {marks.draft === 1 ? "subject" : "subjects"} not submitted</PanelLink>
                  : <span className="text-muted-foreground">Every subject is submitted or locked.</span>}
              </p>
            </>
          )}
        </Panel>

        <Panel title="Not marked today" figure={unmarked} action={<PanelLink href="/attendance?filter=unmarked">View all</PanelLink>}>
          {unmarked === 0 ? <Empty>Every class held today is marked.</Empty> : (
            <ul className="divide-y divide-rule">
              {stats.unmarked.slice(0, 5).map((u) => (
                <li key={`${u.batchId}:${u.subjectId}:${u.period}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-11 shrink-0 text-muted-foreground tabular-nums">{u.startTime.slice(0, 5)}</span>
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium">{u.subject}</span> <span className="text-muted-foreground">· {u.batch} · Period {u.period}</span></span>
                  <StatusPill tone="late">Not marked</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
