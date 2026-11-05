import { eq } from "drizzle-orm";
import type { Scheme } from "@/domain/marks";
import { resultRows } from "@/domain/results";
import type { Tx } from "@/server/db";
import { mark, markComponent, result, student, subject } from "@/server/schema";

/** Replaces the precomputed results of a subject. Called inside the transaction that locks it or decides an accepted mark appeal. */
export async function writeResults(tx: Tx, subjectId: number) {
  const [s] = await tx.select({
    batchId: subject.batchId, kind: subject.kind, internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax,
    theoryScale: subject.theoryScale, labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
  }).from(subject).where(eq(subject.id, subjectId));
  const components = await tx.select({ id: markComponent.id, section: markComponent.section }).from(markComponent).where(eq(markComponent.subjectId, subjectId));
  const marks = await tx.select({ studentId: mark.studentId, componentId: mark.componentId, marks: mark.marks })
    .from(mark).innerJoin(markComponent, eq(mark.componentId, markComponent.id)).where(eq(markComponent.subjectId, subjectId));
  const students = await tx.select({ id: student.id }).from(student).where(eq(student.batchId, s.batchId));
  const scheme: Scheme = {
    kind: s.kind, internalMax: s.internalMax, midMax: s.midMax, endMax: s.endMax, theoryScale: s.theoryScale,
    labExamMax: s.labExamMax, vivaMax: s.vivaMax, ceMax: s.ceMax,
  };
  const rows = resultRows(subjectId, scheme, components, marks, students.map((x) => x.id));

  await tx.delete(result).where(eq(result.subjectId, subjectId));
  if (rows.length) await tx.insert(result).values(rows);
}

export async function clearResults(tx: Tx, subjectId: number) {
  await tx.delete(result).where(eq(result.subjectId, subjectId));
}
