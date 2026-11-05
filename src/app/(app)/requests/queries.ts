import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import { batch, leaveRequest, portalRequest, programme, student } from "@/server/schema";

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
