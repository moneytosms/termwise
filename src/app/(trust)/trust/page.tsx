import Link from "next/link";
import { PageHeader, Panel, StatCard, StatStrip, StatusPill } from "@/components/page";
import { HBars } from "@/components/charts";
import { compare, type Metric } from "@/domain/trust";
import { rupees } from "@/lib/utils";
import { allCampusFigures } from "./queries";

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const METRIC_LABEL: Record<Metric, string> = { attendance: "attendance", shortage: "below the line", duesPaise: "dues", flags: "active flags" };

export default async function TrustOverview() {
  const campuses = await allCampusFigures();
  const { totals, best, worst } = compare(campuses);
  const attendanceRows = campuses.map((c) => {
    const p = c.held ? Math.round((c.attended / c.held) * 1000) / 10 : null;
    return { key: c.campusId, label: c.name, sub: `${c.students} students`, value: p ?? 0, valueLabel: pct(p), alert: p !== null && p < 75, title: `${c.name}: ${pct(p)} attendance` };
  });
  const shortMax = Math.max(1, ...campuses.map((c) => c.shortage));
  const shortRows = campuses.map((c) => ({
    key: c.campusId, label: c.name, value: c.shortage, valueLabel: String(c.shortage), title: `${c.name}: ${c.shortage} students below the line`,
  }));

  return (
    <>
      <PageHeader title="Trust overview" description="All campuses, read-only." />
      <StatStrip cols={5}>
        <StatCard label="Students" value={totals.students} />
        <StatCard label="Attendance" value={pct(totals.attendance)} />
        <StatCard label="Below the line" value={totals.shortage} />
        <StatCard label="Dues" value={rupees(totals.duesPaise)} />
        <StatCard label="Active flags" value={totals.flags} />
      </StatStrip>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Attendance by campus" figure={pct(totals.attendance)}>
          <HBars rows={attendanceRows} max={100} />
        </Panel>
        <Panel title="Below the line by campus" figure={totals.shortage}>
          <HBars rows={shortRows.map((r) => ({ ...r, value: (r.value / shortMax) * 100 }))} max={100} />
        </Panel>
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold tracking-tight">Campuses</h2>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campuses.map((c) => {
          const p = c.held ? Math.round((c.attended / c.held) * 1000) / 10 : null;
          const tags = (Object.keys(METRIC_LABEL) as Metric[]).flatMap((m) => [
            ...(best[m] === c.campusId ? [{ key: `${m}-best`, text: `Best ${METRIC_LABEL[m]}`, tone: "ok" as const }] : []),
            ...(worst[m] === c.campusId ? [{ key: `${m}-worst`, text: `Weakest ${METRIC_LABEL[m]}`, tone: "absent" as const }] : []),
          ]);
          return (
            <li key={c.campusId}>
              <Link href={`/trust/campus/${c.campusId}`} className="block rounded-xl bg-card p-4 shadow-sheet transition-colors hover:bg-muted/60 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{c.name}</h3>
                  <span className="text-sm text-muted-foreground">{c.students} students</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Attendance</dt><dd className="text-right tabular-nums">{pct(p)}</dd>
                  <dt className="text-muted-foreground">Below the line</dt><dd className="text-right tabular-nums">{c.shortage}</dd>
                  <dt className="text-muted-foreground">Dues</dt><dd className="text-right tabular-nums">{rupees(c.duesPaise)}</dd>
                  <dt className="text-muted-foreground">Active flags</dt><dd className="text-right tabular-nums">{c.flags}</dd>
                </dl>
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((t) => <StatusPill key={t.key} tone={t.tone}>{t.text}</StatusPill>)}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
