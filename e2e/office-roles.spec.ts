import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Per office role: one screen it owns loads, one it doesn't redirects to /home.
const CASES = [
  { role: "admissions", email: "eng.admissions@termwise.demo", allowed: "/applicants", refused: "/fees" },
  { role: "exams", email: "eng.exams@termwise.demo", allowed: "/marks", refused: "/applicants" },
  { role: "accounts", email: "mgt.accounts@termwise.demo", allowed: "/fees", refused: "/marks" },
  { role: "hr", email: "phr.hr@termwise.demo", allowed: "/leave", refused: "/fees" },
];

for (const c of CASES) {
  test(`${c.role}: own screen loads, others go home`, async ({ page }) => {
    await signIn(page, c.email);
    await page.goto(c.allowed);
    await expect(page).toHaveURL(new RegExp(`${c.allowed}$`));
    await page.goto(c.refused);
    await page.waitForURL("**/home");
  });
}

test("exams cannot download the Tally export", async ({ page }) => {
  await signIn(page, "eng.exams@termwise.demo");
  const res = await page.request.get("/fees/tally");
  expect(res.status()).toBe(403);
});

test("accounts cannot download the marks report", async ({ page }) => {
  await signIn(page, "eng.accounts@termwise.demo");
  const res = await page.request.get("/reports/marks/export");
  expect(res.status()).toBe(403);
});
