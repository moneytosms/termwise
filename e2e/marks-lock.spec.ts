import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("office admin locks marks, the lock blocks edits, reopen needs a reason, all audited", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/marks?status=submitted");
  await page.getByRole("row", { name: /CS302/ }).click();
  await page.waitForURL(/\/marks\/\d+/);
  const subjectUrl = page.url();

  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  await expect(page.locator('input[type="number"]')).toHaveCount(0);

  const csv = await page.request.get(subjectUrl + "/export");
  expect(csv.status()).toBe(200);
  expect((await csv.text()).split("\n")[0]).toContain("RollNo,Name,SubjectCode");

  await page.getByRole("button", { name: "Reopen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Moderator correction");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: "Lock", exact: true })).toBeVisible();

  await page.goto("/audit");
  await page.getByLabel("Search").fill("marks.reopen");
  await expect(page.getByRole("cell", { name: "Moderator correction" }).first()).toBeVisible();
});
