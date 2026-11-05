import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("confirm admission creates the student with a roll number", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@termwise.demo");
  await page.goto("/applicants");
  await page.getByRole("row", { name: /Ritika Nayak/ }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm admission" }).click();
  await expect(dialog.getByText(/Confirmed as ENG-24-CSE-/)).toBeVisible();

  await dialog.getByRole("link", { name: "Open student" }).click();
  await expect(page).toHaveURL(/\/students\?student=\d+/);
  await expect(page.getByRole("dialog").getByText(/ENG-24-CSE-\d{4}/).first()).toBeVisible();

  await page.goto("/students");
  await page.getByPlaceholder(/search/i).first().fill("Ritika Nayak");
  await expect(page.getByRole("row", { name: /Ritika Nayak/ })).toBeVisible();

  await page.goto("/applicants");
  await page.getByRole("row", { name: /Ritika Nayak/ }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Confirm admission" })).toHaveCount(0);
});

test("an incomplete checklist disables Confirm with the reason", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@termwise.demo");
  await page.goto("/applicants");
  await page.getByRole("row", { name: /Deepika Swain/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Confirm admission" })).toBeDisabled();
  await expect(dialog.getByText("1 of 5 documents verified")).toBeVisible();
});

test("applicant panel fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, "admin@termwise.demo");
  await page.goto("/applicants");
  await page.getByText("Deepika Swain").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
