import { describe, expect, it } from "vitest";
import { attendancePercent, currentOrNext, facultyCanEdit, isShortage, istDate, nextStatus } from "./attendance";

describe("attendancePercent", () => {
  it("counts late as present and weights labs by periods", () => {
    expect(attendancePercent([
      { status: "present", periods: 1 }, { status: "late", periods: 1 },
      { status: "absent", periods: 3 }, { status: "present", periods: 3 },
    ])).toBe(62.5);
  });
  it("is null when no periods were held", () => expect(attendancePercent([])).toBeNull());
});

describe("isShortage", () => {
  it("is strictly below the cutoff", () => {
    expect(isShortage(74.9, 75)).toBe(true);
    expect(isShortage(75, 75)).toBe(false);
    expect(isShortage(null, 75)).toBe(false);
  });
});

describe("IST day boundary", () => {
  it("rolls over at 18:30 UTC", () => {
    expect(istDate(new Date("2026-11-03T18:29:00Z"))).toBe("2026-11-03");
    expect(istDate(new Date("2026-11-03T18:30:00Z"))).toBe("2026-11-04");
  });
  it("closes the faculty edit window after the session date", () => {
    expect(facultyCanEdit("2026-11-03", new Date("2026-11-03T18:29:00Z"))).toBe(true);
    expect(facultyCanEdit("2026-11-03", new Date("2026-11-03T18:30:00Z"))).toBe(false);
  });
});

describe("currentOrNext", () => {
  const a = { startTime: "09:00", endTime: "09:50" }, b = { startTime: "11:00", endTime: "11:50" };
  it("finds running, next, or nothing", () => {
    expect(currentOrNext([b, a], "09:10")).toEqual({ cls: a, running: true });
    expect(currentOrNext([b, a], "09:50")).toEqual({ cls: b, running: false });
    expect(currentOrNext([a, b], "12:00")).toBeNull();
  });
  it("cycles status", () => expect(nextStatus(nextStatus(nextStatus("present")))).toBe("present"));
});
