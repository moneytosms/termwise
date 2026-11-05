import { createHmac, timingSafeEqual } from "node:crypto";

export type MarkSheetFields = {
  studentId: number; rollNo: string; semester: number; subjects: { code: string; internal: number; total: number }[];
};

/** HMAC-SHA256 over the student and their locked subjects; `h` on the verify link. Full 64-char hex. */
export function markSheetHash(f: MarkSheetFields): string {
  const subjects = [...f.subjects]
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .map((s) => `${s.code}:${s.internal.toFixed(2)}:${s.total.toFixed(2)}`);
  const canonical = [f.studentId, f.rollNo, f.semester, ...subjects].join("|");
  const key = process.env.BETTER_AUTH_SECRET || "termwise-dev";
  return createHmac("sha256", key).update(canonical).digest("hex");
}

export function matches(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
