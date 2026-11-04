import { beforeAll, expect, test } from "vitest";
import { parentToken, readParentToken } from "./parent-link";

beforeAll(() => { process.env.BETTER_AUTH_SECRET = "test-secret"; });

test("round trips the student id", () => {
  expect(readParentToken(parentToken(42))).toBe(42);
});

test("rejects a changed student id, a bad signature and garbage", () => {
  const [, exp, sig] = parentToken(42).split(".");
  expect(readParentToken(`43.${exp}.${sig}`)).toBeNull();
  expect(readParentToken(`42.${exp}.${sig}x`)).toBeNull();
  expect(readParentToken("nonsense")).toBeNull();
});

test("expires after 30 days", () => {
  const t = parentToken(42, 0);
  expect(readParentToken(t, 29 * 86_400_000)).toBe(42);
  expect(readParentToken(t, 31 * 86_400_000)).toBeNull();
});
