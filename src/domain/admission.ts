import { checklistComplete, checklistProgress, type DocState } from "./applicants";
import { isMinor } from "./templates";

/** Next roll number: the prefix of an existing roll plus the highest 4-digit suffix + 1; rolls without a 4-digit suffix are ignored. */
export function nextRollNo(existingRolls: string[], fallbackPrefix: string): string {
  let prefix: string | null = null;
  let max = 0;
  for (const roll of existingRolls) {
    if (!/\d{4}$/.test(roll)) continue;
    prefix ??= roll.slice(0, -4);
    max = Math.max(max, Number(roll.slice(-4)));
  }
  return (prefix ?? fallbackPrefix) + String(max + 1).padStart(4, "0");
}

/** Why this applicant can't be confirmed yet, or null when they can. */
export function confirmBlocker(
  a: { items: DocState[]; birthDate: string; parentConsentAt: Date | null; status: "applied" | "confirmed" | "rejected" },
  today: string,
): string | null {
  if (a.status !== "applied") return a.status === "confirmed" ? "Already confirmed." : "Already rejected.";
  if (!checklistComplete(a.items)) {
    const { verified, total } = checklistProgress(a.items);
    return total === 0 ? "No documents apply to this applicant" : `${verified} of ${total} documents verified`;
  }
  if (isMinor(a.birthDate, today) && !a.parentConsentAt) return "Record parent consent first (under 18)";
  return null;
}
