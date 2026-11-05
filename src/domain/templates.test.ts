import { describe, expect, it } from "vitest";
import { feeMessage, guardianLanguages, previews } from "./templates";

describe("guardianLanguages", () => {
  it("keeps each language once", () => {
    expect(guardianLanguages(["or", "or", "en"])).toEqual(["or", "en"]);
  });
  it("falls back to English when there is no guardian", () => {
    expect(guardianLanguages([])).toEqual(["en"]);
  });
});

describe("previews", () => {
  it("gives English and Odia for each template", () => {
    expect(previews().map((p) => p.kind)).toEqual(["shortage", "fee_reminder"]);
    expect(previews()[1].en).toBe("Fee reminder: ₹15,000 is due for Asha Das. Pay at the bank counter or with the link below.");
    expect(previews()[1].or).toBe(feeMessage("or", "Asha Das", "₹15,000"));
  });
});
