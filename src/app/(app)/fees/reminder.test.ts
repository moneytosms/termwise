import { describe, expect, it } from "vitest";
import { isMinor, reminderBody } from "./reminder";

describe("isMinor", () => {
  it("is under 18 until the 18th birthday", () => {
    expect(isMinor("2008-11-04", "2026-11-03")).toBe(true);
    expect(isMinor("2008-11-03", "2026-11-03")).toBe(false);
  });
});

describe("reminderBody", () => {
  it("fills the template", () => {
    expect(reminderBody("Asha", "CS001", 150000)).toBe("Fee reminder for Asha (CS001): ₹1,500 is due. Please pay at the bank counter.");
  });
});
