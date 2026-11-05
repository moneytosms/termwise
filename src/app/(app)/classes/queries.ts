import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import { shiftDays } from "@/domain/staff-leave";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import { attendanceEntry, attendanceSession, batch, programme, staffLeave, student, subject, timetableSlot } from "@/server/schema";

export type WeekSlot = { day: number; startTime: string; endTime: string; subject: string; batch: string };

/** ISO dates of the 7 days from `weekStart` (a Monday) that fall inside the viewer's approved leave. */
export async function approvedLeaveDays(v: Viewer, weekStart: string): Promise<Set<string>> {
  const weekEnd = shiftDays(weekStart, 6);
  const rows = await db.select({ fromDate: staffLeave.fromDate, toDate: staffLeave.toDate }).from(staffLeave)
    .where(and(eq(staffLeave.staffId, v.staffId), eq(staffLeave.status, "approved"), lte(staffLeave.fromDate, weekEnd), gte(staffLeave.toDate, weekStart)));
  const days = new Set<string>();
  for (const r of rows) {
    for (let i = 0; i < 7; i++) {
      const iso = shiftDays(weekStart, i);
      if (iso >= r.fromDate && iso <= r.toDate) days.add(iso);
    }
  }
  return days;
}

/** This teacher's timetable slots that carry a subject. Club and sports slots have none, so they drop out. */
export function getWeek(v: Viewer): Promise<WeekSlot[]> {
  return db.select({ day: timetableSlot.dayOfWeek, startTime: timetableSlot.startTime, endTime: timetableSlot.endTime, subject: subject.name, batch: batch.code })
    .from(timetableSlot)
    .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .innerJoin(batch, eq(timetableSlot.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(subject.facultyId, v.staffId), eq(programme.campusId, v.campusId)))
    .orderBy(asc(timetableSlot.dayOfWeek), asc(timetableSlot.period));
}

export type PastRow = { id: string; date: string; period: number; batch: string; subject: string; present: number; absent: number; late: number };

const count = (status: "present" | "absent" | "late") =>
  sql<number>`count(${attendanceEntry.studentId}) filter (where ${attendanceEntry.status} = ${status})`.mapWith(Number);

export function getPastSessions(v: Viewer): Promise<PastRow[]> {
  return db.select({
    id: attendanceSession.id, date: attendanceSession.date, period: attendanceSession.period,
    batch: batch.code, subject: subject.name,
    present: count("present"), absent: count("absent"), late: count("late"),
  }).from(attendanceSession)
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .leftJoin(attendanceEntry, eq(attendanceEntry.sessionId, attendanceSession.id))
    .where(and(eq(attendanceSession.facultyId, v.staffId), eq(programme.campusId, v.campusId)))
    .groupBy(attendanceSession.id, batch.id, subject.id)
    .orderBy(desc(attendanceSession.date), desc(attendanceSession.period));
}

/** Null unless the session is this teacher's. Lists only absent and late students. */
export async function getSessionDetail(v: Viewer, id: string) {
  const [s] = await db.select({
    batchId: attendanceSession.batchId, subjectId: attendanceSession.subjectId, date: attendanceSession.date, period: attendanceSession.period,
    batch: batch.code, subject: subject.name,
  }).from(attendanceSession)
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .where(and(eq(attendanceSession.id, id), eq(attendanceSession.facultyId, v.staffId), eq(programme.campusId, v.campusId)));
  if (!s) return null;

  const [counts] = await db.select({ present: count("present"), late: count("late"), absent: count("absent") })
    .from(attendanceEntry).where(eq(attendanceEntry.sessionId, id));

  const entries = await db.select({ status: attendanceEntry.status, rollNo: student.rollNo, name: student.name })
    .from(attendanceEntry)
    .innerJoin(student, eq(attendanceEntry.studentId, student.id))
    .where(and(eq(attendanceEntry.sessionId, id), ne(attendanceEntry.status, "present")))
    .orderBy(asc(student.rollNo));

  return {
    id,
    key: `${s.batchId}:${s.subjectId}:${s.date}:${s.period}`, // same key the mark page uses
    date: s.date, period: s.period, batch: s.batch, subject: s.subject,
    counts,
    isToday: s.date === istDate(),
    absent: entries.filter((e) => e.status === "absent").map(({ rollNo, name }) => ({ rollNo, name })),
    late: entries.filter((e) => e.status === "late").map(({ rollNo, name }) => ({ rollNo, name })),
  };
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>;
