import { describe, expect, it } from "vitest";
import type { Scheme } from "./marks";
import { resultRows } from "./results";

const theory: Scheme = { kind: "theory", internalMax: 40, midMax: 20, endMax: 40, theoryScale: 70, labExamMax: 0, vivaMax: 0, ceMax: 0 };
const lab: Scheme = { kind: "lab", internalMax: 40, midMax: 20, endMax: 40, theoryScale: 70, labExamMax: 30, vivaMax: 10, ceMax: 10 };

describe("resultRows", () => {
  it("scales theory and adds lab sections for a lab subject; missing marks count 0", () => {
    const theoryComps = [{ id: 1, section: "internal" as const }, { id: 2, section: "mid" as const }, { id: 3, section: "end" as const }];
    const theoryMarks = [
      { studentId: 1, componentId: 1, marks: 30 }, { studentId: 1, componentId: 2, marks: 15 }, { studentId: 1, componentId: 3, marks: 30 },
      { studentId: 2, componentId: 1, marks: null }, { studentId: 2, componentId: 2, marks: 10 }, { studentId: 2, componentId: 3, marks: 20 },
    ];
    expect(resultRows(1, theory, theoryComps, theoryMarks, [1, 2])).toEqual([
      { subjectId: 1, studentId: 1, internal: 75, theoryScaled: 52.5, lab: 0, total: 52.5 },
      { subjectId: 1, studentId: 2, internal: 30, theoryScaled: 21, lab: 0, total: 21 },
    ]);

    const labComps = [
      ...theoryComps.map((c) => ({ ...c, id: c.id + 9 })),
      { id: 13, section: "lab_exam" as const }, { id: 14, section: "viva" as const }, { id: 15, section: "ce" as const },
    ];
    const labMarks = [
      { studentId: 3, componentId: 10, marks: 30 }, { studentId: 3, componentId: 11, marks: 15 }, { studentId: 3, componentId: 12, marks: 30 },
      { studentId: 3, componentId: 13, marks: 20 }, { studentId: 3, componentId: 14, marks: 8 }, { studentId: 3, componentId: 15, marks: 9 },
    ];
    expect(resultRows(2, lab, labComps, labMarks, [3])).toEqual([
      { subjectId: 2, studentId: 3, internal: 75, theoryScaled: 52.5, lab: 37, total: 89.5 },
    ]);
  });
});
