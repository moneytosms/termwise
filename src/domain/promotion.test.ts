import { describe, expect, it } from "vitest";
import { nextTerm, promoteBlocker } from "./promotion";

describe("promoteBlocker", () => {
  it("lists the unlocked subjects", () => {
    expect(promoteBlocker([
      { code: "CS101", marksStatus: "locked" },
      { code: "CS102", marksStatus: "draft" },
      { code: "CS103", marksStatus: "submitted" },
    ])).toBe("Lock every subject first: CS102, CS103.");
  });
  it("allows promotion when every subject is locked", () => {
    expect(promoteBlocker([{ code: "CS101", marksStatus: "locked" }])).toBeNull();
  });
  it("allows promotion when there are no subjects", () => {
    expect(promoteBlocker([])).toBeNull();
  });
});

describe("nextTerm", () => {
  it("moves semester 3 of a 4-year course to semester 4, year 2", () => {
    expect(nextTerm({ year: 2, semester: 3 }, 4)).toEqual({ kind: "promote", year: 2, semester: 4 });
  });
  it("moves semester 1 to semester 2, still year 1", () => {
    expect(nextTerm({ year: 1, semester: 1 }, 4)).toEqual({ kind: "promote", year: 1, semester: 2 });
  });
  it("graduates after semester 8 of a 4-year course", () => {
    expect(nextTerm({ year: 4, semester: 8 }, 4)).toEqual({ kind: "graduate" });
  });
  it("graduates after semester 4 of a 2-year course", () => {
    expect(nextTerm({ year: 2, semester: 4 }, 2)).toEqual({ kind: "graduate" });
  });
});
