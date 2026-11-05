import { and, eq, inArray, sql } from "drizzle-orm";
import { attendancePercent, isShortage, type AttendanceStatus } from "@/domain/attendance";
import { dues } from "@/domain/fees";
import { istDate } from "@/domain/attendance";
import { assertStudentAccess, studentScope, type Viewer } from "@/server/access";
import { db } from "@/server/db";
import {
  attendanceEntry, attendanceSession, auditLog, batch, feeInstalment, feePayment, mark, markComponent, mentorTask, programme, riskFlag, staff, student, subject,
} from "@/server/schema";

export type StudentRow = {
  id: number; rollNo: string; name: string; batch: string; programme: string; year: number;
  attendance: number | null; cutoff: number; shortage: boolean; marks: number | null; duePaise: number | null; flagged: boolean;
};

/** One row per student this viewer may see. `duePaise` is null for faculty, who get no fee data. */
export async function listStudents(v: Viewer): Promise<StudentRow[]> {
  const rows = await db.select({
    id: student.id, rollNo: student.rollNo, name: student.name, batch: batch.code, programme: programme.name, year: batch.year, cutoff: programme.attendanceCutoff,
    held: sql<number>`(select coalesce(sum(a.period_count),0) from attendance_entry e join attendance_session a on a.id=e.session_id where e.student_id=student.id)`.mapWith(Number),
    attended: sql<number>`(select coalesce(sum(a.period_count),0) from attendance_entry e join attendance_session a on a.id=e.session_id where e.student_id=student.id and e.status<>'absent')`.mapWith(Number),
    marksAvg: sql<number | null>`(select avg(t.total) from (select sum(m.marks) total from mark m join mark_component c on c.id=m.component_id where m.student_id=student.id and m.marks is not null group by c.subject_id having count(*)=(select count(*) from mark_component c2 where c2.subject_id=c.subject_id)) t)`.mapWith((x) => (x === null ? null : Number(x))),
    flagged: sql<boolean>`exists(select 1 from risk_flag r where r.student_id=student.id and r.active)`,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(studentScope(v))
    .orderBy(student.rollNo);

  const isAdmin = v.role === "office_admin";
  const due = new Map<number, number>();
  if (isAdmin) {
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const inst = await db.select({
        studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise,
        paidPaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from fee_payment p where p.instalment_id=fee_instalment.id)`.mapWith(Number),
      }).from(feeInstalment).where(inArray(feeInstalment.studentId, ids));
      for (const id of ids) due.set(id, dues(inst.filter((i) => i.studentId === id), istDate()).totalPaise);
    }
  }
  return rows.map((r) => {
    const attendance = r.held ? Math.round((r.attended / r.held) * 1000) / 10 : null;
    return {
      id: r.id, rollNo: r.rollNo, name: r.name, batch: r.batch, programme: r.programme, year: r.year, cutoff: r.cutoff,
      attendance, shortage: isShortage(attendance, r.cutoff),
      marks: r.marksAvg === null ? null : Math.round(r.marksAvg * 10) / 10,
      duePaise: isAdmin ? due.get(r.id) ?? 0 : null, flagged: r.flagged,
    };
  });
}

/** Everything the side panel shows. Throws if the viewer may not see this student. */
export async function getStudentDetail(v: Viewer, id: number) {
  await assertStudentAccess(v, id);
  const [s] = await db.select({
    id: student.id, rollNo: student.rollNo, name: student.name, batch: batch.code, programme: programme.name, year: batch.year, semester: batch.semester, cutoff: programme.attendanceCutoff,
    mentor: staff.name, guardianName: student.guardianName, guardianPhone: student.guardianPhone,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id)).innerJoin(programme, eq(batch.programmeId, programme.id)).leftJoin(staff, eq(student.mentorId, staff.id))
    .where(eq(student.id, id));

  const att = await db.select({ subject: subject.name, status: attendanceEntry.status, periods: attendanceSession.periodCount })
    .from(attendanceEntry).innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id)).innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .where(eq(attendanceEntry.studentId, id));
  const bySubject = new Map<string, { status: AttendanceStatus; periods: number }[]>();
  for (const a of att) bySubject.set(a.subject, [...(bySubject.get(a.subject) ?? []), a]);
  const subjects = [...bySubject].map(([name, rows]) => ({ name, percent: attendancePercent(rows) })).sort((a, b) => a.name.localeCompare(b.name));

  const marks = await db.select({ subject: subject.name, status: subject.marksStatus, component: markComponent.name, max: markComponent.maxMarks, marks: mark.marks })
    .from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id)).innerJoin(subject, eq(markComponent.subjectId, subject.id))
    .where(eq(mark.studentId, id));

  const flags = await db.select({ reason: riskFlag.reasonText, source: riskFlag.reasonSource, at: riskFlag.createdAt, taskId: mentorTask.id, taskStatus: mentorTask.status })
    .from(riskFlag).leftJoin(mentorTask, eq(mentorTask.flagId, riskFlag.id)).where(and(eq(riskFlag.studentId, id), eq(riskFlag.active, true)));

  const isAdmin = v.role === "office_admin";
  const instalments = isAdmin ? await db.select({
    id: feeInstalment.id, label: feeInstalment.label, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise,
    paidPaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from ${feePayment} p where p.instalment_id=fee_instalment.id)`.mapWith(Number),
  }).from(feeInstalment).where(eq(feeInstalment.studentId, id)).orderBy(feeInstalment.dueDate) : null;

  const history = isAdmin ? await db.select().from(auditLog).where(and(eq(auditLog.entity, "student"), eq(auditLog.entityId, String(id)))).orderBy(sql`${auditLog.at} desc`).limit(20) : [];

  return { student: s, overall: attendancePercent(att), subjects, marks, flags, instalments, history };
}
export type StudentDetail = Awaited<ReturnType<typeof getStudentDetail>>;
