import { and, count, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { isShortage } from "@/domain/attendance";
import { instalmentDue, type Instalment } from "@/domain/fees";
import type { Viewer } from "@/server/access";
import { db } from "@/server/db";
import {
  attendanceEntry, attendanceSession, batch, feeInstalment, feePayment, programme, riskFlag, staff, student, subject, syncConflict,
} from "@/server/schema";

const DAY = 86_400_000;
export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const heldSum = sql<number>`coalesce(sum(${attendanceSession.periodCount}), 0)`.mapWith(Number);
const attendedSum = sql<number>`coalesce(sum(case when ${attendanceEntry.status} <> 'absent' then ${attendanceSession.periodCount} else 0 end), 0)`.mapWith(Number);

/** Attendance % to one decimal; null when nothing was held. */
export const percentOf = (held: number, attended: number) => (held ? Math.round((attended / held) * 1000) / 10 : null);

/** Students whose attendance is below their programme's line. */
export function countShort(rows: { held: number; attended: number; cutoff: number }[]) {
  return rows.filter((r) => isShortage(percentOf(r.held, r.attended), r.cutoff)).length;
}

export type DayTotals = { date: string; programmeId: number; held: number; attended: number };

/** Campus (or one programme's) attendance per week, oldest first, the last week ending today. A week with nothing held is null. */
export function weeklyTrend(days: DayTotals[], today: string, programmeId: number | null, weeks = 8) {
  const buckets = Array.from({ length: weeks }, () => ({ held: 0, attended: 0 }));
  for (const d of days) {
    if (programmeId !== null && d.programmeId !== programmeId) continue;
    const ago = daysBetween(d.date, today);
    const i = weeks - 1 - Math.floor(ago / 7);
    if (ago < 0 || i < 0) continue;
    buckets[i].held += d.held;
    buckets[i].attended += d.attended;
  }
  return buckets.map((b, i) => ({ weekStart: addDays(today, -7 * (weeks - 1 - i) - 6), pct: percentOf(b.held, b.attended) }));
}

export type DayValue = { date: string; programmeId: number; value: number };

/** Campus (or one programme's) sum per week, oldest first, the last week ending today. A quiet week is 0. */
export function weeklySum(days: DayValue[], today: string, programmeId: number | null, weeks = 8) {
  const out = Array<number>(weeks).fill(0);
  for (const d of days) {
    if (programmeId !== null && d.programmeId !== programmeId) continue;
    const ago = daysBetween(d.date, today);
    const i = weeks - 1 - Math.floor(ago / 7);
    if (ago >= 0 && i >= 0) out[i] += d.value;
  }
  return out;
}

export type SubjectRow = { subjectId: number; subject: string; batch: string; cutoff: number; held: number; attended: number };

/** Per subject: how many of its students (with sessions) are below the line, worst share first. Rows are one per student. */
export function shortageByGroup(rows: SubjectRow[]) {
  const groups = new Map<number, { key: number; label: string; students: number; short: number }>();
  for (const r of rows) {
    if (!r.held) continue;
    const g = groups.get(r.subjectId) ?? { key: r.subjectId, label: `${r.subject} · ${r.batch}`, students: 0, short: 0 };
    g.students++;
    if (isShortage(percentOf(r.held, r.attended), r.cutoff)) g.short++;
    groups.set(r.subjectId, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, share: Math.round((g.short / g.students) * 1000) / 10 }))
    .sort((a, b) => b.share - a.share || b.students - a.students);
}

export const AGING = ["1–30 days", "31–60 days", "60+ days"] as const;

/** Unpaid money on instalments past due, bucketed by days past due. Due today is not overdue. */
export function aging(instalments: Instalment[], today: string) {
  const out = AGING.map((label) => ({ label, paise: 0, count: 0 }));
  for (const i of instalments) {
    const due = instalmentDue(i);
    const late = daysBetween(i.dueDate, today);
    if (due === 0 || late < 1) continue;
    const b = out[late <= 30 ? 0 : late <= 60 ? 1 : 2];
    b.paise += due;
    b.count++;
  }
  return out;
}

/** Fees billed so far (instalments due up to today, after scholarships) and what has been paid against them. */
export function feesToDate(instalments: Instalment[], today: string) {
  let billedPaise = 0, collectedPaise = 0;
  for (const i of instalments) {
    if (i.dueDate > today) continue;
    billedPaise += Math.max(0, i.amountPaise - i.scholarshipPaise);
    collectedPaise += i.paidPaise;
  }
  return { billedPaise, collectedPaise };
}

/** Sessions of a batch's current subjects only: its own, and those not stamped with an earlier semester. */
const currentSession = sql`${attendanceSession.subjectId} in (select s.id from subject s where s.batch_id = batch.id and (s.semester is null or s.semester = batch.semester))`;

/** Per student on campus: sessions held and attended on or before a date. Alumni are left out. */
export function studentAttendance(v: Viewer, asOf: string) {
  return db.select({
    id: student.id, cutoff: programme.attendanceCutoff, held: heldSum, attended: attendedSum,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .leftJoin(attendanceEntry, eq(attendanceEntry.studentId, student.id))
    .leftJoin(attendanceSession, and(eq(attendanceEntry.sessionId, attendanceSession.id), lte(attendanceSession.date, asOf), currentSession))
    .where(and(eq(programme.campusId, v.campusId), isNull(student.graduatedOn)))
    .groupBy(student.id, programme.attendanceCutoff);
}

/** Per student and subject on campus, all sessions to date. Alumni are left out. */
export function subjectAttendance(v: Viewer) {
  return db.select({
    subjectId: attendanceSession.subjectId, subject: subject.name, batch: batch.code, cutoff: programme.attendanceCutoff,
    held: heldSum, attended: attendedSum,
  }).from(attendanceEntry)
    .innerJoin(student, eq(attendanceEntry.studentId, student.id))
    .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), isNull(student.graduatedOn), currentSession))
    .groupBy(attendanceSession.subjectId, subject.name, batch.code, programme.attendanceCutoff, attendanceEntry.studentId);
}

/** Per programme and day on campus since a date, for the weekly trend. Alumni are left out. */
export function dailyTotals(v: Viewer, since: string) {
  return db.select({
    date: attendanceSession.date, programmeId: programme.id, held: heldSum, attended: attendedSum,
  }).from(attendanceEntry)
    .innerJoin(student, eq(attendanceEntry.studentId, student.id))
    .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), gte(attendanceSession.date, since), isNull(student.graduatedOn), currentSession))
    .groupBy(attendanceSession.date, programme.id);
}

const istDay = (col: typeof feePayment.paidAt | typeof riskFlag.createdAt) => sql<string>`to_char(${col} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`;
const istStart = (date: string) => new Date(`${date}T00:00:00+05:30`);

/** Fee money collected per IST day and programme, in paise. */
export function dailyCollections(v: Viewer, since: string): Promise<DayValue[]> {
  const day = istDay(feePayment.paidAt);
  return db.select({ date: day, programmeId: programme.id, value: sql<number>`sum(${feePayment.amountPaise})`.mapWith(Number) }).from(feePayment)
    .innerJoin(feeInstalment, eq(feePayment.instalmentId, feeInstalment.id))
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), gte(feePayment.paidAt, istStart(since))))
    .groupBy(day, programme.id);
}

/** At-risk flags raised per IST day and programme. */
export function dailyFlags(v: Viewer, since: string): Promise<DayValue[]> {
  const day = istDay(riskFlag.createdAt);
  return db.select({ date: day, programmeId: programme.id, value: count() }).from(riskFlag)
    .innerJoin(student, eq(riskFlag.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), gte(riskFlag.createdAt, istStart(since)), isNull(student.graduatedOn)))
    .groupBy(day, programme.id);
}

export function campusProgrammes(v: Viewer) {
  return db.select({ id: programme.id, code: programme.code, cutoff: programme.attendanceCutoff }).from(programme)
    .where(eq(programme.campusId, v.campusId)).orderBy(programme.code);
}

/** Instalments on campus with payments made in total and before a cutoff, for fees now and as of then. */
export function feeRows(v: Viewer, paidBefore: Date) {
  return db.select({
    id: feeInstalment.id, dueDate: feeInstalment.dueDate,
    amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise,
    paidPaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from fee_payment p where p.instalment_id=fee_instalment.id)`.mapWith(Number),
    paidBeforePaise: sql<number>`(select coalesce(sum(p.amount_paise),0) from fee_payment p where p.instalment_id=fee_instalment.id and p.paid_at < ${paidBefore})`.mapWith(Number),
  }).from(feeInstalment)
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(eq(programme.campusId, v.campusId));
}

/** Sync conflicts still open on campus. */
export async function openConflicts(v: Viewer, at?: Date) {
  const open = at
    ? or(isNull(syncConflict.resolvedAt), gt(syncConflict.resolvedAt, at))
    : eq(syncConflict.status, "open");
  const [r] = await db.select({ n: count() }).from(syncConflict)
    .innerJoin(staff, eq(syncConflict.facultyId, staff.id))
    .where(and(eq(staff.campusId, v.campusId), open, at ? lte(syncConflict.createdAt, at) : undefined));
  return r.n;
}

/** At-risk flags on campus created in [from, to), whether still active or not. */
export async function flagsCreated(v: Viewer, from: Date, to?: Date) {
  const [r] = await db.select({ n: count() }).from(riskFlag)
    .innerJoin(student, eq(riskFlag.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), gte(riskFlag.createdAt, from), to ? lt(riskFlag.createdAt, to) : undefined, isNull(student.graduatedOn)));
  return r.n;
}

/** Active at-risk flags on campus. */
export async function activeFlags(v: Viewer) {
  const [r] = await db.select({ n: count() }).from(riskFlag)
    .innerJoin(student, eq(riskFlag.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, v.campusId), eq(riskFlag.active, true), isNull(student.graduatedOn)));
  return r.n;
}

/** Subject count per marks status on campus. */
export async function marksByStatus(v: Viewer) {
  const rows = await db.select({ status: subject.marksStatus, n: count() }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(eq(programme.campusId, v.campusId))
    .groupBy(subject.marksStatus);
  const n = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return { draft: n("draft"), submitted: n("submitted"), locked: n("locked") };
}
