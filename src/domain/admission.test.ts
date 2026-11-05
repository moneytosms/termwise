import { describe, expect, it } from "vitest";
import { confirmBlocker, nextRollNo } from "./admission";

describe("nextRollNo", () => {
  it("continues after the highest suffix", () => {
    expect(nextRollNo(["ENG-24-CSE-0001", "ENG-24-CSE-0119", "ENG-24-CSE-0412"], "X-")).toBe("ENG-24-CSE-0413");
  });
  it("starts at 0001 with the fallback prefix for an empty batch", () => {
    expect(nextRollNo([], "ENG-26-CSE-")).toBe("ENG-26-CSE-0001");
  });
  it("handles MBA style", () => {
    expect(nextRollNo(["MBA-25-0001", "MBA-25-0093"], "X-")).toBe("MBA-25-0094");
  });
  it("ignores rolls without a 4-digit suffix", () => {
    expect(nextRollNo(["LEGACY-12", "ENG-24-ME-0009", "ABC"], "X-")).toBe("ENG-24-ME-0010");
    expect(nextRollNo(["LEGACY-12"], "ENG-26-ME-")).toBe("ENG-26-ME-0001");
  });
});

describe("confirmBlocker", () => {
  const done = [{ name: "A", status: "verified" as const }, { name: "B", status: "verified" as const }];
  const base = { items: done, birthDate: "2006-01-01", parentConsentAt: null, status: "applied" as const };
  const today = "2026-11-06";
  it("blocks an incomplete checklist", () => {
    expect(confirmBlocker({ ...base, items: [done[0], { name: "B", status: "received" }] }, today)).toBe("1 of 2 documents verified");
  });
  it("blocks a minor without consent", () => {
    expect(confirmBlocker({ ...base, birthDate: "2010-01-01" }, today)).toBe("Record parent consent first (under 18)");
  });
  it("allows a minor with consent", () => {
    expect(confirmBlocker({ ...base, birthDate: "2010-01-01", parentConsentAt: new Date() }, today)).toBeNull();
  });
  it("allows an adult", () => {
    expect(confirmBlocker(base, today)).toBeNull();
  });
  it("blocks an already confirmed applicant", () => {
    expect(confirmBlocker({ ...base, status: "confirmed" }, today)).not.toBeNull();
  });
});
