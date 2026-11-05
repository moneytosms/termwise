import { can, type StaffRole } from "./roles";
export type MarksStatus = "draft" | "submitted" | "locked";
export type MarksAction = "submit" | "send_back" | "lock" | "reopen";
export type Role = StaffRole;

export const SECTIONS = ["internal", "mid", "end", "lab_exam", "viva", "ce"] as const;
export type Section = (typeof SECTIONS)[number];
export type Kind = "theory" | "lab";
/** The subject's mark scheme, read from the subject row. */
export type Scheme = {
  kind: Kind; internalMax: number; midMax: number; endMax: number; theoryScale: number; labExamMax: number; vivaMax: number; ceMax: number;
};

export const SECTION_LABEL: Record<Section, string> = {
  internal: "Internal", mid: "Mid-term", end: "End-term", lab_exam: "Lab exam", viva: "Viva", ce: "Continuous evaluation",
};
const SECTION_MAX_KEY = {
  internal: "internalMax", mid: "midMax", end: "endMax", lab_exam: "labExamMax", viva: "vivaMax", ce: "ceMax",
} as const;
const LAB_SECTIONS: Section[] = ["lab_exam", "viva", "ce"];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function sectionMax(s: Scheme, section: Section): number {
  return s[SECTION_MAX_KEY[section]];
}

export function sectionsFor(kind: Kind): Section[] {
  return kind === "lab" ? [...SECTIONS] : SECTIONS.filter((x) => !LAB_SECTIONS.includes(x));
}

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
  if (r.role !== "any" && !can(role, "moderate_marks")) return { ok: false, error: "Only an office admin can do this." };
  if (r.from !== status) return { ok: false, error: `Marks are ${status}, so this can't be done.` };
  if (r.reason && !reason?.trim()) return { ok: false, error: "A reason is required." };
  return { ok: true, to: r.to };
}

/** Faculty edit drafts; an office admin moderates submitted marks; locked marks need a reopen. */
export function canEditMarks(status: MarksStatus, role: Role): boolean {
  return can(role, "moderate_marks") ? status === "submitted" : status === "draft";
}

/** Internal components sum to internalMax; every other section applying to the kind is exactly one component of its max. */
export function validateComponents(
  components: { name: string; maxMarks: number; section: Section }[], s: Scheme,
): string | null {
  if (components.some((c) => !c.name.trim() || c.maxMarks <= 0)) return "Each component needs a name and positive marks.";
  const allowed = sectionsFor(s.kind);
  if (components.some((c) => !allowed.includes(c.section))) return "A theory subject has no lab sections.";
  const internal = components.filter((c) => c.section === "internal").reduce((n, c) => n + c.maxMarks, 0);
  if (internal !== s.internalMax) return `Internal components add up to ${internal}; they must total ${s.internalMax}.`;
  for (const sec of allowed) {
    if (sec === "internal") continue;
    const max = sectionMax(s, sec);
    const mine = components.filter((c) => c.section === sec);
    if (mine.length !== 1 || mine[0].maxMarks !== max) return `${SECTION_LABEL[sec]} must be one component of ${max}.`;
  }
  return null;
}

/** Theory is internal + mid + end, scaled to theoryScale; a lab adds lab exam + viva + CE on top. Missing marks count as 0. */
export function finalScore(s: Scheme, marksBySection: Partial<Record<Section, number>>): { theory: number; theoryScaled: number; lab: number; total: number } {
  const v = (sec: Section) => marksBySection[sec] ?? 0;
  const theory = v("internal") + v("mid") + v("end");
  const theoryScaled = r2((theory * s.theoryScale) / (s.internalMax + s.midMax + s.endMax));
  const lab = s.kind === "lab" ? r2(LAB_SECTIONS.reduce((n, sec) => n + v(sec), 0)) : 0;
  return { theory: r2(theory), theoryScaled, lab, total: r2(theoryScaled + lab) };
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
  allComponents: { id: number; name: string; section: Section }[],
  students: { id: number; rollNo: string; name: string }[],
  marks: { componentId: number; studentId: number; marks: number | null }[],
): string {
  const components = allComponents.filter((c) => c.section === "internal");
  const key = (c: number, s: number) => `${c}:${s}`;
  const byKey = new Map(marks.map((m) => [key(m.componentId, m.studentId), m.marks]));
  const rows = students.map((s) => {
    const vals = components.map((c) => byKey.get(key(c.id, s.id)) ?? 0);
    const total = vals.reduce((a, b) => a + b, 0);
    return [s.rollNo, s.name, subjectCode, ...vals, total].map(csvCell).join(",");
  });
  return [["RollNo", "Name", "SubjectCode", ...components.map((c) => c.name), "InternalTotal"].map(csvCell).join(","), ...rows].join("\n") + "\n";
}
