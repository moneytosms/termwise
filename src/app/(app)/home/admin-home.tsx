import { and, count, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import {
  BookOpenCheck, ClipboardCheck, GitMerge, Gauge, IndianRupee, MessageSquare, Settings2, ShieldAlert, Sparkles, UserRoundX, Users, Wallet,
} from "lucide-react";
import { ModuleCard, PageHeader, SectionHeading, StatCard } from "@/components/page";
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
  const weekAgo = istDate(daysAgo(6));
  const newSince = daysAgo(7);
  const onCampus = eq(programme.campusId, viewer.campusId);

  const [slots, markedToday, [conflicts], [moderation], [activeRisk], [newRisk], [students], [rate], attendanceRows, instalments] = await Promise.all([
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
    db.select({ n: count() }).from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(onCampus),
    db.select({
      total: count(),
      sameDay: sql<number>`count(*) filter (where (${attendanceSession.editedAt} at time zone 'Asia/Kolkata')::date = ${attendanceSession.date})`.mapWith(Number),
    }).from(attendanceSession)
      .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(onCampus, gte(attendanceSession.date, weekAgo), lte(attendanceSession.date, today))),
    db.select({
      id: student.id, cutoff: programme.attendanceCutoff,
      held: sql<number>`coalesce(sum(${attendanceSession.periodCount}), 0)`.mapWith(Number),
      attended: sql<number>`coalesce(sum(case when ${attendanceEntry.status} <> 'absent' then ${attendanceSession.periodCount} else 0 end), 0)`.mapWith(Number),
    }).from(student)
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .leftJoin(attendanceEntry, eq(attendanceEntry.studentId, student.id))
      .leftJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
      .where(onCampus)
      .groupBy(student.id, programme.attendanceCutoff),
    db.select({
      studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
      amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise,
      paidPaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from fee_payment p where p.instalment_id=fee_instalment.id)`.mapWith(Number),
    }).from(feeInstalment)
      .innerJoin(student, eq(feeInstalment.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(onCampus),
  ]);

  const markedKeys = new Set(markedToday.map((m) => `${m.batchId}:${m.subjectId}:${m.period}`));
  const unmarked = slots.filter((s) => !markedKeys.has(`${s.batchId}:${s.subjectId}:${s.period}`)).length;

  const shortage = attendanceRows.filter((r) => {
    const pct = r.held ? Math.round((r.attended / r.held) * 1000) / 10 : null;
    return isShortage(pct, r.cutoff);
  }).length;

  const byStudent = new Map<number, Instalment[]>();
  for (const i of instalments) byStudent.set(i.studentId, [...(byStudent.get(i.studentId) ?? []), i]);
  let feeDuePaise = 0, overdueStudents = 0;
  for (const list of byStudent.values()) {
    const d = dues(list, today);
    feeDuePaise += d.totalPaise;
    if (d.overduePaise > 0) overdueStudents++;
  }

  const sameDayRate = rate.total ? Math.round((rate.sameDay / rate.total) * 1000) / 10 : null;

  return (
    <>
      <PageHeader title={`Welcome ${viewer.name.split(" ")[0]}`} description="What needs you today." />

      <SectionHeading title="Needs action" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Classes not marked today" value={unmarked} icon={ClipboardCheck} href="/attendance?filter=unmarked" tone={unmarked > 0 ? "late" : "default"} />
        <StatCard label="Sync conflicts" value={conflicts.n} icon={GitMerge} href="/attendance?tab=conflicts" tone={conflicts.n > 0 ? "absent" : "default"} />
        <StatCard label="Marks awaiting moderation" value={moderation.n} icon={BookOpenCheck} href="/marks?status=submitted" />
        <StatCard label="New at-risk flags (7 days)" value={newRisk.n} icon={ShieldAlert} href="/risk" />
        <StatCard label="Overdue fees" value={overdueStudents} icon={IndianRupee} href="/fees?status=Overdue" tone={overdueStudents > 0 ? "absent" : "default"} />
      </div>

      <SectionHeading title="Today" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Marked same day, last 7 days (target 95%)" value={sameDayRate === null ? "–" : `${sameDayRate}%`} icon={Gauge} />
        <StatCard label="Students in attendance shortage" value={shortage} icon={UserRoundX} />
        <StatCard label="Fee due" value={rupees(feeDuePaise)} icon={Wallet} />
      </div>

      <SectionHeading title="Modules" count={8} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard href="/students" title="Students" description="Roll numbers, batches, attendance and fee status" icon={Users} count={students.n} />
        <ModuleCard href="/attendance" title="Attendance" description="Mark classes, resolve sync conflicts, check shortages" icon={ClipboardCheck} count={unmarked} />
        <ModuleCard href="/marks" title="Marks" description="Components, entry and moderation of subject marks" icon={BookOpenCheck} count={moderation.n} />
        <ModuleCard href="/fees" title="Fees" description="Instalments, payments and dues" icon={IndianRupee} count={overdueStudents} />
        <ModuleCard href="/risk" title="Risk" description="Students flagged by attendance or marks rules" icon={ShieldAlert} count={activeRisk.n} />
        <ModuleCard href="/messages" title="Messages" description="Shortage and fee reminders sent to guardians" icon={MessageSquare} />
        <ModuleCard href="/assistant" title="Assistant" description="Ask questions about students and records" icon={Sparkles} />
        <ModuleCard href="/setup" title="College setup" description="Campus, programmes, batches, timetable and rules" icon={Settings2} />
      </div>
    </>
  );
}
