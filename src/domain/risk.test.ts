import { describe, expect, it } from "vitest";
import { evaluateRisk, type RiskInput } from "./risk";

const rules = { dropPoints: 10, marksPercent: 50, minSessions: 10 };
const ok: RiskInput = {
  subjectPercents: [{ subject: "DBMS", percent: 90, cutoff: 75 }],
  overallNow: 90, overallFourWeeksAgo: 92, sessionsHeld: 20, marksObtained: 30, marksPossible: 40,
};

describe("evaluateRisk", () => {
  it("clear when nothing trips", () => expect(evaluateRisk(ok, rules)).toEqual({ status: "clear" }));
  it("not enough data below min sessions or with no components", () => {
    expect(evaluateRisk({ ...ok, sessionsHeld: 9 }, rules).status).toBe("not_enough_data");
    expect(evaluateRisk({ ...ok, marksPossible: 0 }, rules).status).toBe("not_enough_data");
  });
  it("flags shortage in any one subject", () => {
    const r = evaluateRisk({ ...ok, subjectPercents: [{ subject: "OS", percent: 68.2, cutoff: 75 }] }, rules);
    expect(r).toMatchObject({ status: "flagged", codes: ["attendance_shortage"] });
  });
  it("flags a fall of exactly the threshold", () => {
    expect(evaluateRisk({ ...ok, overallFourWeeksAgo: 100 }, rules)).toMatchObject({ codes: ["attendance_drop"] });
    expect(evaluateRisk({ ...ok, overallFourWeeksAgo: 99.9 }, rules).status).toBe("clear");
  });
  it("flags marks below half of those entered, and exactly half is fine", () => {
    expect(evaluateRisk({ ...ok, marksObtained: 19 }, rules)).toMatchObject({ codes: ["low_marks"] });
    expect(evaluateRisk({ ...ok, marksObtained: 20 }, rules).status).toBe("clear");
  });
  it("collects all reasons", () => {
    const r = evaluateRisk({ ...ok, marksObtained: 5, overallNow: 70, subjectPercents: [{ subject: "OS", percent: 70, cutoff: 75 }] }, rules);
    expect(r).toMatchObject({ codes: ["attendance_shortage", "attendance_drop", "low_marks"] });
  });
});
