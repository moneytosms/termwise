import { describe, expect, it } from "vitest";
import { attendancePct, compare, type CampusFigures } from "./trust";

const c = (o: Partial<CampusFigures>): CampusFigures => ({
  campusId: 1, name: "A", students: 10, held: 100, attended: 80, shortage: 2, duesPaise: 1000_00, flags: 1, ...o,
});

describe("attendancePct", () => {
  it("is one decimal and null without sessions", () => {
    expect(attendancePct(3, 2)).toBe(66.7);
    expect(attendancePct(0, 0)).toBeNull();
  });
});

describe("compare", () => {
  it("sums totals and weights attendance by sessions", () => {
    const r = compare([c({ campusId: 1, held: 100, attended: 80 }), c({ campusId: 2, held: 300, attended: 150, shortage: 5, duesPaise: 500_00, flags: 0 })]);
    expect(r.totals).toEqual({ students: 20, attendance: 57.5, shortage: 7, duesPaise: 1500_00, flags: 1 });
  });
  it("ranks higher attendance as best and lower shortage, dues and flags as best", () => {
    const r = compare([
      c({ campusId: 1, held: 100, attended: 90, shortage: 1, duesPaise: 100_00, flags: 3 }),
      c({ campusId: 2, held: 100, attended: 60, shortage: 4, duesPaise: 900_00, flags: 0 }),
    ]);
    expect(r.best).toEqual({ attendance: 1, shortage: 1, duesPaise: 1, flags: 2 });
    expect(r.worst).toEqual({ attendance: 2, shortage: 2, duesPaise: 2, flags: 1 });
  });
  it("does not rank when campuses tie or there is one campus", () => {
    const tie = compare([c({ campusId: 1 }), c({ campusId: 2 })]);
    expect(tie.best.shortage).toBeNull();
    expect(tie.worst.attendance).toBeNull();
    const one = compare([c({ campusId: 1 })]);
    expect(one.best.flags).toBeNull();
  });
  it("ignores campuses with no sessions for attendance ranking", () => {
    const r = compare([c({ campusId: 1, held: 0, attended: 0 }), c({ campusId: 2, held: 50, attended: 40 }), c({ campusId: 3, held: 50, attended: 30 })]);
    expect(r.best.attendance).toBe(2);
    expect(r.worst.attendance).toBe(3);
  });
});
