import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { DayBars } from "@/components/charts";
import { AttendanceMeter, PageHeader, Panel, PanelLink, StatCard, StatStrip, StatusPill } from "@/components/page";
import { sameDayByDay, sameDayRate, sessionStats } from "../attendance/queries";
import { isShortage, istDate, istDayOfWeek } from "@/domain/attendance";
import { dues, type Instalment } from "@/domain/fees";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import {
  attendanceEntry, attendanceSession, batch, feeInstalment, programme, riskFlag, staff, student, subject, syncConflict, timetableSlot,
} from "@/server/schema";
import { rupees } from "@/lib/utils";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export async function AdminHome({ viewer }: { viewer: Viewer }) {
  const today = istDate();
  const newSince = daysAgo(7);
  const onCampus = eq(programme.campusId, viewer.campusId);

  const [slots, markedToday, [conflicts], [moderation], [activeRisk], [newRisk], perDay, attendanceRows, instalments, stats] = await Promise.all([
    db.select({ batchId: timetableSlot.batchId, subjectId: timetableSlot.subjectId, period: timetableSlot.period })
      .from(timetableSlot)
      .innerJoin(batch, eq(timetableSlot.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(onCampus, eq(timetableSlot.dayOfWeek, istDayOfWeek()), isNotNull(timetableSlot.subjectId))),
    db.select({ batchId: attendanceSession.batchId, subjectId: attendanceSession.subjectId, period: attendanceSession.period })
      .from(attendanceSession).where(eq(attendanceSession.date, today)),
    db.select({ n: count() }).from(syncConflict)
      .innerJoin(staff, eq(syncConflict.facultyId, staff.id))
      .where(and(eq(syncConflict.status, "open"), eq(staff.campusId, viewer.campusId))),
    db.select({ n: count() }).from(subject)
      .innerJoin(batch, eq(subject.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(onCampus, eq(subject.marksStatus, "submitted"))),
    db.select({ n: count() }).from(riskFlag)
      .innerJoin(student, eq(riskFlag.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(onCampus, eq(riskFlag.active, true))),
    db.select({ n: count() }).from(riskFlag)
      .innerJoin(student, eq(riskFlag.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(onCampus, eq(riskFlag.active, true), gte(riskFlag.createdAt, newSince))),
    sameDayByDay(viewer),
    db.select({
      id: student.id, name: student.name, rollNo: student.rollNo, cutoff: programme.attendanceCutoff,
      held: sql<number>`coalesce(sum(${attendanceSession.periodCount}), 0)`.mapWith(Number),
      attended: sql<number>`coalesce(sum(case when ${attendanceEntry.status} <> 'absent' then ${attendanceSession.periodCount} else 0 end), 0)`.mapWith(Number),
    }).from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .leftJoin(attendanceEntry, eq(attendanceEntry.studentId, student.id))
      .leftJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
      .where(onCampus)
      .groupBy(student.id, student.name, student.rollNo, programme.attendanceCutoff),
    db.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise,
      paidPaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from fee_payment p where p.instalment_id=fee_instalment.id)`.mapWith(Number),
    }).from(feeInstalment)
      .innerJoin(student, eq(feeInstalment.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(onCampus),
    sessionStats(viewer),
  ]);

  const markedKeys = new Set(markedToday.map((m) => `${m.batchId}:${m.subjectId}:${m.period}`));
  const unmarked = slots.filter((s) => !markedKeys.has(`${s.batchId}:${s.subjectId}:${s.period}`)).length;

  const pctOf = (r: { held: number; attended: number }) => r.held ? Math.round((r.attended / r.held) * 1000) / 10 : null;
  const short = attendanceRows
    .map((r) => ({ ...r, pct: pctOf(r) }))
    .filter((r) => isShortage(r.pct, r.cutoff))
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  const cutoff = attendanceRows[0]?.cutoff ?? 75;

  const names = new Map(attendanceRows.map((r) => [r.id, r]));
  const byStudent = new Map<number, Instalment[]>();
  for (const i of instalments) byStudent.set(i.studentId, [...(byStudent.get(i.studentId) ?? []), i]);
  let feeDuePaise = 0;
  const overdue: { id: number; name: string; rollNo: string; overduePaise: number }[] = [];
  for (const [id, list] of byStudent) {
    const d = dues(list, today);
    feeDuePaise += d.totalPaise;
    if (d.overduePaise > 0) overdue.push({ id, name: names.get(id)?.name ?? "–", rollNo: names.get(id)?.rollNo ?? "", overduePaise: d.overduePaise });
  }
  overdue.sort((a, b) => b.overduePaise - a.overduePaise);
  const overduePaise = overdue.reduce((t, o) => t + o.overduePaise, 0);

  // Seven calendar days ending today; a day with no sessions keeps its label and draws no bar.
  const rateByDate = new Map(perDay.map((d) => [d.date, d]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = istDate(daysAgo(6 - i));
    const d = rateByDate.get(date);
    const pct = d?.total ? Math.round((d.sameDay / d.total) * 1000) / 10 : null;
    const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
    return { label: i === 6 ? "Today" : label, pct, title: d ? `${label}: ${d.sameDay} of ${d.total} sessions marked the same day` : `${label}: no sessions` };
  });
  const weekTotal = perDay.reduce((t, d) => t + d.total, 0);
  const weekSame = perDay.reduce((t, d) => t + d.sameDay, 0);
  const rate = sameDayRate(perDay);

  const dateLine = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
  const finding = [
    unmarked > 0 && `${unmarked} ${unmarked === 1 ? "class" : "classes"} not marked yet`,
    conflicts.n > 0 && `${conflicts.n} sync ${conflicts.n === 1 ? "conflict" : "conflicts"} to resolve`,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title="Today" description={<>{dateLine}{finding && <> · <span className="text-foreground">{finding}</span></>}</>} />

      <StatStrip cols={5}>
        <StatCard label="Classes not marked today" value={unmarked} href="/attendance?filter=unmarked" tone={unmarked > 0 ? "absent" : "default"} />
        <StatCard label="Sync conflicts" value={conflicts.n} href="/attendance?tab=conflicts" tone={conflicts.n > 0 ? "absent" : "default"} />
        <StatCard label="Marks awaiting moderation" value={moderation.n} href="/marks?status=submitted" />
        <StatCard label="New at-risk flags, 7 days" value={newRisk.n} href="/risk" hint={`${activeRisk.n} active in all`} />
        <StatCard label="Students with overdue fees" value={overdue.length} href="/fees?status=Overdue" />
      </StatStrip>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Marked the same day, last 7 days"
          figure={rate === null ? "–" : <>{rate}<span className="text-base text-muted-foreground">%</span></>}
          action={<PanelLink href="/attendance">Sessions</PanelLink>}>
          <DayBars days={days} target={95} label="Share of attendance sessions marked on the same day, per day" />
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{weekSame} of {weekTotal} sessions marked on the day they were held</span><span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-foreground/60" aria-hidden />95% target</span><span className="inline-flex items-center gap-1.5"><span className="size-2 bg-absent/80" aria-hidden />Below target</span></p>
        </Panel>

        <Panel title="Attendance shortage" figure={short.length} action={<PanelLink href="/students?attendance=Shortage">View all</PanelLink>}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Below {cutoff}% across all subjects</p>
          {short.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">No student is below {cutoff}%.</p>
          ) : (
            <ul className="-mx-2">
              {short.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <a href={`/students?student=${r.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.rollNo}</span></span>
                    <AttendanceMeter pct={r.pct} threshold={r.cutoff} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Not marked today" figure={stats.unmarked.length} action={<PanelLink href="/attendance?filter=unmarked">View all</PanelLink>}>
          {stats.unmarked.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">Every class held today is marked.</p>
          ) : (
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

        <Panel title="Overdue fees" figure={rupees(overduePaise)} action={<PanelLink href="/fees?status=Overdue">View all</PanelLink>}>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">{overdue.length} students{feeDuePaise !== overduePaise && <> · {rupees(feeDuePaise)} due in all</>}</p>
          {overdue.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">No fees are overdue.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {overdue.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <a href={`/fees?student=${o.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-foreground">
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{o.name}</span> <span className="text-muted-foreground">· {o.rollNo}</span></span>
                    <span className="font-semibold tabular-nums">{rupees(o.overduePaise)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

    </>
  );
}
