import { StatusPill, type Tone } from "@/components/page";
import type { AttendanceStatus } from "@/domain/attendance";

export const KIND_LABEL: Record<"different_teacher" | "late_edit", string> = {
  different_teacher: "Different teacher",
  late_edit: "Edited after the day",
};

export const CONFLICT_STATUS: Record<"open" | "kept" | "replaced", { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "late" },
  kept: { label: "Kept", tone: "default" },
  replaced: { label: "Replaced", tone: "ok" },
};

const STATUS: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  present: { label: "Present", tone: "ok" },
  absent: { label: "Absent", tone: "absent" },
  late: { label: "Late", tone: "late" },
};

export function StatusWord({ status }: { status: AttendanceStatus | null }) {
  return status ? <StatusPill tone={STATUS[status].tone}>{STATUS[status].label}</StatusPill> : <StatusPill>Not marked</StatusPill>;
}
