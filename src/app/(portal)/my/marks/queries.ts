import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { mark, markComponent, subject } from "@/server/schema";

export const SUBJECT_MAX = 40;
export type MarksStatus = "draft" | "submitted" | "locked";

export type Component = { name: string; max: number; marks: number | null };
export type SubjectMarks = {
  id: number; code: string; name: string; status: MarksStatus;
  comps: Component[]; obtained: number; max: number;
};

/** Every subject in the batch with its components and this student's entries (null where not entered). */
export async function studentMarks(studentId: number, batchId: number) {
  const rows = await db.select({
    subjectId: subject.id, code: subject.code, name: subject.name, status: subject.marksStatus,
    component: markComponent.name, max: markComponent.maxMarks, marks: mark.marks,
  }).from(subject)
    .leftJoin(markComponent, eq(markComponent.subjectId, subject.id))
    .leftJoin(mark, and(eq(mark.componentId, markComponent.id), eq(mark.studentId, studentId)))
    .where(eq(subject.batchId, batchId))
    .orderBy(subject.code, markComponent.position);
  const bySubject = new Map<number, SubjectMarks>();
  for (const r of rows) {
    let s = bySubject.get(r.subjectId);
    if (!s) {
      s = { id: r.subjectId, code: r.code, name: r.name, status: r.status, comps: [], obtained: 0, max: 0 };
      bySubject.set(r.subjectId, s);
    }
    if (r.component === null || r.max === null) continue; // subject without components
    s.comps.push({ name: r.component, max: r.max, marks: r.marks });
    if (r.marks !== null) { s.obtained += r.marks; s.max += r.max; }
  }
  return [...bySubject.values()];
}
