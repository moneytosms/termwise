import { describe, expect, it } from "vitest";
import { semesterFee } from "./fee-structure";

describe("semesterFee", () => {
  const rows = [{ category: "sc", semesterFeePaise: 2_500_000 }, { category: "st", semesterFeePaise: 1_000_000 }];

  it("uses the structure row for the applicant's category", () => {
    expect(semesterFee(5_000_000, rows, "sc")).toBe(2_500_000);
    expect(semesterFee(5_000_000, rows, "st")).toBe(1_000_000);
  });

  it("uses the programme default when the category has no row", () => {
    expect(semesterFee(5_000_000, rows, "general")).toBe(5_000_000);
    expect(semesterFee(5_000_000, rows, "ews")).toBe(5_000_000);
  });

  it("uses the programme default when there are no rows", () => {
    expect(semesterFee(5_000_000, [], "sc")).toBe(5_000_000);
  });
});
