import { createHmac, timingSafeEqual } from "node:crypto";

const DAY = 86_400_000;
const key = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return `parent-link:${s}`;
};
const sign = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

/** A link a parent opens without an account. It shows one student's attendance and dues, read-only, for 30 days. */
export function parentToken(studentId: number, now = Date.now()) {
  const body = `${studentId}.${Math.floor((now + 30 * DAY) / 1000)}`;
  return `${body}.${sign(body)}`;
}

/** Student id for a valid, unexpired token; null otherwise. */
export function readParentToken(token: string, now = Date.now()): number | null {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || !/^\d+$/.test(id) || !/^\d+$/.test(exp)) return null;
  const want = Buffer.from(sign(`${id}.${exp}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return Number(exp) * 1000 > now ? Number(id) : null;
}

export const parentUrl = (studentId: number) => `${process.env.BETTER_AUTH_URL ?? ""}/p/${parentToken(studentId)}`;
