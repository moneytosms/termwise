import { describe, expect, it } from "vitest";
import { isMinor } from "./reminder";

describe("isMinor", () => {
  it("is under 18 until the 18th birthday", () => {
    expect(isMinor("2008-11-04", "2026-11-03")).toBe(true);
    expect(isMinor("2008-11-03", "2026-11-03")).toBe(false);
  });
});
