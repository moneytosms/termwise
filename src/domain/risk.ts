export type RiskRules = { dropPoints: number; marksPercent: number; minSessions: number };
export type RiskInput = {
  subjectPercents: { subject: string; percent: number | null; cutoff: number }[];
  /** Overall percent now and 4 weeks ago; null when there's no earlier data. */
  overallNow: number | null;
  overallFourWeeksAgo: number | null;
  sessionsHeld: number;
  marksObtained: number;
  marksPossible: number; // over components entered so far
};
export type RiskResult =
  | { status: "not_enough_data" }
  | { status: "clear" }
  | { status: "flagged"; codes: string[]; reason: string };

/** The rule decides. The LLM may only reword `reason`, which stays the fallback when it fails. */
export function evaluateRisk(s: RiskInput, r: RiskRules): RiskResult {
  if (s.sessionsHeld < r.minSessions || s.marksPossible === 0) return { status: "not_enough_data" };
  const codes: string[] = [], parts: string[] = [];
  const short = s.subjectPercents.filter((x) => x.percent !== null && x.percent < x.cutoff);
  if (short.length) {
    codes.push("attendance_shortage");
    parts.push(`Attendance below cutoff in ${short.map((x) => `${x.subject} (${x.percent}%)`).join(", ")}`);
  }
  if (s.overallNow !== null && s.overallFourWeeksAgo !== null && s.overallFourWeeksAgo - s.overallNow >= r.dropPoints) {
    codes.push("attendance_drop");
    parts.push(`Attendance fell ${(s.overallFourWeeksAgo - s.overallNow).toFixed(1)} points in 4 weeks`);
  }
  const marksPct = (s.marksObtained / s.marksPossible) * 100;
  if (marksPct < r.marksPercent) {
    codes.push("low_marks");
    parts.push(`Marks at ${marksPct.toFixed(0)}% of components entered`);
  }
  return codes.length ? { status: "flagged", codes, reason: parts.join(". ") + "." } : { status: "clear" };
}
