import type { StaffRole } from "@/domain/roles";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { batch, calendarDay, campus, department, feeStructure, programme, requiredDocument, scholarshipScheme, staff, student, subject, timetableSlot } from "@/server/schema";

export const getCampus = async (campusId: number) => {
  const [row] = await db.select().from(campus).where(eq(campus.id, campusId));
  return row;
};

export const listDepartments = (campusId: number) =>
  db.select({ id: department.id, name: department.name }).from(department)
    .where(eq(department.campusId, campusId)).orderBy(department.name);

export const listProgrammes = (campusId: number) =>
  db.select({
    id: programme.id, code: programme.code, name: programme.name, departmentId: programme.departmentId,
    department: department.name, cutoff: programme.attendanceCutoff,
  }).from(programme)
    .leftJoin(department, eq(programme.departmentId, department.id))
    .where(eq(programme.campusId, campusId)).orderBy(programme.code);

/** Programmes with their default semester fee and any per-category fees (category -> paise). */
export async function listFeeStructure(campusId: number) {
  const progs = await db.select({ id: programme.id, code: programme.code, name: programme.name, defaultPaise: programme.semesterFeePaise })
    .from(programme).where(eq(programme.campusId, campusId)).orderBy(programme.code);
  const fees = await db.select({ programmeId: feeStructure.programmeId, category: feeStructure.category, paise: feeStructure.semesterFeePaise })
    .from(feeStructure)
    .innerJoin(programme, eq(feeStructure.programmeId, programme.id))
    .where(eq(programme.campusId, campusId));
  return progs.map((p) => ({
    ...p,
    fees: Object.fromEntries(fees.filter((f) => f.programmeId === p.id).map((f) => [f.category, f.paise])) as Record<string, number>,
  }));
}

export const listSchemes = (campusId: number) =>
  db.select({
    id: scholarshipScheme.id, name: scholarshipScheme.name, fundingSource: scholarshipScheme.fundingSource,
    kind: scholarshipScheme.kind, value: scholarshipScheme.value, categories: scholarshipScheme.categories, active: scholarshipScheme.active,
  }).from(scholarshipScheme)
    .where(eq(scholarshipScheme.campusId, campusId)).orderBy(scholarshipScheme.name);

export const listRequiredDocuments = (campusId: number) =>
  db.select({
    id: requiredDocument.id, programmeId: requiredDocument.programmeId, programme: programme.code,
    name: requiredDocument.name, categories: requiredDocument.categories,
  }).from(requiredDocument)
    .innerJoin(programme, eq(requiredDocument.programmeId, programme.id))
    .where(eq(programme.campusId, campusId)).orderBy(programme.code, requiredDocument.name);

export const listBatches = (campusId: number) =>
  db.select({
    id: batch.id, code: batch.code, programmeId: batch.programmeId, programme: programme.name,
    admissionYear: batch.admissionYear, year: batch.year, semester: batch.semester,
    students: sql<number>`(select count(*) from ${student} where ${student.batchId} = ${batch.id})`.mapWith(Number),
  }).from(batch)
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(eq(programme.campusId, campusId)).orderBy(batch.code);

export const listSubjects = (campusId: number) =>
  db.select({
    id: subject.id, batchId: subject.batchId, batch: batch.code, code: subject.code, name: subject.name,
    facultyId: subject.facultyId, faculty: staff.name, marksStatus: subject.marksStatus,
    kind: subject.kind, internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax, theoryScale: subject.theoryScale,
    labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
  }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .leftJoin(staff, eq(subject.facultyId, staff.id))
    .where(eq(programme.campusId, campusId)).orderBy(batch.code, subject.code);

/** Staff with role faculty on this campus, for subject assignment. */
export const listFaculty = (campusId: number) =>
  db.select({ id: staff.id, name: staff.name }).from(staff)
    .where(and(eq(staff.campusId, campusId), eq(staff.role, "faculty"))).orderBy(staff.name);

export const listStaff = (campusId: number) =>
  db.select({
    id: staff.id, name: staff.name, department: department.name, role: sql<StaffRole>`${staff.role}`,
    hasAccount: sql<boolean>`${staff.userId} is not null`,
    subjects: sql<number>`(select count(*) from ${subject} where ${subject.facultyId} = ${staff.id})`.mapWith(Number),
    mentees: sql<number>`(select count(*) from ${student} where ${student.mentorId} = ${staff.id})`.mapWith(Number),
  }).from(staff)
    .leftJoin(department, eq(staff.departmentId, department.id))
    .where(and(eq(staff.campusId, campusId), ne(staff.role, "trust"))).orderBy(staff.name);

export const listCalendar = (campusId: number) =>
  db.select().from(calendarDay).where(eq(calendarDay.campusId, campusId)).orderBy(calendarDay.date);

/** Slots of one batch, which the caller has already checked is on this campus. */
export const listSlots = (campusId: number, batchId: number) =>
  db.select({
    id: timetableSlot.id, dayOfWeek: timetableSlot.dayOfWeek, period: timetableSlot.period,
    periodCount: timetableSlot.periodCount, startTime: timetableSlot.startTime, endTime: timetableSlot.endTime,
    subjectId: timetableSlot.subjectId, subject: subject.name, label: timetableSlot.label,
  }).from(timetableSlot)
    .innerJoin(batch, eq(timetableSlot.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .leftJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .where(and(eq(timetableSlot.batchId, batchId), eq(programme.campusId, campusId)));

export async function getRules(campusId: number) {
  const [row] = await db.select({
    riskDropPoints: campus.riskDropPoints, riskMarksPercent: campus.riskMarksPercent, riskMinSessions: campus.riskMinSessions,
  }).from(campus).where(eq(campus.id, campusId));
  return row;
}
