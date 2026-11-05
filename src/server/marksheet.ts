import { and, eq } from "drizzle-orm";
import { sectionsFor, type Section } from "@/domain/marks";
import { markSheetHash } from "@/domain/marksheet";
import { db } from "./db";
import { batch, campus, mark, markComponent, programme, result, student, subject } from "./schema";

export type SheetSection = { section: Section; max: number; marks: number };
export type SheetSubject =
  | { code: string; name: string; status: "pending"; theoryMax: number }
  | { code: string; name: string; status: "locked"; theoryMax: number; internal: number; total: number; sections: SheetSection[] };

/** Every subject of the student's batch. Numbers only for locked subjects that have a result row. */
export async function loadMarkSheet(studentId: number) {
  const [s] = await db.select({
    id: student.id, name: student.name, rollNo: student.rollNo, batchId: student.batchId,
    programme: programme.name, batch: batch.code, year: batch.year, semester: batch.semester, campus,
  }).from(student)
    .innerJoin(batch, eq(student.batchId, batch.id))
    .innerJoin(programme, eq(batch.programmeId, programme.id))
    .innerJoin(campus, eq(programme.campusId, campus.id))
    .where(eq(student.id, studentId));
  if (!s) return null;

  const subjects = await db.select({
    id: subject.id, code: subject.code, name: subject.name, status: subject.marksStatus, kind: subject.kind,
    internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax,
  }).from(subject).where(eq(subject.batchId, s.batchId)).orderBy(subject.code);
  const components = await db.select({
    subjectId: markComponent.subjectId, section: markComponent.section, max: markComponent.maxMarks, marks: mark.marks,
  }).from(markComponent)
    .innerJoin(subject, eq(markComponent.subjectId, subject.id))
    .leftJoin(mark, and(eq(mark.componentId, markComponent.id), eq(mark.studentId, studentId)))
    .where(and(eq(subject.batchId, s.batchId), eq(subject.marksStatus, "locked")));
  const results = await db.select({ subjectId: result.subjectId, internal: result.internal, total: result.total })
    .from(result).where(eq(result.studentId, studentId));
  const resultOf = new Map(results.map((r) => [r.subjectId, r]));

  const list: SheetSubject[] = subjects.map((x) => {
    const theoryMax = x.internalMax + x.midMax + x.endMax;
    const r = resultOf.get(x.id);
    if (x.status !== "locked" || !r) return { code: x.code, name: x.name, status: "pending", theoryMax };
    const sections = sectionsFor(x.kind).flatMap((section): SheetSection[] => {
      const mine = components.filter((c) => c.subjectId === x.id && c.section === section);
      if (!mine.length) return [];
      return [{ section, max: mine.reduce((n, c) => n + c.max, 0), marks: mine.reduce((n, c) => n + (c.marks ?? 0), 0) }];
    });
    return { code: x.code, name: x.name, status: "locked", theoryMax, internal: r.internal, total: r.total, sections };
  });

  return { student: { id: s.id, name: s.name, rollNo: s.rollNo, programme: s.programme, batch: s.batch, year: s.year, semester: s.semester }, campus: s.campus, subjects: list };
}

export type MarkSheet = NonNullable<Awaited<ReturnType<typeof loadMarkSheet>>>;

/** The hash covers the student and the locked subjects only, so it changes whenever a moderated total changes. */
export function sheetHash(sheet: MarkSheet): string {
  return markSheetHash({
    studentId: sheet.student.id, rollNo: sheet.student.rollNo, semester: sheet.student.semester,
    subjects: sheet.subjects.flatMap((x) => (x.status === "locked" ? [{ code: x.code, internal: x.internal, total: x.total }] : [])),
  });
}
