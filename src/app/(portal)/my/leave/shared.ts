import type { Tone } from "@/components/page";

const DAY = 864e5;

/** Inclusive days between two YYYY-MM-DD dates. */
export const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;

export const shiftDate = (d: string, days: number) => new Date(Date.parse(d) + days * DAY).toISOString().slice(0, 10);

export const PENDING = ["pending_parent", "pending_mentor"] as const;

export function statusLabel(status: string, mentor: string | null) {
  switch (status) {
    case "pending_parent": return "Waiting for parent";
    case "pending_mentor": return mentor ? `Waiting for mentor ${mentor}` : "Waiting for mentor";
    case "approved": return "Approved";
    case "rejected": return "Rejected";
    default: return "Withdrawn";
  }
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "pending_parent":
    case "pending_mentor": return "late";
    case "approved": return "ok";
    case "rejected": return "absent";
    default: return "default";
  }
}
