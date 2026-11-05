import { finalScore, type Scheme, type Section } from "./marks";

export type ResultRow = { subjectId: number; studentId: number; internal: number; theoryScaled: number; lab: number; total: number };

/** One result per student in the batch, from the same scheme rules the portal used to compute live. Missing marks count 0. */
export function resultRows(
  subjectId: number,
  scheme: Scheme,
  components: { id: number; section: Section }[],
  marks: { studentId: number; componentId: number; marks: number | null }[],
  studentIds: number[],
): ResultRow[] {
  const sectionOf = new Map(components.map((c) => [c.id, c.section]));
  const sums = new Map<number, Partial<Record<Section, number>>>();
  for (const m of marks) {
    const section = sectionOf.get(m.componentId);
    if (section === undefined || m.marks === null) continue;
    const mine = sums.get(m.studentId) ?? {};
    mine[section] = (mine[section] ?? 0) + m.marks;
    sums.set(m.studentId, mine);
  }
  return studentIds.map((studentId) => {
    const f = finalScore(scheme, sums.get(studentId) ?? {});
    return { subjectId, studentId, internal: f.theory, theoryScaled: f.theoryScaled, lab: f.lab, total: f.total };
  });
}
