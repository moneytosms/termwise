import Link from "next/link";
import { HBars, StackedBar, TrendLine } from "@/components/charts";
import { PageHeader, Panel, PanelLink, StatCard, StatStrip, StatusPill } from "@/components/page";
import { sessionStats } from "../attendance/queries";
import { istDate } from "@/domain/attendance";
import { dues } from "@/domain/fees";
import type { Viewer } from "@/server/access";
import { cn, rupees } from "@/lib/utils";
import {
  activeFlags, addDays, aging, campusProgrammes, countShort, dailyCollections, dailyFlags, dailyTotals, feeRows, feesToDate, flagsCreated, marksByStatus,
  openConflicts, shortageByGroup, studentAttendance, subjectAttendance, weeklySum, weeklyTrend,
} from "./queries";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const LINE = 75;
/** A subject turns red once this share of its students is below the line. */
const RED_SHARE = 25;

/** "+3 vs last week", "−2 vs last week" or "same as last week". */
const vsLastWeek = (now: number, then: number, fmt: (n: number) => string = String) =>
  now === then ? "same as last week" : `${now > then ? "+" : "−"}${fmt(Math.abs(now - then))} vs last week`;

export const CHARTS = { attendance: "Attendance", fees: "Fees collected", flags: "New flags" } as const;
export type ChartKey = keyof typeof CHARTS;
// One colour per line when comparing; red stays for "below the line".
const TONES = [["stroke-data", "bg-data"], ["stroke-ok", "bg-ok"], ["stroke-late", "bg-late"], ["stroke-foreground/50", "bg-foreground/50"]] as const;
const compactRupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(paise / 100);

const weekLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">{children}</p>;
}

/** `programme` is a programme id, "compare" for one line per programme, or absent for the whole campus. */
export async function AdminHome({ viewer, programme: programmeParam, chart }: { viewer: Viewer; programme?: string; chart: ChartKey }) {
  const today = istDate();
  const lastWeek = addDays(today, -7);
  const weekAgo = daysAgo(7);
  const twoWeeksAgo = daysAgo(14);

  const [nowRows, thenRows, subjects, days, collections, flagDays, fees, active, flagsNew, flagsPrior, conflicts, conflictsThen, marks, stats, programmes] = await Promise.all([
    studentAttendance(viewer, today),
    studentAttendance(viewer, lastWeek),
    subjectAttendance(viewer),
    dailyTotals(viewer, addDays(today, -55)),
    dailyCollections(viewer, addDays(today, -55)),
    dailyFlags(viewer, addDays(today, -55)),
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

  const compare = programmeParam === "compare" && programmes.length > 1;
  const programme = programmes.find((p) => String(p.id) === programmeParam) ?? null;
  const line = programme?.cutoff ?? LINE;
  const weekly = (pid: number | null) => chart === "attendance" ? weeklyTrend(days, today, pid).map((w) => w.pct)
    : weeklySum(chart === "fees" ? collections : flagDays, today, pid);
  const picked = compare ? [{ name: "All", id: null }, ...programmes.map((p) => ({ name: p.code, id: p.id }))] : [{ name: programme?.code ?? "All", id: programme?.id ?? null }];
  // Drop weeks before the term's first session so the lines use the full width.
  const campus = weeklyTrend(days, today, null);
  const first = campus.findIndex((w) => w.pct !== null);
  const skip = first > 0 ? Math.min(first, campus.length - 2) : 0;
  const labels = campus.slice(skip).map((w) => weekLabel(w.weekStart));
  const series = picked.map((p, i) => ({ name: p.name, values: weekly(p.id).slice(skip), stroke: TONES[i % TONES.length][0], dot: TONES[i % TONES.length][1] }));
  const main = series[0].values;
  const nowV = main[main.length - 1];
  const prev = main.length > 1 ? main[main.length - 2] : null;
  const held = main.flatMap((v) => (v === null ? [] : [v]));
  const hasTrend = first >= 0;
  const fmt = chart === "attendance" ? (v: number) => `${v}%` : chart === "fees" ? compactRupees : String;
  const href = (q: { chart?: ChartKey; programme?: string }) => {
    const u = new URLSearchParams();
    const c = q.chart ?? chart;
    const pr = "programme" in q ? q.programme : programmeParam;
    if (c !== "attendance") u.set("chart", c);
    if (pr) u.set("programme", pr);
    return u.size ? `/home?${u}` : "/home";
  };
  const toggles = [{ code: "All", value: undefined, on: !programme && !compare }, ...programmes.map((p) => ({ code: p.code, value: String(p.id), on: programme?.id === p.id })),
    ...(programmes.length > 1 ? [{ code: "Compare", value: "compare", on: compare }] : [])];
  const stats4: [string, string, string][] = chart === "attendance" ? [
    ["This week", nowV === null ? "–" : `${nowV}%`, nowV !== null && prev !== null ? `${nowV >= prev ? "+" : ""}${Math.round((nowV - prev) * 10) / 10} pts vs last week` : "No previous week"],
    ["Best week", held.length ? `${Math.max(...held)}%` : "–", `${held.length} ${held.length === 1 ? "week" : "weeks"} with classes`],
    ["Lowest week", held.length ? `${Math.min(...held)}%` : "–", held.length ? `${Math.round((Math.min(...held) - line) * 10) / 10} pts from the line` : ""],
    ["Weeks below line", String(held.filter((v) => v < line).length), held.some((v) => v < line) ? "Check the subjects panel" : "All weeks above the line"],
  ] : [
    ["This week", nowV === null ? "–" : chart === "fees" ? rupees(nowV) : String(nowV), prev === null ? "No previous week" : `${chart === "fees" ? rupees(prev) : prev} last week`],
    ["Best week", held.length ? (chart === "fees" ? rupees(Math.max(...held)) : String(Math.max(...held))) : "–", `of the last ${held.length} weeks`],
    [`${held.length}-week total`, chart === "fees" ? rupees(held.reduce((a, b) => a + b, 0)) : String(held.reduce((a, b) => a + b, 0)), series[0].name === "All" ? "Whole campus" : series[0].name],
    ["Weekly average", held.length ? (chart === "fees" ? rupees(Math.round(held.reduce((a, b) => a + b, 0) / held.length)) : String(Math.round((held.reduce((a, b) => a + b, 0) / held.length) * 10) / 10)) : "–", "Per week"],
  ];

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
        <Panel className="lg:col-span-2" title={`${CHARTS[chart]} by week, last ${labels.length}`}
          figure={nowV === null ? "–" : chart === "attendance" ? <>{nowV}<span className="text-base text-muted-foreground">%</span></> : chart === "fees" ? rupees(nowV) : nowV}
          action={
            <div className="flex flex-col items-end gap-1.5">
              <nav aria-label="Chart" className="flex rounded-md bg-muted p-0.5 text-xs">
                {(Object.keys(CHARTS) as ChartKey[]).map((c) => (
                  <Link key={c} href={href({ chart: c })} aria-current={c === chart ? "page" : undefined}
                    className={cn("rounded px-2 py-1", c === chart ? "bg-card font-medium text-foreground shadow-sheet" : "text-muted-foreground hover:text-foreground")}>{CHARTS[c]}</Link>
                ))}
              </nav>
              {programmes.length > 1 && (
                <nav aria-label="Programme" className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs">
                  {toggles.map((t) => (
                    <Link key={t.code} href={href({ programme: t.value })} aria-current={t.on ? "page" : undefined}
                      className={cn(t.on ? "font-medium text-foreground underline underline-offset-4" : "text-muted-foreground hover:text-foreground")}>{t.code}</Link>
                  ))}
                </nav>
              )}
            </div>
          }>
          {hasTrend ? (
            <>
              <TrendLine labels={labels} series={series} reference={chart === "attendance" ? line : undefined} format={fmt}
                label={`${CHARTS[chart]} by week, ${series.map((x) => x.name).join(", ")}`} />
              {compare && (
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
                  {series.map((x) => <span key={x.name} className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", x.dot)} />{x.name}</span>)}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-rule text-sm sm:grid-cols-4">
                {stats4.map(([k, v, hint]) => (
                  <div key={k} className="bg-card px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-base font-medium tabular-nums">{v}</dd>
                    <dd className="text-xs text-muted-foreground">{hint}</dd>
                  </div>
                ))}
              </dl>
              {chart === "attendance" && (
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-foreground/60" aria-hidden />{line}% shortage line</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-absent" aria-hidden />Week below the line</span>
                  <span>Late counts as present</span>
                </p>
              )}
            </>
          ) : <Empty>No sessions in the last 8 weeks.</Empty>}
        </Panel>

        <Panel title="Students below the line" figure={short} action={<PanelLink href="/students?attendance=Shortage">All students</PanelLink>}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Share of each subject&apos;s students under the line. Red at {RED_SHARE}% or more.</p>
          {subjectGroups.length === 0 ? <Empty>No attendance sessions yet.</Empty> : (
            <HBars max={100} rows={subjectGroups.slice(0, 6).map((g) => ({
              key: g.key, label: g.label, sub: `${g.short} of ${g.students} students`, value: g.share, valueLabel: `${g.share}%`,
              alert: g.share >= RED_SHARE, title: `${g.label}: ${g.short} of ${g.students} students below the line`,
            }))} />
          )}
          {subjectGroups.length > 6 && <p className="mt-3 text-xs text-muted-foreground">Top 6 of {subjectGroups.length} subjects.</p>}
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
