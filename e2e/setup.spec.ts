import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const minSessions = (page: Page) => page.getByLabel(/^Minimum sessions before flagging/);

async function saveRules(page: Page, value: number) {
  await page.goto("/setup?tab=rules");
  await minSessions(page).fill(String(value));
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByText("Applies on the next daily run.")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
});

test("rules: minimum sessions persists across reload and is restored", async ({ page }) => {
  await page.goto("/setup?tab=rules");
  const original = Number(await minSessions(page).inputValue());
  const changed = original === 7 ? 8 : 7;
  try {
    await saveRules(page, changed);
    await page.reload();
    await expect(minSessions(page)).toHaveValue(String(changed));
  } finally {
    await saveRules(page, original);
  }
  await page.reload();
  await expect(minSessions(page)).toHaveValue(String(original));
});

// Seed fills every cell, so no free cell exists. Monday period 1 (09:00-09:50) is edited to
// overlap period 2 (09:50-10:40); the save is rejected, so nothing changes.
test("timetable: a slot overlapping the next period is rejected", async ({ page }) => {
  await page.goto("/setup?tab=timetable");
  await page.getByRole("button", { name: /^Monday, period 1: / }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Start", { exact: true }).fill("09:30");
  await dialog.getByLabel("End", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Overlaps the slot at period 2 on this day.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("calendar: holiday is added and deleted", async ({ page }) => {
  const label = `E2E holiday ${Date.now()}`;
  const date = `2099-06-${String(10 + (Date.now() % 15)).padStart(2, "0")}`;
  await page.goto("/setup?tab=calendar");
  await page.getByRole("button", { name: "Add day" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date", { exact: true }).fill(date);
  await dialog.getByLabel("Label", { exact: true }).fill(label);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();

  const row = page.getByRole("row", { name: new RegExp(label) });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
});
