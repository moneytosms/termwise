import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { istDate, istDayOfWeek, type AttendanceStatus } from "@/domain/attendance";
import type { OutboxItem } from "@/domain/sync";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import {
  attendanceEntry, attendanceSession, batch, programme, staff, student, subject, syncConflict, timetableSlot,
} from "@/server/schema";

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86_400_000).toISOString().slice(0, 10);
const ist = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const tally = (status: AttendanceStatus) =>
  sql<number>`(select count(*) from attendance_entry e where e.session_id = ${attendanceSession.id} and e.status = ${status})`.mapWith(Number);

export type SessionRow = {
  id: string; date: string; period: number; batch: string; subject: string; faculty: string;
  present: number; absent: number; late: number; editedAt: string; bucket: "Today" | "Last 7 days" | "Older";
};

/** Campus sessions, newest first. */
export async function listSessions(v: Viewer): Promise<SessionRow[]> {
  const today = istDate();
  const rows = await db.select({
    id: attendanceSession.id, date: attendanceSession.date, period: attendanceSession.period, editedAt: attendanceSession.editedAt,
    batch: batch.code, subject: subject.name, faculty: staff.name,
    present: tally("present"), absent: tally("absent"), late: tally("late"),
  }).from(attendanceSession)
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .innerJoin(staff, eq(attendanceSession.facultyId, staff.id))
    .where(eq(programme.campusId, v.campusId))
    .orderBy(desc(attendanceSession.date), desc(attendanceSession.period));
  return rows.map((r): SessionRow => ({
    ...r, editedAt: ist(r.editedAt),
    bucket: r.date === today ? "Today" : r.date >= addDays(today, -6) ? "Last 7 days" : "Older",
  }));
}

/** Headline figures and today's timetabled classes with no session yet. */
/**
 * Sessions per day over the last 7 days and how many were marked on the day they were held.
 * "Marked" is editedAt, set on the phone when the teacher saves, so an offline sync that lands later still counts.
 * Home and Attendance both read this, so the figure is one fact.
 */
export async function sameDayByDay(v: Viewer) {
  const today = istDate();
  return db.select({
    date: attendanceSession.date,
    total: count(),
    sameDay: sql<number>`count(*) filter (where (${attendanceSession.editedAt} at time zone 'Asia/Kolkata')::date = ${attendanceSession.date})`.mapWith(Number),
  }).from(attendanceSession)
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), gte(attendanceSession.date, addDays(today, -6)), lte(attendanceSession.date, today)))
    .groupBy(attendanceSession.date);
}

/** Share of sessions marked the same day, one decimal; null when nothing was held. */
export function sameDayRate(days: { total: number; sameDay: number }[]) {
  const total = days.reduce((t, d) => t + d.total, 0);
  return total ? Math.round((days.reduce((t, d) => t + d.sameDay, 0) / total) * 1000) / 10 : null;
}

export async function sessionStats(v: Viewer) {
  const today = istDate();
  const [recent, perDay] = await Promise.all([
    db.select({ batchId: attendanceSession.batchId, subjectId: attendanceSession.subjectId, period: attendanceSession.period, date: attendanceSession.date })
      .from(attendanceSession)
      .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
      .innerJoin(programme, eq(batch.programmeId, programme.id))
      .where(and(eq(programme.campusId, v.campusId), eq(attendanceSession.date, today))),
    sameDayByDay(v),
  ]);

  const markedToday = new Set(recent.map((s) => `${s.batchId}:${s.subjectId}:${s.period}`));
  const slots = await db.select({
    batchId: timetableSlot.batchId, subjectId: subject.id, period: timetableSlot.period,
    startTime: timetableSlot.startTime, endTime: timetableSlot.endTime, batch: batch.code, subject: subject.name,
  }).from(timetableSlot)
    .innerJoin(batch, eq(timetableSlot.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .where(and(eq(programme.campusId, v.campusId), eq(timetableSlot.dayOfWeek, istDayOfWeek())))
    .orderBy(asc(timetableSlot.startTime));

  return {
    markedToday: markedToday.size,
    unmarked: slots.filter((s) => !markedToday.has(`${s.batchId}:${s.subjectId}:${s.period}`)),
    rate: sameDayRate(perDay),
  };
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>;

/** One session on this campus with its students. Null when it isn't on the viewer's campus. */
export async function getSessionDetail(v: Viewer, id: string) {
  const [s] = await db.select({
    id: attendanceSession.id, date: attendanceSession.date, period: attendanceSession.period, editedAt: attendanceSession.editedAt,
    batch: batch.code, subject: subject.name, faculty: staff.name,
  }).from(attendanceSession)
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .innerJoin(staff, eq(attendanceSession.facultyId, staff.id))
    .where(and(eq(attendanceSession.id, id), eq(programme.campusId, v.campusId)));
  if (!s) return null;
  const entries = await db.select({ studentId: attendanceEntry.studentId, rollNo: student.rollNo, name: student.name, status: attendanceEntry.status })
    .from(attendanceEntry)
    .innerJoin(student, eq(attendanceEntry.studentId, student.id))
    .where(eq(attendanceEntry.sessionId, id))
    .orderBy(asc(student.rollNo));
  return { ...s, editedAt: ist(s.editedAt), entries };
}

export type ConflictRow = {
  id: string; kind: "different_teacher" | "late_edit"; status: "open" | "kept" | "replaced";
  submitter: string; classLabel: string; date: string;
};

/** Campus conflicts, open first, then newest. */
export async function listConflicts(v: Viewer): Promise<ConflictRow[]> {
  const rows = await db.select({
    id: syncConflict.id, kind: syncConflict.kind, status: syncConflict.status, payload: syncConflict.payload,
    submitter: staff.name, batch: batch.code, subject: subject.name,
  }).from(syncConflict)
    .innerJoin(staff, eq(syncConflict.facultyId, staff.id))
    .innerJoin(batch, sql`${batch.id} = (${syncConflict.payload}->>'batchId')::int`)
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, sql`${subject.id} = (${syncConflict.payload}->>'subjectId')::int`)
    .where(eq(programme.campusId, v.campusId))
    .orderBy(sql`case when ${syncConflict.status} = 'open' then 0 else 1 end`, desc(syncConflict.createdAt));
  return rows.map((r) => ({
    id: r.id, kind: r.kind, status: r.status, submitter: r.submitter,
    classLabel: `${r.subject} · ${r.batch}`, date: (r.payload as OutboxItem).date,
  }));
}

export async function openConflictCount(v: Viewer) {
  const [r] = await db.select({ n: count() }).from(syncConflict)
    .innerJoin(batch, sql`${batch.id} = (${syncConflict.payload}->>'batchId')::int`)
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(syncConflict.status, "open"), eq(programme.campusId, v.campusId)));
  return r.n;
}

export type ConflictDetail = NonNullable<Awaited<ReturnType<typeof getConflictDetail>>>;

/** A conflict with the students whose status differs between the saved session and the incoming payload. */
export async function getConflictDetail(v: Viewer, id: string) {
  const [row] = await db.select({
    id: syncConflict.id, sessionId: syncConflict.sessionId, kind: syncConflict.kind, status: syncConflict.status,
    payload: syncConflict.payload, createdAt: syncConflict.createdAt,
    submitter: staff.name, batch: batch.code, subject: subject.name,
  }).from(syncConflict)
    .innerJoin(staff, eq(syncConflict.facultyId, staff.id))
    .innerJoin(batch, sql`${batch.id} = (${syncConflict.payload}->>'batchId')::int`)
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(subject, sql`${subject.id} = (${syncConflict.payload}->>'subjectId')::int`)
    .where(and(eq(syncConflict.id, id), eq(programme.campusId, v.campusId)));
  if (!row) return null;

  const p = row.payload as OutboxItem;
  const saved = row.sessionId
    ? await db.select({ studentId: attendanceEntry.studentId, status: attendanceEntry.status }).from(attendanceEntry).where(eq(attendanceEntry.sessionId, row.sessionId))
    : [];
  const before = new Map(saved.map((e) => [e.studentId, e.status]));
  const incoming = new Map(p.entries.map((e) => [e.studentId, e.status]));
  const people = await db.select({ id: student.id, rollNo: student.rollNo, name: student.name }).from(student)
    .where(inArray(student.id, [...new Set([...before.keys(), ...incoming.keys()])]))
    .orderBy(asc(student.rollNo));
  const diffs = people
    .map((s) => ({ rollNo: s.rollNo, name: s.name, saved: before.get(s.id) ?? null, incoming: incoming.get(s.id) ?? null }))
    .filter((d) => d.saved !== d.incoming);

  return {
    id: row.id, kind: row.kind, status: row.status, submitter: row.submitter,
    classLabel: `${row.subject} · ${row.batch}`, date: p.date, submittedAt: ist(row.createdAt),
    isNew: !row.sessionId, diffs,
  };
}
