import { eq, sql } from "drizzle-orm";
import { paidSql } from "@/app/(app)/fees/queries";
import { istDate } from "@/domain/attendance";
import { dues } from "@/domain/fees";
import { db } from "@/server/db";
import { parentToken } from "@/server/parent-link";
import { attendanceEntry, attendanceSession, batch, feeInstalment, programme, student } from "@/server/schema";

// Demo shortcut: no sign-in, opens a portal link for one fixed student. Off when DEMO_LINKS=0.
export async function GET(req: Request, { params }: { params: Promise<{ who: string }> }) {
  const { who } = await params;
  if (process.env.DEMO_LINKS === "0" || (who !== "parent" && who !== "student")) return new Response("Not found", { status: 404 });
  const id = await demoStudentId();
  if (id === null) return new Response("Not found", { status: 404 });
  return Response.redirect(new URL(`/p/${parentToken(id)}${who === "student" ? "?view=student" : ""}`, req.url), 302);
}

/** First student by roll no with a subject under the cutoff and fees due; else the first student. */
async function demoStudentId(): Promise<number | null> {
  const students = await db.select({ id: student.id, cutoff: programme.attendanceCutoff }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .orderBy(student.rollNo);
  if (students.length === 0) return null;

  const att = await db.select({
    studentId: attendanceEntry.studentId,
    held: sql<number>`sum(${attendanceSession.periodCount})`.mapWith(Number),
    attended: sql<number>`sum(case when ${attendanceEntry.status} <> 'absent' then ${attendanceSession.periodCount} else 0 end)`.mapWith(Number),
    cutoff: programme.attendanceCutoff,
  }).from(attendanceEntry)
    .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
    .innerJoin(student, eq(attendanceEntry.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .groupBy(attendanceEntry.studentId, programme.attendanceCutoff);
  const short = new Set(att.filter((a) => a.attended * 100 < a.cutoff * a.held).map((a) => a.studentId));

  const inst = await db.select({
    studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate, amountPaise: feeInstalment.amountPaise,
    scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidSql,
  }).from(feeInstalment);
  const today = istDate();
  const pick = students.find((s) => short.has(s.id) && dues(inst.filter((i) => i.studentId === s.id), today).totalPaise > 0);
  return (pick ?? students[0]).id;
}
