"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCan } from "@/server/access";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { batch, calendarDay, campus, department, feeInstalment, feeStructure, mark, markComponent, programme, scholarshipScheme, staff, student, subject, timetableSlot } from "@/server/schema";
import { sectionMax, sectionsFor, SECTION_LABEL, type Section } from "@/domain/marks";
import { APPLICANT_CATEGORIES } from "@/domain/applicants";
import { istDate } from "@/domain/attendance";
import { semesterFee } from "@/domain/fee-structure";
import { nextTerm, promoteBlocker } from "@/domain/promotion";

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
  sanctionedIntake: range("Sanctioned intake", 1, 1000),
});
const staffProfileInput = z.object({
  id: pick("Pick a staff member."),
  designation: z.preprocess((x) => (x === "" || x == null ? null : x), z.enum(["professor", "associate_professor", "assistant_professor"], { error: "Pick a designation from the list." }).nullable()),
  qualification: z.string().trim().max(80, "Qualification is too long.").transform((q) => q || null),
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
  kind: z.enum(["theory", "lab"], "Pick a kind."),
  internalMax: range("Internal max", 1, 100),
  midMax: range("Mid-term max", 1, 100),
  endMax: range("End-term max", 1, 100),
  theoryScale: range("Theory scale", 1, 100),
  labExamMax: range("Lab exam max", 1, 100),
  vivaMax: range("Viva max", 1, 100),
  ceMax: range("CE max", 1, 100),
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
const feeInput = z.object({
  programmeId: pick("Pick a programme."),
  category: z.enum(["default", ...APPLICANT_CATEGORIES] as const, "Pick a category."),
  fee: z.string().trim().refine((s) => s === "" || /^\d+$/.test(s), "Fee must be a whole number of rupees."),
});
const schemeInput = z.object({
  id: optId,
  name: text("Name", 120),
  fundingSource: z.enum(["government", "institution", "non_government"], "Pick a funding source."),
  kind: z.enum(["fixed", "percent"], "Pick a kind."),
  value: z.coerce.number("Enter a value."),
  categories: z.array(z.enum(APPLICANT_CATEGORIES)),
  active: z.boolean(),
}).superRefine((s, ctx) => {
  if (s.kind === "percent" && (!Number.isInteger(s.value) || s.value < 1 || s.value > 100)) {
    ctx.addIssue({ code: "custom", message: "Percent must be a whole number from 1 to 100.", path: ["value"] });
  }
  if (s.kind === "fixed" && !(s.value > 0)) {
    ctx.addIssue({ code: "custom", message: "Enter an amount above zero.", path: ["value"] });
  }
});
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
  const v = await requireCan("setup");
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

export async function saveStaffProfile(fd: FormData): Promise<Result> {
  const v = await requireCan("setup");
  const p = parse(staffProfileInput, fd);
  if (!p.ok) return { error: p.error };
  const { id, designation, qualification } = p.data;
  const error = await db.transaction(async (tx) => {
    const [old] = await tx.select().from(staff).where(and(eq(staff.id, id), eq(staff.campusId, v.campusId), ne(staff.role, "trust")));
    if (!old) return "Staff member not found on this campus.";
    const [row] = await tx.update(staff).set({ designation, qualification }).where(eq(staff.id, id)).returning();
    await audit(tx, v, { action: "setup.staff.update", entity: "staff", entityId: id, oldValue: old, newValue: row });
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveBatch(fd: FormData): Promise<Result> {
  const v = await requireCan("setup");
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
  const v = await requireCan("setup");
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
    let rowId: number;
    if (id) {
      const old = await campusSubject(tx, v.campusId, id);
      if (!old) return "Subject not found on this campus.";
      // Caps may not cut marks already entered; the marks are never deleted or clamped.
      const entered = await tx.select({ section: markComponent.section, marks: mark.marks }).from(mark)
        .innerJoin(markComponent, eq(mark.componentId, markComponent.id)).where(eq(markComponent.subjectId, id));
      const cut = entered.find((m) => m.marks !== null && sectionsFor(values.kind).includes(m.section as Section) && m.section !== "internal"
        && m.marks > sectionMax(values, m.section as Section));
      if (cut) return `Marks already entered for ${SECTION_LABEL[cut.section as Section]} are above the new maximum.`;
      const [row] = await tx.update(subject).set(values).where(eq(subject.id, id)).returning();
      await audit(tx, v, { action: "setup.subject.update", entity: "subject", entityId: id, oldValue: old, newValue: row });
      rowId = id;
    } else {
      const [row] = await tx.insert(subject).values(values).returning();
      await audit(tx, v, { action: "setup.subject.create", entity: "subject", entityId: row.id, newValue: row });
      rowId = row.id;
    }
    // Fixed sections follow the scheme: caps are synced and missing ones created. Switching lab to theory keeps lab components, which are ignored.
    const comps = await tx.select({ id: markComponent.id, section: markComponent.section }).from(markComponent).where(eq(markComponent.subjectId, rowId));
    for (const sec of sectionsFor(values.kind)) {
      if (sec === "internal") continue;
      const c = comps.find((x) => x.section === sec);
      if (c) await tx.update(markComponent).set({ maxMarks: sectionMax(values, sec) }).where(eq(markComponent.id, c.id));
      else await tx.insert(markComponent).values({ subjectId: rowId, name: SECTION_LABEL[sec], maxMarks: sectionMax(values, sec), section: sec });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveCalendarDay(fd: FormData): Promise<Result> {
  const v = await requireCan("setup");
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
  const v = await requireCan("setup");
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
  const v = await requireCan("setup");
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
    const clash = dayRows.find((s) => s !== cell && ((s.startTime < endTime && startTime < s.endTime) || (s.period < period + periodCount && period < s.period + s.periodCount)));
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
  const v = await requireCan("setup");
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

/** Sets or, when the fee is blank, removes the semester fee for one category of a programme. "default" sets the programme's default fee instead. Never touches instalments. */
export async function saveFeeStructure(fd: FormData): Promise<Result> {
  const v = await requireCan("fees");
  const p = parse(feeInput, fd);
  if (!p.ok) return { error: p.error };
  const { programmeId, category, fee } = p.data;
  const paise = fee === "" ? null : Number(fee) * 100;
  if (category === "default") {
    if (paise === null) return { error: "Enter the programme's default fee." };
    const error = await db.transaction(async (tx) => {
      const [old] = await tx.select({ id: programme.id, semesterFeePaise: programme.semesterFeePaise }).from(programme)
        .where(and(eq(programme.id, programmeId), eq(programme.campusId, v.campusId)));
      if (!old) return "Pick a programme from this campus.";
      await tx.update(programme).set({ semesterFeePaise: paise }).where(eq(programme.id, programmeId));
      await audit(tx, v, {
        action: "setup.programme_fee.update", entity: "programme", entityId: programmeId,
        oldValue: old, newValue: { id: programmeId, semesterFeePaise: paise },
      });
      return null;
    });
    if (error) return { error };
    revalidatePath("/setup");
    return {};
  }
  const error = await db.transaction(async (tx) => {
    const [prog] = await tx.select({ id: programme.id }).from(programme)
      .where(and(eq(programme.id, programmeId), eq(programme.campusId, v.campusId)));
    if (!prog) return "Pick a programme from this campus.";
    const [old] = await tx.select().from(feeStructure)
      .where(and(eq(feeStructure.programmeId, programmeId), eq(feeStructure.category, category)));
    if (paise === null) {
      if (old) {
        await tx.delete(feeStructure).where(eq(feeStructure.id, old.id));
        await audit(tx, v, { action: "setup.fee_structure.delete", entity: "fee_structure", entityId: old.id, oldValue: old });
      }
      return null;
    }
    const [row] = await tx.insert(feeStructure).values({ programmeId, category, semesterFeePaise: paise })
      .onConflictDoUpdate({ target: [feeStructure.programmeId, feeStructure.category], set: { semesterFeePaise: paise } })
      .returning();
    await audit(tx, v, {
      action: old ? "setup.fee_structure.update" : "setup.fee_structure.create", entity: "fee_structure", entityId: row.id,
      oldValue: old ?? null, newValue: row,
    });
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveScheme(fd: FormData): Promise<Result> {
  const v = await requireCan("fees");
  const r = schemeInput.safeParse({
    ...Object.fromEntries(fd), categories: fd.getAll("categories"), active: fd.get("active") === "on",
  });
  if (!r.success) return { error: r.error.issues[0].message };
  const { id, value, ...input } = r.data;
  const values = { ...input, value: input.kind === "fixed" ? Math.round(value * 100) : value };
  const error = await db.transaction(async (tx) => {
    if (id) {
      const [old] = await tx.select().from(scholarshipScheme)
        .where(and(eq(scholarshipScheme.id, id), eq(scholarshipScheme.campusId, v.campusId)));
      if (!old) return "Scheme not found on this campus.";
      const [row] = await tx.update(scholarshipScheme).set(values).where(eq(scholarshipScheme.id, id)).returning();
      await audit(tx, v, { action: "setup.scholarship_scheme.update", entity: "scholarship_scheme", entityId: id, oldValue: old, newValue: row });
    } else {
      const [row] = await tx.insert(scholarshipScheme).values({ ...values, campusId: v.campusId }).returning();
      await audit(tx, v, { action: "setup.scholarship_scheme.create", entity: "scholarship_scheme", entityId: row.id, newValue: row });
    }
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}

export async function saveRules(fd: FormData): Promise<Result> {
  const v = await requireCan("setup");
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

/** The batch's current subjects: its own, and those not yet stamped with an earlier semester. */
async function currentSubjects(tx: Tx, b: { id: number; semester: number }) {
  return tx.select().from(subject)
    .where(and(eq(subject.batchId, b.id), or(isNull(subject.semester), eq(subject.semester, b.semester))));
}

const plusDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export type TermPlan =
  | { kind: "promote"; year: number; semester: number; students: number; subjects: number; fees: { category: string; paise: number }[] }
  | { kind: "graduate"; students: number };
export type TermPreview = { error?: string; blocker?: string; plan?: TermPlan };

/** What advancing the batch would do, or why it can't. */
export async function previewBatchTerm(batchId: number): Promise<TermPreview> {
  const v = await requireCan("setup");
  const id = pick("Pick a batch.").safeParse(batchId);
  if (!id.success) return { error: id.error.issues[0].message };
  return db.transaction(async (tx): Promise<TermPreview> => {
    const b = await campusBatch(tx, v.campusId, id.data);
    if (!b) return { error: "Batch not found on this campus." };
    const [prog] = await tx.select().from(programme).where(eq(programme.id, b.programmeId));
    const subs = await currentSubjects(tx, b);
    const blocker = promoteBlocker(subs);
    if (blocker) return { blocker };
    const next = nextTerm(b, prog.durationYears);
    const students = await tx.select({ id: student.id }).from(student).where(and(eq(student.batchId, b.id), isNull(student.graduatedOn)));
    if (next.kind === "graduate") return { plan: { kind: "graduate", students: students.length } };
    const fees = await tx.select().from(feeStructure).where(eq(feeStructure.programmeId, prog.id));
    return {
      plan: {
        kind: "promote", year: next.year, semester: next.semester, students: students.length, subjects: subs.length,
        fees: APPLICANT_CATEGORIES.map((category) => ({ category, paise: semesterFee(prog.semesterFeePaise, fees, category) })),
      },
    };
  });
}

/** Moves the batch to its next semester, or graduates it. Refused while any current subject is unlocked. Roll numbers, attendance and marks stay. */
export async function advanceBatch(batchId: number): Promise<Result> {
  const v = await requireCan("setup");
  const id = pick("Pick a batch.").safeParse(batchId);
  if (!id.success) return { error: id.error.issues[0].message };
  const error = await db.transaction(async (tx) => {
    const b = await campusBatch(tx, v.campusId, id.data);
    if (!b) return "Batch not found on this campus.";
    const [prog] = await tx.select().from(programme).where(eq(programme.id, b.programmeId));
    const subs = await currentSubjects(tx, b);
    const blocker = promoteBlocker(subs);
    if (blocker) return blocker;
    const next = nextTerm(b, prog.durationYears);
    const students = await tx.select({ id: student.id, category: student.category }).from(student)
      .where(and(eq(student.batchId, b.id), isNull(student.graduatedOn)));
    if (next.kind === "graduate") {
      if (students.length) {
        await tx.update(student).set({ graduatedOn: istDate() }).where(and(eq(student.batchId, b.id), isNull(student.graduatedOn)));
      }
      await audit(tx, v, { action: "setup.batch.graduate", entity: "batch", entityId: b.id, oldValue: b, newValue: { students: students.length } });
      return null;
    }
    // Stamp the finished semester's subjects, then clone them for the new one.
    if (subs.length) await tx.update(subject).set({ semester: b.semester }).where(inArray(subject.id, subs.map((s) => s.id)));
    const [row] = await tx.update(batch).set({ year: next.year, semester: next.semester }).where(eq(batch.id, b.id)).returning();
    const fees = await tx.select().from(feeStructure).where(eq(feeStructure.programmeId, prog.id));
    const created: number[] = [];
    for (const s of subs) {
      const [clone] = await tx.insert(subject).values({
        batchId: b.id, facultyId: s.facultyId, code: s.code, name: s.name, kind: s.kind, marksStatus: "draft", semester: next.semester,
        internalMax: s.internalMax, midMax: s.midMax, endMax: s.endMax, theoryScale: s.theoryScale,
        labExamMax: s.labExamMax, vivaMax: s.vivaMax, ceMax: s.ceMax,
      }).returning({ id: subject.id });
      const comps = await tx.select().from(markComponent).where(eq(markComponent.subjectId, s.id));
      if (comps.length) {
        await tx.insert(markComponent).values(comps.map((c) => ({
          subjectId: clone.id, name: c.name, maxMarks: c.maxMarks, position: c.position, section: c.section,
        })));
      }
      created.push(clone.id);
    }
    const today = istDate();
    for (const s of students) {
      const fee = semesterFee(prog.semesterFeePaise, fees, s.category);
      if (fee <= 0) continue;
      const half = Math.round(fee / 2);
      await tx.insert(feeInstalment).values([
        { studentId: s.id, semester: next.semester, label: `Sem ${next.semester} instalment 1/2`, dueDate: plusDays(today, 30), amountPaise: half, scholarshipPaise: 0 },
        { studentId: s.id, semester: next.semester, label: `Sem ${next.semester} instalment 2/2`, dueDate: plusDays(today, 120), amountPaise: fee - half, scholarshipPaise: 0 },
      ]);
    }
    await audit(tx, v, { action: "setup.batch.promote", entity: "batch", entityId: b.id, oldValue: b, newValue: { batch: row, subjects: created } });
    return null;
  });
  if (error) return { error };
  revalidatePath("/setup");
  return {};
}
