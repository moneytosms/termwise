import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { attendanceEntry, attendanceSession, calendarDay, staff, subject, timetableSlot } from "@/server/schema";

export type Slot = {
  id: number; day: number; period: number; periodCount: number; startTime: string; endTime: string;
  subjectId: number | null; code: string | null; name: string | null; teacher: string | null; label: string | null;
};

/** The batch's whole timetable. Club and sports slots have no subject, so code, name and teacher are null. */
export function getSlots(batchId: number): Promise<Slot[]> {
  return db.select({
    id: timetableSlot.id, day: timetableSlot.dayOfWeek, period: timetableSlot.period, periodCount: timetableSlot.periodCount,
    startTime: timetableSlot.startTime, endTime: timetableSlot.endTime, subjectId: timetableSlot.subjectId,
    code: subject.code, name: subject.name, teacher: staff.name, label: timetableSlot.label,
  }).from(timetableSlot)
    .leftJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .leftJoin(staff, eq(subject.facultyId, staff.id))
    .where(eq(timetableSlot.batchId, batchId))
    .orderBy(asc(timetableSlot.dayOfWeek), asc(timetableSlot.startTime));
}

/** This student's mark per "subjectId:period" for today's sessions. Null status: session held, student not marked. */
export async function getTodayMarks(batchId: number, studentId: number, date: string) {
  const rows = await db.select({ subjectId: attendanceSession.subjectId, period: attendanceSession.period, status: attendanceEntry.status })
    .from(attendanceSession)
    .leftJoin(attendanceEntry, and(eq(attendanceEntry.sessionId, attendanceSession.id), eq(attendanceEntry.studentId, studentId)))
    .where(and(eq(attendanceSession.batchId, batchId), eq(attendanceSession.date, date)));
  return new Map(rows.map((r) => [`${r.subjectId}:${r.period}`, r.status]));
}

/** The whole campus calendar, soonest first. */
export function getCalendar(campusId: number) {
  return db.select({ date: calendarDay.date, kind: calendarDay.kind, label: calendarDay.label }).from(calendarDay)
    .where(eq(calendarDay.campusId, campusId))
    .orderBy(asc(calendarDay.date));
}
