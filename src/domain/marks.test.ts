import { describe, expect, it } from "vitest";
import { canEditMarks, canSubmit, transition, universityCsv, validateComponents, validateMark } from "./marks";

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
  it("components must total 40", () => {
    expect(validateComponents([{ name: "Mid", maxMarks: 20 }, { name: "A", maxMarks: 20 }])).toBeNull();
    expect(validateComponents([{ name: "Mid", maxMarks: 20 }])).toMatch(/20/);
  });
  it("marks must be within range", () => {
    expect(validateMark(21, 20)).toBeTruthy();
    expect(validateMark(-1, 20)).toBeTruthy();
    expect(validateMark(null, 20)).toBeNull();
    expect(validateMark(20, 20)).toBeNull();
  });
  it("cannot submit with blanks", () => {
    expect(canSubmit([{ id: 1 }], [{ componentId: 1, marks: null }], 1)).toMatch(/1 marks/);
    expect(canSubmit([{ id: 1 }], [{ componentId: 1, marks: 3 }], 1)).toBeNull();
  });
});

describe("universityCsv", () => {
  it("writes one row per student with total and escapes names", () => {
    const csv = universityCsv("CS301", [{ id: 1, name: "Mid" }, { id: 2, name: "Quiz" }],
      [{ id: 9, rollNo: "ENG-24-CSE-0412", name: 'A, "B"' }],
      [{ componentId: 1, studentId: 9, marks: 18.5 }, { componentId: 2, studentId: 9, marks: 4 }]);
    expect(csv).toBe('RollNo,Name,SubjectCode,Mid,Quiz,InternalTotal\nENG-24-CSE-0412,"A, ""B""",CS301,18.5,4,22.5\n');
  });
});
