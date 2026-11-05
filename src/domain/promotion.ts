/** Codes of subjects not yet locked; promotion waits until the list is empty. Null when promotion may go ahead. */
export function promoteBlocker(subjects: { code: string; marksStatus: string }[]): string | null {
  const open = subjects.filter((s) => s.marksStatus !== "locked").map((s) => s.code);
  return open.length ? `Lock every subject first: ${open.join(", ")}.` : null;
}

/** The term a batch moves to next: the following semester, or graduation after the last one. */
export function nextTerm(
  b: { year: number; semester: number }, durationYears: number,
): { kind: "promote"; year: number; semester: number } | { kind: "graduate" } {
  if (b.semester >= durationYears * 2) return { kind: "graduate" };
  const semester = b.semester + 1;
  return { kind: "promote", year: Math.ceil(semester / 2), semester };
}
