import type { Tone } from "@/components/page";
import { dayCount, type LeaveStatus } from "@/domain/staff-leave";

export const STATUS_LABEL: Record<LeaveStatus, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };
export const STATUS_TONE: Record<LeaveStatus, Tone> = { pending: "late", approved: "ok", rejected: "absent", withdrawn: "default" };

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });

/** "3 Mar" for one day, "3 Mar – 4 Mar" for a range. */
export const fmtRange = (from: string, to: string) => from === to ? day(from) : `${day(from)} – ${day(to)}`;

export const fmtDays = (from: string, to: string) => {
  const n = dayCount(from, to);
  return `${n} ${n === 1 ? "day" : "days"}`;
};
