import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("trust sign-in lands on the campus overview", async ({ page }) => {
  await signIn(page, "trust@termwise.demo");
  await expect(page.getByRole("heading", { level: 1, name: "Trust overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Engineering College/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Management School/ })).toBeVisible();
});

test("campus drill-down is a read-only view", async ({ page }) => {
  await signIn(page, "trust@termwise.demo");
  await page.getByRole("link", { name: /Engineering College/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Engineering College" })).toBeVisible();
  await expect(page.getByText("Read-only view", { exact: true })).toBeVisible();
});

test("unknown campus ids are not found", async ({ page }) => {
  await signIn(page, "trust@termwise.demo");
  const res = await page.goto("/trust/campus/999999");
  expect(res?.status()).toBe(404);
});

test("admin visiting /trust is sent home", async ({ page }) => {
  await signIn(page, "admin@termwise.demo");
  await page.goto("/trust");
  await page.waitForURL("**/home");
});

test("faculty visiting /trust is sent home", async ({ page }) => {
  await signIn(page, "faculty@termwise.demo");
  await page.goto("/trust");
  await page.waitForURL("**/home");
});
