import { notFound } from "next/navigation";
import { HBars } from "@/components/charts";
import { PageHeader, Panel, StatCard, StatStrip, StatusPill } from "@/components/page";
import { rupees } from "@/lib/utils";
import { campusDetail } from "../../queries";

export default async function TrustCampusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await campusDetail(Number(id));
  if (!data) notFound();
  const { campus, figures, programmes, subjects } = data;
  const p = figures.held ? Math.round((figures.attended / figures.held) * 1000) / 10 : null;

  return (
    <>
      <PageHeader
        title={campus.name}
        description="Figures for this campus. Read-only view."
        back={{ href: "/trust", label: "All campuses" }}
        actions={<StatusPill>Read-only view</StatusPill>}
      />
      <StatStrip cols={5}>
        <StatCard label="Students" value={figures.students} />
        <StatCard label="Attendance" value={p === null ? "—" : `${p}%`} />
        <StatCard label="Below the line" value={figures.shortage} />
        <StatCard label="Dues" value={rupees(figures.duesPaise)} />
        <StatCard label="Active flags" value={figures.flags} />
      </StatStrip>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Programmes">
          {programmes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No programmes on this campus.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {programmes.map((g) => (
                <li key={g.id} className="flex justify-between gap-3">
                  <span>{g.code}</span>
                  <span className="text-muted-foreground tabular-nums">Cutoff {g.cutoff}%</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Subjects with most students below the line">
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <HBars
              rows={subjects.slice(0, 8).map((s) => ({
                key: s.key, label: s.label, value: s.share, valueLabel: `${s.short} of ${s.students}`, title: `${s.label}: ${s.short} of ${s.students} below the line`,
              }))}
              max={100}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
