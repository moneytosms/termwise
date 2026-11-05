import { describe, expect, it } from "vitest";
import { aging, countShort, feesToDate, shortageByGroup, weeklyTrend } from "./queries";

const TODAY = "2026-11-05";

describe("weeklyTrend", () => {
  it("buckets days into 8 weeks ending today, oldest first, and leaves empty weeks null", () => {
    const t = weeklyTrend([
      { date: "2026-11-05", programmeId: 1, held: 10, attended: 8 },
      { date: "2026-10-30", programmeId: 2, held: 10, attended: 10 },
      { date: "2026-10-29", programmeId: 1, held: 10, attended: 5 },
    ], TODAY, null);
    expect(t).toHaveLength(8);
    expect(t[7]).toEqual({ weekStart: "2026-10-30", pct: 90 });
    expect(t[6].pct).toBe(50);
    expect(t[0].pct).toBeNull();
  });

  it("filters to one programme", () => {
    const t = weeklyTrend([
      { date: "2026-11-05", programmeId: 1, held: 10, attended: 8 },
      { date: "2026-11-04", programmeId: 2, held: 10, attended: 2 },
    ], TODAY, 1);
    expect(t[7].pct).toBe(80);
  });

  it("drops days older than eight weeks", () => {
    const t = weeklyTrend([{ date: "2026-09-01", programmeId: 1, held: 10, attended: 0 }], TODAY, null);
    expect(t.every((w) => w.pct === null)).toBe(true);
  });
});

describe("shortageByGroup", () => {
  it("counts students under their own line per subject and sorts worst share first", () => {
    const rows = [
      { subjectId: 1, subject: "Maths", batch: "B1", cutoff: 75, held: 10, attended: 7 },
      { subjectId: 1, subject: "Maths", batch: "B1", cutoff: 75, held: 10, attended: 9 },
      { subjectId: 2, subject: "Physics", batch: "B1", cutoff: 75, held: 10, attended: 10 },
      { subjectId: 2, subject: "Physics", batch: "B1", cutoff: 75, held: 0, attended: 0 },
    ];
    expect(shortageByGroup(rows)).toEqual([
      { key: 1, label: "Maths · B1", students: 2, short: 1, share: 50 },
      { key: 2, label: "Physics · B1", students: 1, short: 0, share: 0 },
    ]);
  });
});

describe("countShort", () => {
  it("skips students with nothing held", () => {
    expect(countShort([
      { held: 10, attended: 7, cutoff: 75 },
      { held: 0, attended: 0, cutoff: 75 },
      { held: 4, attended: 4, cutoff: 75 },
    ])).toBe(1);
  });
});

describe("aging", () => {
  const i = (dueDate: string, amountPaise = 100) => ({ id: 1, dueDate, amountPaise, scholarshipPaise: 0, paidPaise: 0 });
  it("buckets by days past due and leaves due-today out", () => {
    const b = aging([i("2026-11-05"), i("2026-11-04"), i("2026-10-06"), i("2026-10-05"), i("2026-09-05")], TODAY);
    expect(b.map((x) => x.count)).toEqual([2, 1, 1]);
    expect(b[0].paise).toBe(200);
  });
  it("puts day 30 in 1-30, day 31 in 31-60, day 61 in 60+", () => {
    expect(aging([i("2026-10-06")], TODAY)[0].count).toBe(1);
    expect(aging([i("2026-10-05")], TODAY)[1].count).toBe(1);
    expect(aging([i("2026-09-05")], TODAY)[2].count).toBe(1);
  });
});

describe("feesToDate", () => {
  it("bills only instalments due so far, net of scholarship, and collects what was paid against them", () => {
    expect(feesToDate([
      { id: 1, dueDate: "2026-11-01", amountPaise: 1000, scholarshipPaise: 200, paidPaise: 300 },
      { id: 2, dueDate: "2026-12-01", amountPaise: 1000, scholarshipPaise: 0, paidPaise: 500 },
    ], TODAY)).toEqual({ billedPaise: 800, collectedPaise: 300 });
  });
});
