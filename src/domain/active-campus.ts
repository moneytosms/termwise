export const CAMPUS_COOKIE = "termwise_campus";

/**
 * The staff row to act as. Picks the row on the cookie's campus; a missing, stale or forged
 * value falls back to the lowest-id row. Never returns a row the user doesn't have.
 */
export function resolveActiveRow<R extends { id: number; campusId: number }>(rows: R[], cookie: string | undefined | null): R | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  const wanted = cookie && /^\d+$/.test(cookie) ? Number(cookie) : null;
  return (wanted !== null && sorted.find((r) => r.campusId === wanted)) || sorted[0];
}
