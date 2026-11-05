export type AttendanceStatus = "present" | "absent" | "late";

/** Today's date in IST as YYYY-MM-DD; the college works in one timezone. */
export function istDate(at: Date = new Date()): string {
  return new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Late counts as present. A lab row counts as its number of periods. Null when nothing was held. */
export function attendancePercent(rows: { status: AttendanceStatus; periods: number }[]): number | null {
  const held = rows.reduce((n, r) => n + r.periods, 0);
  if (held === 0) return null;
  const attended = rows.reduce((n, r) => n + (r.status === "absent" ? 0 : r.periods), 0);
  return Math.round((attended / held) * 1000) / 10;
}

export function isShortage(percent: number | null, cutoff: number): boolean {
  return percent !== null && percent < cutoff;
}

/** Smallest n ≥ 0 with (attended + n) / (held + n) ≥ line (fraction). Infinity when line ≥ 1 and not already full. */
export function classesToReach(attended: number, held: number, line: number): number {
  if (attended >= line * held) return 0;
  if (line >= 1) return Infinity;
  return Math.ceil((line * held - attended) / (1 - line));
}

/** Faculty may edit until the end of the session's date, IST. */
export function facultyCanEdit(sessionDate: string, now: Date = new Date()): boolean {
  return sessionDate >= istDate(now);
}

/** The class running now, else the next one today, else null. Times are "HH:MM" IST. */
export function currentOrNext<T extends { startTime: string; endTime: string }>(classes: T[], hhmm: string): { cls: T; running: boolean } | null {
  const sorted = [...classes].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const running = sorted.find((c) => c.startTime <= hhmm && hhmm < c.endTime);
  if (running) return { cls: running, running: true };
  const next = sorted.find((c) => c.startTime > hhmm);
  return next ? { cls: next, running: false } : null;
}

export const istTime = (at: Date = new Date()) => new Date(at.getTime() + 330 * 60_000).toISOString().slice(11, 16);
export const istDayOfWeek = (at: Date = new Date()) => new Date(at.getTime() + 330 * 60_000).getUTCDay();

/** Tap cycles Present, Absent, Late. */
export const nextStatus = (s: AttendanceStatus): AttendanceStatus => (s === "present" ? "absent" : s === "absent" ? "late" : "present");
