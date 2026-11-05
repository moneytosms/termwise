import type { AttendanceStatus } from "./attendance";

export type AppealKind = "mark" | "attendance";
export type AppealStatus = "open" | "accepted" | "rejected";
export type AppealAction = "accept" | "reject";

export const APPEAL_LABEL: Record<AppealStatus, string> = { open: "Appeal open", accepted: "Accepted", rejected: "Rejected" };

/** Students only, one open appeal per item. Attendance is appealable only when absent or late; `status` is that attendance status. */
export function canAppeal(a: { role: "student" | "parent"; existingOpen: boolean; kind: AppealKind; status?: AttendanceStatus }): boolean {
  if (a.role !== "student" || a.existingOpen) return false;
  return a.kind === "mark" || a.status === "absent" || a.status === "late";
}

/** Null when the reason is fine, else a message. Counted on trimmed text. */
export function validateReason(reason: string): string | null {
  const n = reason.trim().length;
  if (n < 10) return "Give a reason of at least 10 characters.";
  if (n > 500) return "Reason must be 500 characters or fewer.";
  return null;
}

/** Only an open appeal can be decided, and a rejection must say why. Decisions are final. */
export function decide(
  status: AppealStatus, action: AppealAction, response?: string,
): { ok: true; to: "accepted" | "rejected" } | { ok: false; error: string } {
  if (status !== "open") return { ok: false, error: "This appeal is already decided." };
  if (action === "reject" && !response?.trim()) return { ok: false, error: "Give a reason for rejecting." };
  return { ok: true, to: action === "accept" ? "accepted" : "rejected" };
}
