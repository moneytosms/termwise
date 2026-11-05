export type LeaveKind = "casual" | "medical" | "on_duty";
export type LeaveStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** Days per calendar year. null is no limit. */
export const BALANCE: Record<LeaveKind, number | null> = { casual: 12, medical: 10, on_duty: null };
export const KIND_LABEL: Record<LeaveKind, string> = { casual: "Casual", medical: "Medical", on_duty: "On duty" };

export type Span = { kind: LeaveKind; fromDate: string; toDate: string; status: LeaveStatus };

const DAY = 864e5;

export const shiftDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

/** Inclusive calendar days between two YYYY-MM-DD dates. */
export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
}

/** Closed ranges: ranges that touch on an edge overlap. */
export function overlaps(a: { fromDate: string; toDate: string }, b: { fromDate: string; toDate: string }): boolean {
  return a.fromDate <= b.toDate && b.fromDate <= a.toDate;
}

export const yearOf = (iso: string) => iso.slice(0, 4);

/** Days of this kind counted against the year: pending and approved leave starting in it. */
export function used(kind: LeaveKind, year: string, leaves: Span[]): number {
  return leaves
    .filter((l) => l.kind === kind && (l.status === "pending" || l.status === "approved") && yearOf(l.fromDate) === year)
    .reduce((n, l) => n + dayCount(l.fromDate, l.toDate), 0);
}

/** Days left this year for the kind, or null when the kind has no limit. */
export function remaining(kind: LeaveKind, year: string, leaves: Span[]): number | null {
  const cap = BALANCE[kind];
  return cap === null ? null : cap - used(kind, year, leaves);
}

/** Why this leave cannot be applied (or approved) against the person's other leave, or null when it can. */
export function applyError(req: { kind: LeaveKind; fromDate: string; toDate: string }, leaves: Span[]): string | null {
  if (req.fromDate > req.toDate) return "The leave ends before it starts.";
  if (yearOf(req.fromDate) !== yearOf(req.toDate)) return "Split leave at the year end.";
  const open = leaves.filter((l) => l.status === "pending" || l.status === "approved");
  if (open.some((l) => overlaps(l, req))) return "Overlaps leave already on record for these dates.";
  const left = remaining(req.kind, yearOf(req.fromDate), open);
  const days = dayCount(req.fromDate, req.toDate);
  if (left !== null && days > left) return `Only ${left} ${left === 1 ? "day" : "days"} of ${KIND_LABEL[req.kind].toLowerCase()} leave left this year.`;
  return null;
}
