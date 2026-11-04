"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/access";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { batch, calendarDay, campus, department, programme, staff, subject, timetableSlot } from "@/server/schema";

type Result = { error?: string };

const optId = z.preprocess((x) => (x === "" || x == null ? null : x), z.coerce.number().int().positive().nullable());
const pick = (what: string) => z.coerce.number(what).int(what).positive(what);
const range = (what: string, min: number, max: number) => {
  const msg = `${what} must be a whole number from ${min} to ${max}.`;
  return z.coerce.number(msg).int(msg).min(min, msg).max(max, msg);
};
const text = (what: string, max: number) => z.string().trim().min(1, `${what} is required.`).max(max, `${what} is too long.`);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time.");
const isoDate = z.string().refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Pick a valid date.");

const programmeInput = z.object({
  id: optId,
  code: text("Code", 20),
  name: text("Name", 120),
  departmentId: optId,
  attendanceCutoff: range("Attendance cutoff", 1, 100),
});
const batchInput = z.object({
  id: optId,
  code: text("Code", 20),
  programmeId: pick("Pick a programme."),
  admissionYear: range("Admission year", 2000, 2100),
  year: range("Year", 1, 10),
  semester: range("Semester", 1, 12),
});
const subjectInput = z.object({
  id: optId,
  batchId: pick("Pick a batch."),
  facultyId: optId,
  code: text("Code", 20),
  name: text("Name", 120),
});
const dayInput = z.object({
  id: optId,
  date: isoDate,
  kind: z.enum(["holiday", "exam", "event"], "Pick a kind."),
  label: text("Label", 120),
});
const slotInput = z.object({
  batchId: pick("Pick a batch."),
  dayOfWeek: range("Day", 0, 6),
  period: range("Period", 1, 9),
  periodCount: range("Period count", 1, 9),
  startTime: hhmm,
  endTime: hhmm,
  subjectId: optId,
  label: z.string().trim().max(60, "Label is too long."),
})
  .refine((x) => x.endTime > x.startTime, { message: "End time must be after start time.", path: ["endTime"] })
  .refine((x) => x.subjectId !== null || x.label !== "", { message: "Pick a subject or type a label.", path: ["label"] })
  .refine((x) => x.period + x.periodCount - 1 <= 9, { message: "Period count runs past period 9.", path: ["periodCount"] });
const cellInput = z.object({ batchId: pick("Pick a batch."), dayOfWeek: range("Day", 0, 6), period: range("Period", 1, 9) });
const rulesInput = z.object({
  riskDropPoints: range("Drop points", 1, 100),
  riskMarksPercent: range("Marks percent", 1, 100),
  riskMinSessions: range("Minimum sessions", 1, 200),
});

function parse<S extends z.ZodType>(schema: S, fd: FormData) {
  const r = schema.safeParse(Object.fromEntries(fd));
  return r.success ? { ok: true as const, data: r.data } : { ok: false as const, error: r.error.issues[0].message };
}

/** A batch on this campus (via its programme), or undefined. */
async function campusBatch(tx: Tx, campusId: number, id: number) {
  const [r] = await tx.select({ b: batch }).from(batch).innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(batch.id, id), eq(programme.campusId, campusId)));
  return r?.b;
}

/** A subject on this campus (via its batch and programme), or undefined. */
async function campusSubject(tx: Tx, campusId: number, id: number) {
  const [r] = await tx.select({ s: subject }).from(subject).innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(subject.id, id), eq(programme.campusId, campusId)));
  return r?.s;
}

export async function saveProgramme(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(programmeInput, fd);
  if (!p.ok) return { error: p.error };
  const { id, departmentId, ...input } = p.data;
  const values = { ...input, departmentId };
  const error = await db.transaction(async (tx) => {
    if (departmentId) {
      const [d] = await tx.select({ id: department.id }).from(department)
        .where(and(eq(department.id, departmentId), eq(department.campusId, v.campusId)));
      if (!d) return "Pick a department from this campus.";
    }
    if (id) {
      const [old] = await tx.select().from(programme).where(and(eq(programme.id, id), eq(programme.campusId, v.campusId)));
      if (!old) return "Programme not found on this campus.";
      const [row] = await tx.update(programme).set(values).where(eq(programme.id, id)).returning();
      await audit(tx, v, { action: "setup.programme.update", entity: "programme", entityId: id, oldValue: old, newValue: row });
    } else {
      const [row] = await tx.insert(programme).values({ ...values, campusId: v.campusId }).returning();
      await audit(tx, v, { action: "setup.programme.create", entity: "programme", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveBatch(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(batchInput, fd);
  if (!p.ok) return { error: p.error };
  const { id, ...input } = p.data;
  const error = await db.transaction(async (tx) => {
    const [prog] = await tx.select({ id: programme.id }).from(programme)
      .where(and(eq(programme.id, input.programmeId), eq(programme.campusId, v.campusId)));
    if (!prog) return "Pick a programme from this campus.";
    const [dup] = await tx.select({ id: batch.id }).from(batch)
      .where(and(eq(batch.code, input.code), id ? ne(batch.id, id) : undefined));
    if (dup) return "A batch with this code already exists.";
    if (id) {
      const old = await campusBatch(tx, v.campusId, id);
      if (!old) return "Batch not found on this campus.";
      const [row] = await tx.update(batch).set(input).where(eq(batch.id, id)).returning();
      await audit(tx, v, { action: "setup.batch.update", entity: "batch", entityId: id, oldValue: old, newValue: row });
    } else {
      const [row] = await tx.insert(batch).values(input).returning();
      await audit(tx, v, { action: "setup.batch.create", entity: "batch", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveSubject(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(subjectInput, fd);
  if (!p.ok) return { error: p.error };
  const { id, facultyId, ...input } = p.data;
  const values = { ...input, facultyId };
  const error = await db.transaction(async (tx) => {
    if (!(await campusBatch(tx, v.campusId, values.batchId))) return "Pick a batch from this campus.";
    if (facultyId) {
      const [f] = await tx.select({ id: staff.id }).from(staff)
        .where(and(eq(staff.id, facultyId), eq(staff.campusId, v.campusId), eq(staff.role, "faculty")));
      if (!f) return "Pick a faculty member from this campus.";
    }
    if (id) {
      const old = await campusSubject(tx, v.campusId, id);
      if (!old) return "Subject not found on this campus.";
      const [row] = await tx.update(subject).set(values).where(eq(subject.id, id)).returning();
      await audit(tx, v, { action: "setup.subject.update", entity: "subject", entityId: id, oldValue: old, newValue: row });
    } else {
      const [row] = await tx.insert(subject).values(values).returning();
      await audit(tx, v, { action: "setup.subject.create", entity: "subject", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveCalendarDay(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(dayInput, fd);
  if (!p.ok) return { error: p.error };
  const { id, ...input } = p.data;
  const error = await db.transaction(async (tx) => {
    if (id) {
      const [old] = await tx.select().from(calendarDay).where(and(eq(calendarDay.id, id), eq(calendarDay.campusId, v.campusId)));
      if (!old) return "Day not found on this campus.";
      const [row] = await tx.update(calendarDay).set(input).where(eq(calendarDay.id, id)).returning();
      await audit(tx, v, { action: "setup.calendar_day.update", entity: "calendar_day", entityId: id, oldValue: old, newValue: row });
    } else {
      const [row] = await tx.insert(calendarDay).values({ ...input, campusId: v.campusId }).returning();
      await audit(tx, v, { action: "setup.calendar_day.create", entity: "calendar_day", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function deleteCalendarDay(id: number): Promise<Result> {
  const v = await requireAdmin();
  const cid = pick("Pick a day.").safeParse(id);
  if (!cid.success) return { error: cid.error.issues[0].message };
  const error = await db.transaction(async (tx) => {
    const [old] = await tx.select().from(calendarDay).where(and(eq(calendarDay.id, cid.data), eq(calendarDay.campusId, v.campusId)));
    if (!old) return "Day not found on this campus.";
    await tx.delete(calendarDay).where(eq(calendarDay.id, old.id));
    await audit(tx, v, { action: "setup.calendar_day.delete", entity: "calendar_day", entityId: old.id, oldValue: old });
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveSlot(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(slotInput, fd);
  if (!p.ok) return { error: p.error };
  const { batchId, dayOfWeek, period, subjectId, label, startTime, endTime, periodCount } = p.data;
  const values = { periodCount, startTime, endTime, subjectId, label: label || null };
  const error = await db.transaction(async (tx) => {
    if (!(await campusBatch(tx, v.campusId, batchId))) return "Pick a batch from this campus.";
    if (subjectId !== null) {
      const [s] = await tx.select({ id: subject.id }).from(subject).where(and(eq(subject.id, subjectId), eq(subject.batchId, batchId)));
      if (!s) return "That subject isn't in this batch.";
    }
    const dayRows = await tx.select().from(timetableSlot)
      .where(and(eq(timetableSlot.batchId, batchId), eq(timetableSlot.dayOfWeek, dayOfWeek)));
    const cell = dayRows.find((s) => s.period === period);
    const clash = dayRows.find((s) => s !== cell && s.startTime < endTime && startTime < s.endTime);
    if (clash) return `Overlaps the slot at period ${clash.period} on this day.`;
    if (cell) {
      const [row] = await tx.update(timetableSlot).set(values).where(eq(timetableSlot.id, cell.id)).returning();
      await audit(tx, v, { action: "setup.timetable_slot.update", entity: "timetable_slot", entityId: row.id, oldValue: cell, newValue: row });
    } else {
      const [row] = await tx.insert(timetableSlot).values({ batchId, dayOfWeek, period, ...values }).returning();
      await audit(tx, v, { action: "setup.timetable_slot.create", entity: "timetable_slot", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function deleteSlot(input: { batchId: number; dayOfWeek: number; period: number }): Promise<Result> {
  const v = await requireAdmin();
  const c = cellInput.safeParse(input);
  if (!c.success) return { error: c.error.issues[0].message };
  const { batchId, dayOfWeek, period } = c.data;
  const error = await db.transaction(async (tx) => {
    if (!(await campusBatch(tx, v.campusId, batchId))) return "Pick a batch from this campus.";
    const [old] = await tx.select().from(timetableSlot)
      .where(and(eq(timetableSlot.batchId, batchId), eq(timetableSlot.dayOfWeek, dayOfWeek), eq(timetableSlot.period, period)));
    if (!old) return "Nothing in this cell to remove.";
    await tx.delete(timetableSlot).where(eq(timetableSlot.id, old.id));
    await audit(tx, v, { action: "setup.timetable_slot.delete", entity: "timetable_slot", entityId: old.id, oldValue: old });
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveRules(fd: FormData): Promise<Result> {
  const v = await requireAdmin();
  const p = parse(rulesInput, fd);
  if (!p.ok) return { error: p.error };
  const keys = { riskDropPoints: campus.riskDropPoints, riskMarksPercent: campus.riskMarksPercent, riskMinSessions: campus.riskMinSessions };
  await db.transaction(async (tx) => {
    const [old] = await tx.select(keys).from(campus).where(eq(campus.id, v.campusId));
    await tx.update(campus).set(p.data).where(eq(campus.id, v.campusId));
    await audit(tx, v, { action: "setup.rules.update", entity: "campus", entityId: v.campusId, oldValue: old, newValue: p.data });
  });
  revalidatePath("/setup");
  return {};
}
