import { describe, expect, it } from "vitest";
import { markSheetHash, matches, type MarkSheetFields } from "./marksheet";

const base: MarkSheetFields = {
  studentId: 177, rollNo: "ENG-24-ME-0177", semester: 3,
  subjects: [{ code: "ME301", internal: 30, total: 52.5 }, { code: "ME302", internal: 25, total: 60 }],
};

describe("markSheetHash", () => {
  it("is deterministic and 64 hex chars", () => {
    expect(markSheetHash(base)).toBe(markSheetHash({ ...base }));
    expect(markSheetHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when a total changes", () => {
    const subjects = [{ code: "ME301", internal: 30, total: 52.6 }, base.subjects[1]];
    expect(markSheetHash({ ...base, subjects })).not.toBe(markSheetHash(base));
  });
  it("does not depend on subject order", () => {
    expect(markSheetHash({ ...base, subjects: [...base.subjects].reverse() })).toBe(markSheetHash(base));
  });
});

describe("matches", () => {
  it("is true only for equal strings", () => {
    expect(matches("abc", "abc")).toBe(true);
    expect(matches("abc", "abd")).toBe(false);
    expect(matches("abc", "abcd")).toBe(false);
  });
});
