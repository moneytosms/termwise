import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import { attendanceEntry, attendanceSession, appeal, batch, leaveRequest, mark, markComponent, portalRequest, programme, student, subject } from "@/server/schema";

const leaveCols = {
  id: leaveRequest.id, studentName: student.name, rollNo: student.rollNo, kind: leaveRequest.kind,
  fromDate: leaveRequest.fromDate, toDate: leaveRequest.toDate, reason: leaveRequest.reason,
  parentNote: leaveRequest.parentNote, mentorNote: leaveRequest.mentorNote, status: leaveRequest.status,
  decidedAt: leaveRequest.decidedAt, createdAt: leaveRequest.createdAt,
};

const noteCols = {
  id: portalRequest.id, studentName: student.name, rollNo: student.rollNo, fromName: portalRequest.fromName,
  body: portalRequest.body, reply: portalRequest.reply, status: portalRequest.status, createdAt: portalRequest.createdAt,
  closedAt: portalRequest.closedAt,
};

/** Faculty: their mentees' leave awaiting them, parents' notes, and recent decisions. */
export async function facultyRequests(v: Viewer) {
  const mentees = eq(student.mentorId, v.staffId);
  const [toDecide, openNotes, doneNotes, decided] = await Promise.all([
    db.select(leaveCols).from(leaveRequest)
      .innerJoin(student, eq(leaveRequest.studentId, student.id))
      .where(and(mentees, eq(leaveRequest.status, "pending_mentor")))
      .orderBy(asc(leaveRequest.createdAt)),
    db.select(noteCols).from(portalRequest)
      .innerJoin(student, eq(portalRequest.studentId, student.id))
      .where(and(mentees, eq(portalRequest.kind, "mentor_note"), eq(portalRequest.status, "open")))
      .orderBy(asc(portalRequest.createdAt)),
    db.select(noteCols).from(portalRequest)
      .innerJoin(student, eq(portalRequest.studentId, student.id))
      .where(and(mentees, eq(portalRequest.kind, "mentor_note"), eq(portalRequest.status, "done")))
      .orderBy(desc(portalRequest.closedAt)).limit(20),
    db.select(leaveCols).from(leaveRequest)
      .innerJoin(student, eq(leaveRequest.studentId, student.id))
      .where(and(mentees, inArray(leaveRequest.status, ["approved", "rejected"])))
      .orderBy(desc(leaveRequest.decidedAt)).limit(20),
  ]);
  return { toDecide, openNotes, doneNotes, decided };
}

/** Office admin: open record corrections on the campus, then leave counts and the latest requests. */
export async function adminRequests(v: Viewer) {
  const campus = eq(programme.campusId, v.campusId);
  const [corrections, byStatus, latest] = await Promise.all([
    db.select(noteCols).from(portalRequest)
      .innerJoin(student, eq(portalRequest.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(campus, eq(portalRequest.kind, "profile_correction"), eq(portalRequest.status, "open")))
      .orderBy(asc(portalRequest.createdAt)),
    db.select({ status: leaveRequest.status, n: count() }).from(leaveRequest)
      .innerJoin(student, eq(leaveRequest.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(campus).groupBy(leaveRequest.status),
    db.select(leaveCols).from(leaveRequest)
      .innerJoin(student, eq(leaveRequest.studentId, student.id))
      .innerJoin(batch, eq(student.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(campus).orderBy(desc(leaveRequest.createdAt)).limit(20),
  ]);
  return { corrections, byStatus, latest };
}

/**
 * Appeals on subjects this viewer teaches (faculty) or anywhere on the campus (office admin).
 * `open` oldest first; `decided` the latest 20. Current values are the mark or attendance status now.
 */
export async function appealQueue(v: Viewer) {
  const teaching = v.role === "faculty" ? eq(subject.facultyId, v.staffId) : undefined;
  const rows = (where: SQL | undefined) => db.select({
    id: appeal.id, kind: appeal.kind, reason: appeal.reason, status: appeal.status, response: appeal.response,
    createdAt: appeal.createdAt, resolvedAt: appeal.resolvedAt, studentId: appeal.studentId, componentId: appeal.componentId,
    sessionId: appeal.sessionId, studentName: student.name, rollNo: student.rollNo, subjectId: subject.id, subjectCode: subject.code,
    subjectName: subject.name, componentName: markComponent.name, maxMarks: markComponent.maxMarks, currentMarks: mark.marks,
    sessionDate: attendanceSession.date, period: attendanceSession.period, currentAttendance: attendanceEntry.status,
  }).from(appeal)
    .leftJoin(markComponent, eq(appeal.componentId, markComponent.id))
    .leftJoin(attendanceSession, eq(appeal.sessionId, attendanceSession.id))
    .innerJoin(subject, sql`${subject.id} = coalesce(${markComponent.subjectId}, ${attendanceSession.subjectId})`)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(student, eq(appeal.studentId, student.id))
    .leftJoin(mark, and(eq(mark.componentId, appeal.componentId), eq(mark.studentId, appeal.studentId)))
    .leftJoin(attendanceEntry, and(eq(attendanceEntry.sessionId, appeal.sessionId), eq(attendanceEntry.studentId, appeal.studentId)))
    .where(and(eq(programme.campusId, v.campusId), teaching, where));
  const [open, decided] = await Promise.all([
    rows(eq(appeal.status, "open")).orderBy(asc(appeal.createdAt)),
    rows(inArray(appeal.status, ["accepted", "rejected"])).orderBy(desc(appeal.resolvedAt)).limit(20),
  ]);
  return { open, decided };
}
