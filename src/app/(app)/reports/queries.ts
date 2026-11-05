import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { istDate } from "@/domain/attendance";
import type { Instalment } from "@/domain/fees";
import { sectionsFor, type Scheme, type Section } from "@/domain/marks";
import {
  aicteFacultyRows, asOfDate, cadreRows, departmentPostRows, enrolmentRows, feeRows, intakeRows, lastDay, marksRows, passMarkFor, passRows, REPORTS,
  scholarshipRows, sfrRows, shortageRows, strengthRows, studentTeacherRows, type Column, type ReportKey, type Row, type StudentFees,
  type SubjectAttendance, type SubjectMarks,
} from "@/domain/reports";
import { db } from "@/server/db";
import {
  attendanceEntry, attendanceSession, batch, department, feeInstalment, feePayment, mark, markComponent, programme, result, scholarshipAward,
  scholarshipScheme, staff, student, subject,
} from "@/server/schema";

const DAY = 86_400_000;
const heldSum = sql<number>`coalesce(sum(${attendanceSession.periodCount}), 0)`.mapWith(Number);
const attendedSum = sql<number>`coalesce(sum(case when ${attendanceEntry.status} <> 'absent' then ${attendanceSession.periodCount} else 0 end), 0)`.mapWith(Number);
const programmeFilter = (programmeId: number | null) => (programmeId === null ? undefined : eq(programme.id, programmeId));

export function listProgrammes(campusId: number) {
  return db.select({ id: programme.id, code: programme.code, name: programme.name }).from(programme)
    .where(eq(programme.campusId, campusId)).orderBy(asc(programme.code));
}

function loadStrength(campusId: number, programmeId: number | null) {
  return db.select({ programme: programme.code, year: batch.year, batch: batch.code, category: student.category, gender: student.gender }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId), isNull(student.graduatedOn)));
}

function loadShortage(campusId: number, month: string, programmeId: number | null): Promise<SubjectAttendance[]> {
  return db.select({
    roll: student.rollNo, name: student.name, programme: programme.code, cutoff: programme.attendanceCutoff, subject: subject.name,
    held: heldSum, attended: attendedSum,
  }).from(attendanceEntry)
    .innerJoin(student, eq(attendanceEntry.studentId, student.id))
    .innerJoin(attendanceSession, eq(attendanceEntry.sessionId, attendanceSession.id))
    .innerJoin(subject, eq(attendanceSession.subjectId, subject.id))
    .innerJoin(batch, eq(attendanceSession.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(
      eq(programme.campusId, campusId), gte(attendanceSession.date, `${month}-01`), lte(attendanceSession.date, lastDay(month)),
      programmeFilter(programmeId), isNull(student.graduatedOn),
      // Only the batch's current subjects: its own, and those not stamped with an earlier semester
      sql`${attendanceSession.subjectId} in (select s.id from subject s where s.batch_id = batch.id and (s.semester is null or s.semester = batch.semester))`,
    ))
    .groupBy(student.id, subject.id, programme.id);
}

/** Current marks: each student's section totals, and whether every applicable component has a mark. */
async function loadMarks(campusId: number, programmeId: number | null): Promise<SubjectMarks[]> {
  const subjects = await db.select({
    id: subject.id, code: subject.code, name: subject.name, status: subject.marksStatus, batchId: subject.batchId, kind: subject.kind,
    internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax, theoryScale: subject.theoryScale,
    labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
  }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)))
    .orderBy(asc(subject.code));
  if (!subjects.length) return [];
  const ids = subjects.map((s) => s.id);
  const components = await db.select({ id: markComponent.id, subjectId: markComponent.subjectId, section: markComponent.section })
    .from(markComponent).where(inArray(markComponent.subjectId, ids));
  const marks = await db.select({ componentId: mark.componentId, studentId: mark.studentId, marks: mark.marks }).from(mark)
    .innerJoin(markComponent, eq(mark.componentId, markComponent.id))
    .where(inArray(markComponent.subjectId, ids));
  const students = await db.select({ id: student.id, batchId: student.batchId }).from(student)
    .where(inArray(student.batchId, subjects.map((s) => s.batchId)));
  const value = new Map(marks.map((m): [string, number | null] => [`${m.componentId}:${m.studentId}`, m.marks]));

  return subjects.map((s) => {
    const applies = sectionsFor(s.kind);
    const parts = components.filter((c) => c.subjectId === s.id && applies.includes(c.section as Section));
    return {
      code: s.code, name: s.name, status: s.status, scheme: s as Scheme,
      students: students.filter((st) => st.batchId === s.batchId).map((st) => {
        const bySection: Partial<Record<Section, number>> = {};
        let complete = parts.length > 0;
        for (const c of parts) {
          const v = value.get(`${c.id}:${st.id}`);
          if (v === null || v === undefined) { complete = false; continue; }
          bySection[c.section as Section] = (bySection[c.section as Section] ?? 0) + v;
        }
        return { complete, marks: bySection };
      }),
    };
  });
}

/** Instalments and the payments made up to the end of the as-of day (IST). */
async function loadFees(campusId: number, asOf: string, programmeId: number | null): Promise<StudentFees[]> {
  const end = new Date(new Date(`${asOf}T00:00:00+05:30`).getTime() + DAY);
  const paidAsOf = sql<number>`(select coalesce(sum(p.amount_paise),0) from ${feePayment} p where p.instalment_id=fee_instalment.id and p.paid_at < ${end})`.mapWith(Number);
  const students = await db.select({ id: student.id, programme: programme.code }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)));
  const instalments = await db.select({
    studentId: feeInstalment.studentId, id: feeInstalment.id, dueDate: feeInstalment.dueDate,
    amountPaise: feeInstalment.amountPaise, scholarshipPaise: feeInstalment.scholarshipPaise, paidPaise: paidAsOf,
  }).from(feeInstalment)
    .innerJoin(student, eq(feeInstalment.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)));
  const byStudent = new Map<number, Instalment[]>();
  for (const { studentId, ...i } of instalments) byStudent.set(studentId, [...(byStudent.get(studentId) ?? []), i]);
  return students.map((s) => ({ programme: s.programme, instalments: byStudent.get(s.id) ?? [] }));
}

function loadIntake(campusId: number, programmeId: number | null) {
  const batches = db.select({ programme: programme.code, sanctioned: programme.sanctionedIntake, year: batch.admissionYear }).from(batch)
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)));
  // Alumni are counted: everyone admitted that year.
  const students = db.select({ programme: programme.code, year: batch.admissionYear, category: student.category, gender: student.gender }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)));
  return Promise.all([batches, students]);
}

/** All staff on the campus except the trust's; the builders pick the teaching roles they count. */
const campusStaff = (campusId: number) => db.select({
  departmentId: staff.departmentId, department: department.name, name: staff.name, role: staff.role,
  designation: staff.designation, qualification: staff.qualification,
}).from(staff)
  .leftJoin(department, eq(staff.departmentId, department.id))
  .where(and(eq(staff.campusId, campusId), ne(staff.role, "trust")));

function loadSfr(campusId: number, programmeId: number | null) {
  const programmes = db.select({ code: programme.code, departmentId: programme.departmentId }).from(programme)
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)));
  const students = db.select({ programme: programme.code }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId), isNull(student.graduatedOn)));
  return Promise.all([programmes, students, campusStaff(campusId)]);
}

function loadCadre(campusId: number) {
  const departments = db.select({ id: department.id, name: department.name }).from(department)
    .where(eq(department.campusId, campusId));
  return Promise.all([departments, campusStaff(campusId)]);
}

/** Students not yet alumni on the campus, in the programme if one is chosen. */
async function countStudents(campusId: number, programmeId: number | null): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId), isNull(student.graduatedOn)));
  return n;
}

const loadTeachers = (campusId: number) => Promise.all([countStudents(campusId, null), campusStaff(campusId)]);

function loadPosts(campusId: number) {
  const departments = db.select({ id: department.id, name: department.name, sanctionedPosts: department.sanctionedPosts }).from(department)
    .where(eq(department.campusId, campusId));
  return Promise.all([departments, campusStaff(campusId)]);
}

/** Results of locked subjects in final-year batches (batch year = programme duration), alumni included. */
async function loadPass(campusId: number, programmeId: number | null) {
  const programmes = db.select({ code: programme.code }).from(programme)
    .where(and(eq(programme.campusId, campusId), programmeFilter(programmeId)));
  const results = db.select({
    studentId: result.studentId, programme: programme.code, total: result.total,
    kind: subject.kind, theoryScale: subject.theoryScale, labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
  }).from(result)
    .innerJoin(subject, eq(result.subjectId, subject.id))
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(student, and(eq(student.id, result.studentId), eq(student.batchId, batch.id)))
    .where(and(
      eq(programme.campusId, campusId), programmeFilter(programmeId), eq(subject.marksStatus, "locked"),
      sql`${batch.year} = ${programme.durationYears}`,
    ));
  const [codes, lines] = await Promise.all([programmes, results]);
  return passRows(codes.map((p) => p.code), lines.map((l) => ({ studentId: l.studentId, programme: l.programme, total: l.total, passMark: passMarkFor(l) })));
}

/** Awards not withdrawn, for students not yet alumni, by funding source. */
async function loadScholarships(campusId: number, programmeId: number | null) {
  const awards = await db.select({ studentId: scholarshipAward.studentId, fundingSource: scholarshipScheme.fundingSource }).from(scholarshipAward)
    .innerJoin(scholarshipScheme, eq(scholarshipAward.schemeId, scholarshipScheme.id))
    .innerJoin(student, eq(scholarshipAward.studentId, student.id))
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .where(and(
      eq(programme.campusId, campusId), programmeFilter(programmeId), isNull(student.graduatedOn), isNull(scholarshipAward.withdrawnAt),
    ));
  return Promise.all([awards, countStudents(campusId, programmeId)]);
}

export type ReportOptions = { month: string; programmeId?: number | null; today?: string };

/** One report's columns and rows for a campus. `month` is YYYY-MM; fees are as at its end, or today for the current month. */
export async function runReport(v: { campusId: number }, key: ReportKey, o: ReportOptions): Promise<{ columns: Column[]; rows: Row[] }> {
  const programmeId = o.programmeId ?? null;
  const asOf = asOfDate(o.month, o.today ?? istDate());
  const columns = REPORTS.find((r) => r.key === key)!.columns;
  let rows: Row[];
  if (key === "strength") rows = strengthRows(await loadStrength(v.campusId, programmeId));
  else if (key === "shortage") rows = shortageRows(await loadShortage(v.campusId, o.month, programmeId));
  else if (key === "marks") rows = marksRows(await loadMarks(v.campusId, programmeId));
  else if (key === "fees") rows = feeRows(await loadFees(v.campusId, asOf, programmeId), asOf);
  else if (key === "aicte_intake") { const [batches, students] = await loadIntake(v.campusId, programmeId); rows = intakeRows(batches, students); }
  else if (key === "aicte_faculty") rows = aicteFacultyRows(await campusStaff(v.campusId));
  else if (key === "aicte_sfr") { const [programmes, students, staffRows] = await loadSfr(v.campusId, programmeId); rows = sfrRows(programmes, students, staffRows); }
  else if (key === "aicte_cadre") { const [departments, staffRows] = await loadCadre(v.campusId); rows = cadreRows(departments, staffRows); }
  else if (key === "naac_2_1_1") { const [batches, students] = await loadIntake(v.campusId, programmeId); rows = enrolmentRows(batches, students); }
  else if (key === "naac_2_2") { const [students, staffRows] = await loadTeachers(v.campusId); rows = studentTeacherRows(students, staffRows); }
  else if (key === "naac_2_4_1") { const [departments, staffRows] = await loadPosts(v.campusId); rows = departmentPostRows(departments, staffRows); }
  else if (key === "naac_2_6_3") rows = await loadPass(v.campusId, programmeId);
  else if (key === "naac_5_1_1") { const [awards, total] = await loadScholarships(v.campusId, programmeId); rows = scholarshipRows(awards, total); }
  else throw new Error(`Unknown report: ${key}`);
  return { columns, rows };
}
