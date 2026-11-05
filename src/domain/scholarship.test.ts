import { describe, expect, it } from "vitest";
import { awardAmount, eligibilityError, semesterInstalments, spread, totalDue, unspread } from "./scholarship";

const inst = (id: number, dueDate: string, amountPaise: number, scholarshipPaise = 0, paidPaise = 0) =>
  ({ id, dueDate, amountPaise, scholarshipPaise, paidPaise, semester: 1 });

describe("awardAmount", () => {
  it("takes a percent of the semester total, rounded to the paise", () => {
    expect(awardAmount({ kind: "percent", value: 50 }, 4500000)).toBe(2250000);
    expect(awardAmount({ kind: "percent", value: 25 }, 1000001)).toBe(250000);
    expect(awardAmount({ kind: "percent", value: 33 }, 100)).toBe(33);
  });

  it("uses a fixed amount, capped at the semester total", () => {
    expect(awardAmount({ kind: "fixed", value: 1000000 }, 4500000)).toBe(1000000);
    expect(awardAmount({ kind: "fixed", value: 1000000 }, 600000)).toBe(600000);
  });
});

describe("eligibilityError", () => {
  it("allows any category when the scheme lists none", () => {
    expect(eligibilityError({ active: true, categories: [] }, "general")).toBeNull();
  });

  it("refuses a General student for an SC/ST-only scheme, naming the labels", () => {
    expect(eligibilityError({ active: true, categories: ["sc", "st"] }, "general")).toBe("This scheme is limited to SC, ST.");
    expect(eligibilityError({ active: true, categories: ["sc", "st"] }, "sc")).toBeNull();
  });

  it("refuses an inactive scheme", () => {
    expect(eligibilityError({ active: false, categories: [] }, "sc")).toBe("This scheme is no longer active.");
  });
});

describe("semesterInstalments", () => {
  it("counts null-semester instalments as the batch's current semester", () => {
    const list = [{ ...inst(1, "2026-07-01", 100), semester: null }, { ...inst(2, "2026-12-01", 100), semester: 2 }, { ...inst(3, "2026-01-01", 100), semester: 1 }];
    expect(semesterInstalments(list, 1, 1).map((i) => i.id)).toEqual([1, 3]);
    expect(semesterInstalments(list, 2, 1).map((i) => i.id)).toEqual([2]);
  });
});

describe("spread", () => {
  it("fills earliest due first, each up to what's left on it", () => {
    const list = [inst(1, "2026-12-01", 1000), inst(2, "2026-07-01", 1000)];
    expect(spread(list, 1500)).toEqual([{ id: 2, addPaise: 1000 }, { id: 1, addPaise: 500 }]);
  });

  it("respects an existing scholarship on an instalment", () => {
    const list = [inst(1, "2026-07-01", 1000, 800), inst(2, "2026-12-01", 1000)];
    expect(spread(list, 900)).toEqual([{ id: 1, addPaise: 200 }, { id: 2, addPaise: 700 }]);
  });

  it("gives less than the amount when there is no room", () => {
    const list = [inst(1, "2026-07-01", 1000, 1000)];
    expect(spread(list, 500)).toEqual([]);
  });
});

describe("unspread", () => {
  it("removes from the latest due first, never below zero", () => {
    const list = [inst(1, "2026-07-01", 1000, 600), inst(2, "2026-12-01", 1000, 400)];
    expect(unspread(list, 500)).toEqual([{ id: 2, subPaise: 400 }, { id: 1, subPaise: 100 }]);
  });

  it("undoes a spread exactly", () => {
    const list = [inst(1, "2026-07-01", 1000), inst(2, "2026-12-01", 1000)];
    const added = spread(list, 1500);
    const after = list.map((i) => ({ ...i, scholarshipPaise: i.scholarshipPaise + (added.find((a) => a.id === i.id)?.addPaise ?? 0) }));
    const removed = unspread(after, 1500);
    expect(removed.reduce((s, r) => s + r.subPaise, 0)).toBe(1500);
    expect(after.every((i) => i.scholarshipPaise - (removed.find((r) => r.id === i.id)?.subPaise ?? 0) === 0)).toBe(true);
  });
});

describe("totalDue", () => {
  it("is the amount left after scholarships and payments", () => {
    expect(totalDue([inst(1, "2026-07-01", 1000, 300, 200), inst(2, "2026-12-01", 1000, 1000, 0)])).toBe(500);
  });
});
