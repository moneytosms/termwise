import { desc, eq, and, sql } from "drizzle-orm";
import type { AppealKind } from "@/domain/appeals";
import { db } from "./db";
import { appeal, attendanceSession, batch, campus, markComponent, programme, staff, student, subject } from "./schema";

/** Header facts for the portal's one student. */
export async function portalStudent(studentId: number) {
  const [s] = await db.select({
    id: student.id, name: student.name, rollNo: student.rollNo, birthDate: student.birthDate, batchId: student.batchId,
    guardianName: student.guardianName, guardianPhone: student.guardianPhone, parentConsentAt: student.parentConsentAt,
    batch: batch.code, year: batch.year, semester: batch.semester, programme: programme.name, cutoff: programme.attendanceCutoff,
    campus: campus.name, campusId: campus.id, mentor: staff.name, mentorId: staff.id,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .leftJoin(staff, eq(student.mentorId, staff.id))
    .where(eq(student.id, studentId));
  return s;
}

/** The student's appeals of one kind, newest first, with what each is about. */
export async function myAppeals(studentId: number, kind: AppealKind) {
  return db.select({
    id: appeal.id, componentId: appeal.componentId, sessionId: appeal.sessionId, reason: appeal.reason,
    status: appeal.status, response: appeal.response, createdAt: appeal.createdAt,
    subject: subject.name, component: markComponent.name, date: attendanceSession.date, period: attendanceSession.period,
  }).from(appeal)
    .leftJoin(markComponent, eq(appeal.componentId, markComponent.id))
    .leftJoin(attendanceSession, eq(appeal.sessionId, attendanceSession.id))
    .innerJoin(subject, sql`${subject.id} = coalesce(${markComponent.subjectId}, ${attendanceSession.subjectId})`)
    .where(and(eq(appeal.studentId, studentId), eq(appeal.kind, kind)))
    .orderBy(desc(appeal.createdAt));
}
