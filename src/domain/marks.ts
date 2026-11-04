export type MarksStatus = "draft" | "submitted" | "locked";
export type MarksAction = "submit" | "send_back" | "lock" | "reopen";
export type Role = "faculty" | "office_admin";

export const INTERNAL_TOTAL = 40;

const RULES: Record<MarksAction, { from: MarksStatus; to: MarksStatus; role: Role | "any"; reason: boolean }> = {
  submit: { from: "draft", to: "submitted", role: "any", reason: false },
  send_back: { from: "submitted", to: "draft", role: "office_admin", reason: true },
  lock: { from: "submitted", to: "locked", role: "office_admin", reason: false },
  reopen: { from: "locked", to: "submitted", role: "office_admin", reason: true },
};

/** Next status, or an error message a user can read. */
export function transition(
  status: MarksStatus, action: MarksAction, role: Role, reason?: string,
): { ok: true; to: MarksStatus } | { ok: false; error: string } {
  const r = RULES[action];
  if (r.role !== "any" && r.role !== role) return { ok: false, error: "Only an office admin can do this." };
  if (r.from !== status) return { ok: false, error: `Marks are ${status}, so this can't be done.` };
  if (r.reason && !reason?.trim()) return { ok: false, error: "A reason is required." };
  return { ok: true, to: r.to };
}

/** Faculty edit drafts; an office admin moderates submitted marks; locked marks need a reopen. */
export function canEditMarks(status: MarksStatus, role: Role): boolean {
  return role === "faculty" ? status === "draft" : status === "submitted";
}

export function validateComponents(components: { name: string; maxMarks: number }[]): string | null {
  const sum = components.reduce((n, c) => n + c.maxMarks, 0);
  if (components.some((c) => !c.name.trim() || c.maxMarks <= 0)) return "Each component needs a name and positive marks.";
  return sum === INTERNAL_TOTAL ? null : `Components add up to ${sum}; they must total ${INTERNAL_TOTAL}.`;
}

export function validateMark(value: number | null, maxMarks: number): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > maxMarks) return `Enter 0 to ${maxMarks}.`;
  return null;
}

export function canSubmit(components: { id: number }[], marks: { componentId: number; marks: number | null }[], students: number): string | null {
  const filled = marks.filter((m) => m.marks !== null).length;
  const need = components.length * students;
  return filled === need ? null : `${need - filled} marks are still empty.`;
}

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));

/**
 * University upload file. The brief gives no format, so the columns are an assumption labelled in the TDD:
 * RollNo, Name, SubjectCode, one column per component, InternalTotal.
 */
export function universityCsv(
  subjectCode: string,
  components: { id: number; name: string }[],
  students: { id: number; rollNo: string; name: string }[],
  marks: { componentId: number; studentId: number; marks: number | null }[],
): string {
  const key = (c: number, s: number) => `${c}:${s}`;
  const byKey = new Map(marks.map((m) => [key(m.componentId, m.studentId), m.marks]));
  const rows = students.map((s) => {
    const vals = components.map((c) => byKey.get(key(c.id, s.id)) ?? 0);
    const total = vals.reduce((a, b) => a + b, 0);
    return [s.rollNo, s.name, subjectCode, ...vals, total].map(csvCell).join(",");
  });
  return [["RollNo", "Name", "SubjectCode", ...components.map((c) => c.name), "InternalTotal"].map(csvCell).join(","), ...rows].join("\n") + "\n";
}
