import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// A per-run year far in the future, so repeated runs never share casual balance.
const year = 2100 + (Math.floor(Date.now() / 60_000) % 700);
const reason = `E2E leave ${year}`;
const note = `E2E approved ${year}`;

test("faculty applies, office approves with a note, faculty sees it approved", async ({ browser }) => {
  const facultyCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const faculty = await facultyCtx.newPage();
  await signIn(faculty, "faculty2@termwise.demo");
  await faculty.goto("/leave");
  await faculty.getByLabel("From", { exact: true }).fill(`${year}-03-02`);
  await faculty.getByLabel("To", { exact: true }).fill(`${year}-03-03`);
  await faculty.getByLabel("Reason").fill(reason);
  await faculty.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(faculty.getByText("Leave applied. The office will decide.")).toBeVisible();
  await expect(faculty.getByText("Pending").filter({ visible: true }).first()).toBeVisible();
  await facultyCtx.close();

  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await signIn(admin, "admin@termwise.demo");
  await admin.goto("/leave");
  const request = admin.locator("li").filter({ hasText: reason });
  await request.getByLabel("Note to staff (required to reject)").fill(note);
  await request.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(admin.getByText("Leave approved.")).toBeVisible();
  await adminCtx.close();

  const again = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await again.newPage();
  await signIn(page, "faculty2@termwise.demo");
  await page.goto("/leave");
  await expect(page.getByText("Approved").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(note).filter({ visible: true }).first()).toBeVisible();
  await again.close();
});

test("faculty sees casual, medical and on-duty balances", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "faculty@termwise.demo");
  await page.goto("/leave");
  await expect(page.getByText("Casual").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Medical").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("On duty").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/left of 12/).first()).toBeVisible();
});

for (const email of ["faculty@termwise.demo", "admin@termwise.demo"]) {
  test(`leave page has no horizontal scroll at 375x800 for ${email}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, email);
    await page.goto("/leave");
    await expect(page.getByRole("heading", { name: "Leave" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
}
