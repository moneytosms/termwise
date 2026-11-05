import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ viewport: { width: 1280, height: 900 } });

test("seeded alumni appear in the students list with their graduation", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("ENG-20-CSE-0001");
  await expect(page.getByRole("row", { name: /Asha Nayak/ }).filter({ visible: true })).toBeVisible();
});

test("the batch Advance dialog offers graduation for the final semester", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/setup?tab=batches");
  await page.getByPlaceholder("Search batches").fill("CSE-2021");
  await page.getByRole("row", { name: /CSE-2021/ }).filter({ visible: true }).getByRole("button", { name: "Advance", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Advance CSE-2021", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Graduate batch", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
