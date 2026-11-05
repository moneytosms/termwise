import { describe, expect, it } from "vitest";
import { asOfDate, feeRows, lastDay, marksRows, previousMonth, shortageRows, strengthRows, toCsv, REPORTS } from "./reports";
import type { Scheme } from "./marks";

const scheme: Scheme = { kind: "theory", internalMax: 40, midMax: 20, endMax: 40, theoryScale: 100, labExamMax: 15, vivaMax: 10, ceMax: 5 };

describe("strengthRows", () => {
  it("counts students per programme, year and batch", () => {
    expect(strengthRows([
      { programme: "CSE", year: 2, batch: "CSE-24" }, { programme: "CSE", year: 2, batch: "CSE-24" },
      { programme: "ME", year: 1, batch: "ME-25" },
    ])).toEqual([
      { programme: "CSE", year: 2, batch: "CSE-24", students: 2 },
      { programme: "ME", year: 1, batch: "ME-25", students: 1 },
    ]);
  });
});

describe("shortageRows", () => {
  it("keeps only subject rows below the programme cutoff and computes the percent", () => {
    const out = shortageRows([
      { roll: "A1", name: "Asha", programme: "CSE", cutoff: 75, subject: "Maths", held: 20, attended: 14 },
      { roll: "A1", name: "Asha", programme: "CSE", cutoff: 75, subject: "Physics", held: 20, attended: 16 },
      { roll: "A2", name: "Ravi", programme: "CSE", cutoff: 75, subject: "Maths", held: 0, attended: 0 },
    ]);
    expect(out).toEqual([
      { roll: "A1", name: "Asha", programme: "CSE", subject: "Maths", held: 20, attended: 14, percent: 70 },
    ]);
  });
});

describe("marksRows", () => {
  const complete = { complete: true, marks: { internal: 30, mid: 15, end: 30 } };
  it("averages and ranges final scores over students with all marks only", () => {
    const [row] = marksRows([{
      code: "CS101", name: "Maths", status: "locked", scheme,
      students: [complete, { complete: true, marks: { internal: 20, mid: 10, end: 20 } }, { complete: false, marks: { internal: 40 } }],
    }]);
    expect(row).toEqual({
      code: "CS101", subject: "Maths", status: "locked", students: 3,
      averageInternal: 25, averageFinal: 62.5, minFinal: 50, maxFinal: 75,
    });
  });
  it("leaves averages blank when no student is complete", () => {
    const [row] = marksRows([{ code: "CS102", name: "Physics", status: "draft", scheme, students: [{ complete: false, marks: {} }] }]);
    expect(row).toMatchObject({ students: 1, averageInternal: null, averageFinal: null, minFinal: null, maxFinal: null });
  });
});

describe("feeRows", () => {
  it("counts only instalments due by the as-of date and payments made to date", () => {
    const i = (o: Partial<{ dueDate: string; amountPaise: number; scholarshipPaise: number; paidPaise: number }>) => ({
      id: 1, dueDate: "2026-10-01", amountPaise: 100_00, scholarshipPaise: 0, paidPaise: 0, ...o,
    });
    expect(feeRows([
      { programme: "CSE", instalments: [i({ paidPaise: 40_00 }), i({ dueDate: "2026-11-15" })] },
      { programme: "CSE", instalments: [] },
    ], "2026-10-31")).toEqual([
      { programme: "CSE", students: 2, billed: 100, collected: 40, due: 60, overdue: 60 },
    ]);
  });
  it("counts instalments past due as overdue", () => {
    const [row] = feeRows([{ programme: "ME", instalments: [{ id: 1, dueDate: "2026-09-01", amountPaise: 50_00, scholarshipPaise: 10_00, paidPaise: 0 }] }], "2026-10-31");
    expect(row).toMatchObject({ billed: 40, due: 40, overdue: 40 });
  });
});

describe("as-of and month helpers", () => {
  it("uses the last day of a past month and today for the current month", () => {
    expect(lastDay("2026-02")).toBe("2026-02-28");
    expect(asOfDate("2026-10", "2026-11-06")).toBe("2026-10-31");
    expect(asOfDate("2026-11", "2026-11-06")).toBe("2026-11-06");
  });
  it("finds the previous month across a year boundary", () => {
    expect(previousMonth("2026-01-03")).toBe("2025-12");
    expect(previousMonth("2026-11-06")).toBe("2026-10");
  });
});

describe("toCsv", () => {
  const columns = [{ key: "name", label: "Name" }, { key: "note", label: "Note" }, { key: "n", label: "N" }];
  it("writes a header row and escapes commas, quotes and newlines", () => {
    expect(toCsv(columns, [
      { name: "Asha, K", note: 'says "hi"', n: 3 },
      { name: "Ravi", note: "line1\nline2", n: null },
    ])).toBe('Name,Note,N\n"Asha, K","says ""hi""",3\nRavi,"line1\nline2",\n');
  });
  it("is header only when there are no rows", () => {
    expect(toCsv(columns, [])).toBe("Name,Note,N\n");
  });
  it("gives every report a column for each row key", () => {
    for (const r of REPORTS) expect(new Set(r.columns.map((c) => c.key)).size).toBe(r.columns.length);
  });
});
