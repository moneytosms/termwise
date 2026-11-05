import { describe, expect, it } from "vitest";
import { canEditMarks, canSubmit, finalScore, sectionsFor, transition, universityCsv, validateComponents, validateMark, type Scheme } from "./marks";

const THEORY: Scheme = { kind: "theory", internalMax: 40, midMax: 20, endMax: 40, theoryScale: 100, labExamMax: 15, vivaMax: 10, ceMax: 5 };
const LAB: Scheme = { ...THEORY, kind: "lab", theoryScale: 70 };
const theoryComps = [
  { name: "Test", maxMarks: 20, section: "internal" as const }, { name: "Quiz", maxMarks: 20, section: "internal" as const },
  { name: "Mid", maxMarks: 20, section: "mid" as const }, { name: "End", maxMarks: 40, section: "end" as const },
];
const labComps = [
  ...theoryComps, { name: "Lab", maxMarks: 15, section: "lab_exam" as const },
  { name: "Viva", maxMarks: 10, section: "viva" as const }, { name: "CE", maxMarks: 5, section: "ce" as const },
];

describe("marks lifecycle", () => {
  it("faculty submit; admin locks", () => {
    expect(transition("draft", "submit", "faculty")).toEqual({ ok: true, to: "submitted" });
    expect(transition("submitted", "lock", "office_admin")).toEqual({ ok: true, to: "locked" });
  });
  it("faculty cannot lock or reopen", () => {
    expect(transition("submitted", "lock", "faculty").ok).toBe(false);
    expect(transition("locked", "reopen", "faculty", "typo").ok).toBe(false);
  });
  it("reopen and send back need a reason", () => {
    expect(transition("locked", "reopen", "office_admin", "  ").ok).toBe(false);
    expect(transition("locked", "reopen", "office_admin", "typo")).toEqual({ ok: true, to: "submitted" });
    expect(transition("submitted", "send_back", "office_admin").ok).toBe(false);
  });
  it("cannot lock a draft", () => expect(transition("draft", "lock", "office_admin").ok).toBe(false));
  it("nobody edits locked marks", () => {
    expect(canEditMarks("locked", "faculty")).toBe(false);
    expect(canEditMarks("locked", "office_admin")).toBe(false);
    expect(canEditMarks("submitted", "faculty")).toBe(false);
    expect(canEditMarks("draft", "faculty")).toBe(true);
    expect(canEditMarks("submitted", "office_admin")).toBe(true);
  });
});

describe("validation", () => {
  it("theory: internal sums to internalMax, mid and end are one component each at their max", () => {
    expect(validateComponents(theoryComps, THEORY)).toBeNull();
    expect(validateComponents(theoryComps.slice(0, 3), THEORY)).toMatch(/end/i);
  });
  it("internal components must total internalMax", () => {
    expect(validateComponents([{ name: "A", maxMarks: 20, section: "internal" }, ...theoryComps.slice(2)], THEORY)).toMatch(/20.*40/);
  });
  it("a fixed section must be one component at its max", () => {
    expect(validateComponents([...theoryComps.slice(0, 2), { name: "Mid", maxMarks: 10, section: "mid" }, theoryComps[3]], THEORY)).toMatch(/Mid-term/);
    expect(validateComponents([...theoryComps, { name: "Mid2", maxMarks: 20, section: "mid" }], THEORY)).toMatch(/Mid-term/);
  });
  it("lab sections only for lab subjects, and required for them", () => {
    expect(validateComponents(labComps, LAB)).toBeNull();
    expect(validateComponents(labComps, THEORY)).toMatch(/no lab/);
    expect(validateComponents(theoryComps, LAB)).toMatch(/Lab exam/);
    expect(sectionsFor("theory")).toEqual(["internal", "mid", "end"]);
  });
  it("component names are required", () => {
    expect(validateComponents([{ name: " ", maxMarks: 20, section: "internal" }, ...theoryComps.slice(1)], THEORY)).toMatch(/name/);
  });
  it("marks must be within range", () => {
    expect(validateMark(21, 20)).toBeTruthy();
    expect(validateMark(-1, 20)).toBeTruthy();
    expect(validateMark(null, 20)).toBeNull();
    expect(validateMark(20, 20)).toBeNull();
  });
  it("final score: theory out of 100", () => {
    expect(finalScore(THEORY, { internal: 30, mid: 15, end: 30 })).toEqual({ theory: 75, theoryScaled: 75, lab: 0, total: 75 });
  });
  it("final score: lab theory scaled to 70, plus 30 lab marks", () => {
    expect(finalScore(LAB, { internal: 30, mid: 20, end: 30, lab_exam: 15, viva: 6, ce: 4 })).toEqual({ theory: 80, theoryScaled: 56, lab: 25, total: 81 });
  });
  it("final score ignores lab marks for theory and counts missing marks as 0", () => {
    expect(finalScore(THEORY, { internal: 10, lab_exam: 15 }).total).toBe(10);
    expect(finalScore(LAB, {}).total).toBe(0);
  });
  it("cannot submit with blanks", () => {
    expect(canSubmit([{ id: 1 }], [{ componentId: 1, marks: null }], 1)).toMatch(/1 marks/);
    expect(canSubmit([{ id: 1 }], [{ componentId: 1, marks: 3 }], 1)).toBeNull();
  });
});

describe("universityCsv", () => {
  it("writes one row per student with total and escapes names", () => {
    const csv = universityCsv("CS301", [{ id: 1, name: "Mid", section: "internal" }, { id: 2, name: "Quiz", section: "internal" }, { id: 3, name: "End", section: "end" }],
      [{ id: 9, rollNo: "ENG-24-CSE-0412", name: 'A, "B"' }],
      [{ componentId: 1, studentId: 9, marks: 18.5 }, { componentId: 2, studentId: 9, marks: 4 }, { componentId: 3, studentId: 9, marks: 30 }]);
    expect(csv).toBe('RollNo,Name,SubjectCode,Mid,Quiz,InternalTotal\nENG-24-CSE-0412,"A, ""B""",CS301,18.5,4,22.5\n');
  });
});
