import { and, asc, desc, eq, sql } from "drizzle-orm";
import { sectionsFor, type MarksStatus, type Section } from "@/domain/marks";
import { assertSubjectAccess, type Viewer } from "@/server/access";
import { db } from "@/server/db";
import { auditLog, batch, mark, markComponent, programme, staff, student, subject } from "@/server/schema";

export type SubjectRow = {
  id: number; code: string; name: string; batch: string; faculty: string | null; status: MarksStatus; filled: number; needed: number;
};

/** Faculty see their own subjects; office admins see every subject on the campus. */
export async function listSubjects(v: Viewer): Promise<SubjectRow[]> {
  const rows = await db.select({
    id: subject.id, code: subject.code, name: subject.name, batch: batch.code, faculty: staff.name, status: subject.marksStatus,
    components: sql<number>`(select count(*) from mark_component c where c.subject_id = subject.id)`.mapWith(Number),
    students: sql<number>`(select count(*) from student s where s.batch_id = subject.batch_id)`.mapWith(Number),
    filled: sql<number>`(select count(*) from mark m join mark_component c on c.id = m.component_id join student s on s.id = m.student_id where c.subject_id = subject.id and s.batch_id = subject.batch_id and m.marks is not null)`.mapWith(Number),
  }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .leftJoin(staff, eq(subject.facultyId, staff.id))
    .where(and(eq(programme.campusId, v.campusId), v.role === "faculty" ? eq(subject.facultyId, v.staffId) : undefined))
    .orderBy(batch.code, subject.code);
  return rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, batch: r.batch, faculty: r.faculty, status: r.status,
    filled: r.filled, needed: r.components * r.students,
  }));
}

/** The marks sheet: components in order, students by roll number, every mark entered. Throws if the viewer may not see the subject. */
export async function getSheet(v: Viewer, subjectId: number) {
  await assertSubjectAccess(v, subjectId);
  const [s] = await db.select({
    id: subject.id, code: subject.code, name: subject.name, batchId: subject.batchId, batch: batch.code, status: subject.marksStatus, faculty: staff.name,
    kind: subject.kind, internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax, theoryScale: subject.theoryScale,
    labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
  }).from(subject)
    .innerJoin(batch, eq(subject.batchId, batch.id))
    .leftJoin(staff, eq(subject.facultyId, staff.id))
    .where(eq(subject.id, subjectId));
  // Lab sections left over from a lab-to-theory switch are kept in the database but hidden here.
  const allComponents = await db.select({ id: markComponent.id, name: markComponent.name, maxMarks: markComponent.maxMarks, section: markComponent.section })
    .from(markComponent).where(eq(markComponent.subjectId, subjectId)).orderBy(asc(markComponent.position), asc(markComponent.id));
  const applies = sectionsFor(s.kind);
  const components = allComponents.filter((c) => applies.includes(c.section as Section));
  const students = await db.select({ id: student.id, rollNo: student.rollNo, name: student.name })
    .from(student).where(eq(student.batchId, s.batchId)).orderBy(asc(student.rollNo));
  const marks = await db.select({ componentId: mark.componentId, studentId: mark.studentId, marks: mark.marks })
    .from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id))
    .where(eq(markComponent.subjectId, subjectId));
  return { subject: s, components, students, marks };
}
export type SheetData = Awaited<ReturnType<typeof getSheet>>;

/** Latest 50 audit rows for a subject. Call only after getSheet has checked access. */
export function getSubjectHistory(v: Viewer, subjectId: number) {
  return db.select().from(auditLog)
    .where(and(eq(auditLog.campusId, v.campusId), eq(auditLog.entity, "subject"), eq(auditLog.entityId, String(subjectId))))
    .orderBy(desc(auditLog.at))
    .limit(50);
}
