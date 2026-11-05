import { describe, expect, it } from "vitest";
import { applyError, dayCount, overlaps, remaining, shiftDays, used, type Span } from "./staff-leave";

const leave = (kind: Span["kind"], fromDate: string, toDate: string, status: Span["status"] = "approved"): Span => ({ kind, fromDate, toDate, status });

describe("dayCount", () => {
  it("counts a single day as 1", () => {
    expect(dayCount("2026-03-02", "2026-03-02")).toBe(1);
  });
  it("counts both ends across a month", () => {
    expect(dayCount("2026-01-30", "2026-02-02")).toBe(4);
  });
});

describe("shiftDays", () => {
  it("moves across month and year ends", () => {
    expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("overlaps", () => {
  it("counts touching edges as overlap", () => {
    expect(overlaps({ fromDate: "2026-03-01", toDate: "2026-03-03" }, { fromDate: "2026-03-03", toDate: "2026-03-05" })).toBe(true);
  });
  it("does not count disjoint ranges", () => {
    expect(overlaps({ fromDate: "2026-03-01", toDate: "2026-03-02" }, { fromDate: "2026-03-03", toDate: "2026-03-05" })).toBe(false);
  });
});

describe("remaining", () => {
  it("counts pending and approved days of the kind in the year", () => {
    const leaves = [leave("casual", "2026-03-01", "2026-03-03"), leave("casual", "2026-05-01", "2026-05-02", "pending")];
    expect(remaining("casual", "2026", leaves)).toBe(7);
    expect(used("casual", "2026", leaves)).toBe(5);
  });
  it("ignores rejected and withdrawn leave", () => {
    const leaves = [leave("medical", "2026-03-01", "2026-03-04", "rejected"), leave("medical", "2026-05-01", "2026-05-02", "withdrawn")];
    expect(remaining("medical", "2026", leaves)).toBe(10);
  });
  it("ignores other years", () => {
    expect(remaining("casual", "2027", [leave("casual", "2026-03-01", "2026-03-10")])).toBe(12);
  });
  it("has no limit for on duty", () => {
    expect(remaining("on_duty", "2026", [leave("on_duty", "2026-03-01", "2026-03-30")])).toBeNull();
  });
});

describe("applyError", () => {
  it("accepts leave within the balance", () => {
    expect(applyError({ kind: "casual", fromDate: "2026-03-02", toDate: "2026-03-03" }, [])).toBeNull();
  });
  it("rejects casual leave beyond the balance", () => {
    const leaves = [leave("casual", "2026-01-05", "2026-01-14")];
    expect(applyError({ kind: "casual", fromDate: "2026-03-02", toDate: "2026-03-04" }, leaves)).toBe("Only 2 days of casual leave left this year.");
  });
  it("allows on duty beyond any count", () => {
    const leaves = [leave("on_duty", "2026-01-05", "2026-02-14")];
    expect(applyError({ kind: "on_duty", fromDate: "2026-03-02", toDate: "2026-06-04" }, leaves)).toBeNull();
  });
  it("does not count withdrawn or rejected leave against the balance", () => {
    const leaves = [leave("casual", "2026-01-05", "2026-01-16", "withdrawn"), leave("casual", "2026-02-01", "2026-02-10", "rejected")];
    expect(applyError({ kind: "casual", fromDate: "2026-03-02", toDate: "2026-03-13" }, leaves)).toBeNull();
  });
  it("rejects overlap with pending or approved leave, of any kind", () => {
    const leaves = [leave("medical", "2026-03-03", "2026-03-04", "pending")];
    expect(applyError({ kind: "casual", fromDate: "2026-03-04", toDate: "2026-03-05" }, leaves)).toBe("Overlaps leave already on record for these dates.");
  });
  it("ignores overlap with rejected leave", () => {
    const leaves = [leave("casual", "2026-03-03", "2026-03-04", "rejected")];
    expect(applyError({ kind: "casual", fromDate: "2026-03-03", toDate: "2026-03-04" }, leaves)).toBeNull();
  });
  it("rejects a range that ends before it starts", () => {
    expect(applyError({ kind: "casual", fromDate: "2026-03-05", toDate: "2026-03-04" }, [])).toBe("The leave ends before it starts.");
  });
  it("rejects leave spanning two years", () => {
    expect(applyError({ kind: "on_duty", fromDate: "2026-12-30", toDate: "2027-01-02" }, [])).toBe("Split leave at the year end.");
  });
});
