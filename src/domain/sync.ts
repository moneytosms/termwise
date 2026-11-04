import { facultyCanEdit, type AttendanceStatus } from "./attendance";

/** One queued attendance submission; `editedAt` is the device's clock. */
export type OutboxItem = {
  sessionId: string;
  batchId: number;
  subjectId: number;
  date: string;
  period: number;
  periodCount: number;
  entries: { studentId: number; status: AttendanceStatus }[];
  editedAt: string;
  markedBy: number; // staff id of the teacher who marked it
};

export type SyncOutcome = "saved" | "stale" | "conflict";
export type SyncDecision =
  | { action: "insert" | "update" }
  | { action: "ignore" }
  | { action: "conflict"; kind: "different_teacher" | "late_edit" };

/** Corrects the device clock using the gap between its clock and the server's at send time, capped at now. */
export function correctedEditedAt(editedAt: string, clientNow: string, serverNow: Date): Date {
  const skew = serverNow.getTime() - new Date(clientNow).getTime();
  return new Date(Math.min(new Date(editedAt).getTime() + skew, serverNow.getTime()));
}

/**
 * Same teacher: newest edit wins; replays and older edits are ignored.
 * Different teacher: first synced stands, second is queued for an office admin.
 * Edits made after the session date go to the queue too, but entries made in time
 * and only synced later are accepted.
 */
export function decideSync(
  existing: { facultyId: number; editedAt: Date } | null,
  incoming: { facultyId: number; date: string; editedAt: Date },
): SyncDecision {
  if (!facultyCanEdit(incoming.date, incoming.editedAt)) return { action: "conflict", kind: "late_edit" };
  if (!existing) return { action: "insert" };
  if (existing.facultyId !== incoming.facultyId) return { action: "conflict", kind: "different_teacher" };
  return incoming.editedAt > existing.editedAt ? { action: "update" } : { action: "ignore" };
}
