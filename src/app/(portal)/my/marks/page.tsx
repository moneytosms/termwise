import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatCard, StatStrip, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { requirePortal } from "@/server/portal";
import { portalStudent } from "@/server/portal-data";
import { SUBJECT_MAX, studentMarks, type MarksStatus } from "./queries";

const STATUS: Record<MarksStatus, { label: string; tone: "default" | "ok" }> = {
  draft: { label: "Being entered", tone: "default" },
  submitted: { label: "Awaiting moderation", tone: "default" },
  locked: { label: "Final", tone: "ok" },
};

export default async function MarksPage() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  if (!s) redirect("/my");
  const subjects = await studentMarks(v.studentId, s.batchId);
  const locked = subjects.filter((x) => x.status === "locked").length;
  const obtained = subjects.reduce((n, x) => n + x.obtained, 0);
  const max = subjects.reduce((n, x) => n + x.max, 0);
  const avg = max > 0 ? (obtained / max) * 100 : null;

  return (
    <>
      <PageHeader
        title="Internal marks"
        description="Marks are final only after moderation locks them."
        actions={locked > 0
          ? <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/my/marks/sheet" />}>Mark sheet</Button>
          : <>
              <span className="self-center text-xs text-muted-foreground">Available once a subject is locked</span>
              <Button variant="outline" size="sm" disabled>Mark sheet</Button>
            </>}
      />

      <StatStrip cols={3}>
        <StatCard label="Subjects final" value={locked} hint={`of ${subjects.length} subjects`} />
        <StatCard label="Marks obtained" value={max > 0 ? `${obtained} / ${max}` : "–"} hint="across entered marks" />
        <StatCard label="Average" value={avg === null ? "–" : `${avg.toFixed(1)}%`} hint="of entered marks" />
      </StatStrip>

      {subjects.length === 0 ? <div className="mt-6"><EmptyState title="No subjects yet." /></div> : (
        <ul className="mt-6 space-y-3">
          {subjects.map((x) => (
            <li key={x.id} className="rounded-xl bg-card p-4 shadow-sheet md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{x.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{x.code}</p>
                </div>
                <StatusPill tone={STATUS[x.status].tone}>{STATUS[x.status].label}</StatusPill>
              </div>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm tabular-nums">
                {x.comps.map((c) => (
                  <Fragment key={c.name}>
                    <dt className="text-muted-foreground">{c.name}</dt>
                    <dd className="text-right">{c.marks === null ? "–" : `${c.marks} / ${c.max}`}</dd>
                  </Fragment>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-rule pt-3 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium tabular-nums">{x.max > 0 ? `${x.obtained} / ${SUBJECT_MAX}` : "–"}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <div className="h-full rounded-full bg-data" style={{ width: `${(x.obtained / SUBJECT_MAX) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
