import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { istDate, istDayOfWeek } from "@/domain/attendance";
import { getViewer } from "@/server/access";
import { db } from "@/server/db";
import { attendanceSession, batch, student, subject, timetableSlot } from "@/server/schema";

/** Today's classes for this teacher with rosters. Only roll numbers and names leave the server. */
export async function GET() {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const date = istDate();
  const slots = await db.select({
    batchId: timetableSlot.batchId, batchCode: batch.code, subjectId: subject.id, subjectName: subject.name,
    period: timetableSlot.period, periodCount: timetableSlot.periodCount, startTime: timetableSlot.startTime, endTime: timetableSlot.endTime,
  }).from(timetableSlot)
    .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .innerJoin(batch, eq(timetableSlot.batchId, batch.id))
    .where(and(eq(timetableSlot.dayOfWeek, istDayOfWeek()), eq(subject.facultyId, v.staffId)))
    .orderBy(asc(timetableSlot.period));
  const batchIds = [...new Set(slots.map((s) => s.batchId))];
  const students = batchIds.length
    ? await db.select({ id: student.id, rollNo: student.rollNo, name: student.name, batchId: student.batchId }).from(student).where(inArray(student.batchId, batchIds)).orderBy(asc(student.rollNo))
    : [];
  const sessions = await db.select({ id: attendanceSession.id, batchId: attendanceSession.batchId, subjectId: attendanceSession.subjectId, period: attendanceSession.period })
    .from(attendanceSession).where(eq(attendanceSession.date, date));
  return NextResponse.json({
    date, serverNow: new Date().toISOString(),
    classes: slots.map((s) => ({
      ...s, date, key: `${s.batchId}:${s.subjectId}:${date}:${s.period}`,
      sessionId: sessions.find((x) => x.batchId === s.batchId && x.subjectId === s.subjectId && x.period === s.period)?.id ?? null,
      roster: students.filter((x) => x.batchId === s.batchId).map(({ id, rollNo, name }) => ({ id, rollNo, name })),
    })),
  });
}
