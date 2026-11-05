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

test("a batch with unlocked subjects cannot advance", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/setup?tab=batches");
  await page.getByPlaceholder("Search batches").fill("CSE-2024");
  await page.getByRole("row", { name: /CSE-2024/ }).filter({ visible: true }).getByRole("button", { name: "Advance", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toHaveText(/^Lock every subject first:/);
  await expect(dialog.getByRole("button", { name: "Advance batch", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a batch with every subject locked moves to its next semester", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/setup?tab=batches");
  await page.getByPlaceholder("Search batches").fill("ME-2023");
  const row = page.getByRole("row", { name: /ME-2023/ }).filter({ visible: true });
  await row.getByRole("button", { name: "Advance", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Move to Year 3, Semester 5\./)).toBeVisible();
  await dialog.getByRole("button", { name: "Advance batch", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row.getByRole("cell", { name: "5", exact: true })).toBeVisible();
});

test("a finished batch graduates and its students show as alumni", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/setup?tab=batches");
  await page.getByPlaceholder("Search batches").fill("CSE-2021");
  await page.getByRole("row", { name: /CSE-2021/ }).filter({ visible: true }).getByRole("button", { name: "Advance", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Graduate batch", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("ENG-21-CSE-0001");
  await page.getByRole("combobox", { name: "Alumni", exact: true }).click();
  await page.getByRole("option", { name: "Alumni", exact: true }).click();
  await expect(page.getByRole("row", { name: /ENG-21-CSE-0001/ }).filter({ visible: true })).toHaveCount(1);
});
