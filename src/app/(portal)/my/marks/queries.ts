import { and, eq } from "drizzle-orm";
import { finalScore, sectionsFor, type Kind, type Scheme, type Section } from "@/domain/marks";
import { db } from "@/server/db";
import { mark, markComponent, subject } from "@/server/schema";

export type MarksStatus = "draft" | "submitted" | "locked";

export type Component = { id: number; name: string; section: Section; max: number; marks: number | null };
export type SubjectMarks = {
  id: number; code: string; name: string; status: MarksStatus; kind: Kind; scheme: Scheme;
  comps: Component[];
  /** Internal section marks entered so far, or null when none are entered. */
  internal: number | null;
  /** Final out of 100, or null until every component has a mark. */
  final: { total: number; theoryScaled: number; lab: number } | null;
};

/** Every subject in the batch with its components and this student's entries (null where not entered). */
export async function studentMarks(studentId: number, batchId: number) {
  const rows = await db.select({
    subjectId: subject.id, code: subject.code, name: subject.name, status: subject.marksStatus,
    kind: subject.kind, internalMax: subject.internalMax, midMax: subject.midMax, endMax: subject.endMax, theoryScale: subject.theoryScale,
    labExamMax: subject.labExamMax, vivaMax: subject.vivaMax, ceMax: subject.ceMax,
    componentId: markComponent.id, component: markComponent.name, section: markComponent.section, max: markComponent.maxMarks, marks: mark.marks,
  }).from(subject)
    .leftJoin(markComponent, eq(markComponent.subjectId, subject.id))
    .leftJoin(mark, and(eq(mark.componentId, markComponent.id), eq(mark.studentId, studentId)))
    .where(eq(subject.batchId, batchId))
    .orderBy(subject.code, markComponent.position);
  const bySubject = new Map<number, SubjectMarks>();
  for (const r of rows) {
    if (!bySubject.has(r.subjectId)) {
      const scheme: Scheme = {
        kind: r.kind, internalMax: r.internalMax, midMax: r.midMax, endMax: r.endMax, theoryScale: r.theoryScale,
        labExamMax: r.labExamMax, vivaMax: r.vivaMax, ceMax: r.ceMax,
      };
      bySubject.set(r.subjectId, { id: r.subjectId, code: r.code, name: r.name, status: r.status, kind: r.kind, scheme, comps: [], internal: null, final: null });
    }
    if (r.component === null || r.max === null || r.section === null) continue; // subject without components
    bySubject.get(r.subjectId)!.comps.push({ id: r.componentId!, name: r.component, section: r.section, max: r.max, marks: r.marks });
  }
  return [...bySubject.values()].map((s) => {
    // Lab sections left over from a lab-to-theory switch are ignored.
    s.comps = s.comps.filter((c) => sectionsFor(s.kind).includes(c.section));
    const sums: Partial<Record<Section, number>> = {};
    for (const c of s.comps) if (c.marks !== null) sums[c.section] = (sums[c.section] ?? 0) + c.marks;
    if (sums.internal !== undefined) s.internal = sums.internal;
    if (s.comps.length > 0 && s.comps.every((c) => c.marks !== null)) s.final = finalScore(s.scheme, sums);
    return s;
  });
}
