import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatCard, StatStrip, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { canAppeal } from "@/domain/appeals";
import { requirePortal } from "@/server/portal";
import { myAppeals, portalStudent } from "@/server/portal-data";
import { AppealButton } from "../appeal-client";
import { AppealList, AppealPill } from "../appeal-list";
import { studentMarks, studentResults, type MarksStatus } from "./queries";

const STATUS: Record<MarksStatus, { label: string; tone: "default" | "ok" }> = {
  draft: { label: "Being entered", tone: "default" },
  submitted: { label: "Awaiting moderation", tone: "default" },
  locked: { label: "Final", tone: "ok" },
};

export default async function MarksPage() {
  const v = await requirePortal();
  const s = await portalStudent(v.studentId);
  if (!s) redirect("/my");
  const [subjects, appeals, results] = await Promise.all([studentMarks(v.studentId, s.batchId), myAppeals(v.studentId, "mark"), studentResults(v.studentId)]);
  const totals = new Map(results.map((r) => [r.subjectId, r.total]));
  // Locked subjects show the precomputed result; others show the live sum once every component has a mark.
  const finalOf = (x: (typeof subjects)[number]) => (x.status === "locked" ? totals.get(x.id) ?? null : x.final?.total ?? null);
  const locked = subjects.filter((x) => x.status === "locked").length;
  // The stats count the internal section only, matching the internal marks of 40 used elsewhere.
  const withInternal = subjects.filter((x) => x.internal !== null);
  const obtained = withInternal.reduce((n, x) => n + (x.internal ?? 0), 0);
  const max = withInternal.reduce((n, x) => n + x.scheme.internalMax, 0);
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
        <StatCard label="Internal marks" value={max > 0 ? `${obtained} / ${max}` : "–"} hint="across entered marks" />
        <StatCard label="Average" value={avg === null ? "–" : `${avg.toFixed(1)}%`} hint="of entered internal marks" />
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
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill>{x.kind === "lab" ? "Lab" : "Theory"}</StatusPill>
                  <StatusPill tone={STATUS[x.status].tone}>{STATUS[x.status].label}</StatusPill>
                </div>
              </div>
              <dl className="mt-3 grid gap-1.5 text-sm tabular-nums">
                {x.comps.map((c) => {
                  const latest = appeals.find((a) => a.componentId === c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{c.name}</dt>
                      <dd className="flex items-center gap-2">
                        {c.marks === null ? "–" : `${c.marks} / ${c.max}`}
                        {latest && <AppealPill status={latest.status} />}
                        {c.marks !== null && canAppeal({ role: v.role, existingOpen: latest?.status === "open", kind: "mark" }) && (
                          <AppealButton kind="mark" target={c.id} label={`${x.name}, ${c.name}`} />
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-4 grid gap-2 border-t border-rule pt-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Internal</span>
                  <span className="tabular-nums">{x.internal === null ? "–" : `${x.internal} / ${x.scheme.internalMax}`}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Final
                    {x.kind === "lab" && <span className="ml-1 text-xs">(theory scaled to {x.scheme.theoryScale}%)</span>}
                  </span>
                  <span className="font-medium tabular-nums">{finalOf(x) === null ? "–" : `${finalOf(x)} / 100`}</span>
                </div>
              </div>
              {finalOf(x) !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <div className="h-full rounded-full bg-data" style={{ width: `${finalOf(x)}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <AppealList items={appeals.map((a) => ({
          id: a.id, title: `${a.subject}, ${a.component}`, reason: a.reason, status: a.status, response: a.response,
        }))} />
      </div>
    </>
  );
}
