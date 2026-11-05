import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

const nav = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).filter({ visible: true });

test("dual-role person is faculty on ENG and office admin on PHR", async ({ page }) => {
  await signIn(page, "dual.role@termwise.demo");
  await expect(page.getByLabel("Campus", { exact: true }).filter({ visible: true })).toHaveValue(/\d+/);
  await expect(nav(page, "Classes")).toHaveCount(1);
  await expect(nav(page, "Fees")).toHaveCount(0);
  await page.goto("/fees");
  await page.waitForURL("**/home");

  await page.getByLabel("Campus", { exact: true }).filter({ visible: true }).selectOption({ label: "Pharmacy College" });
  await page.waitForURL("**/home");
  await expect(nav(page, "Fees")).toHaveCount(1);
  await expect(nav(page, "Classes")).toHaveCount(0);
  await page.goto("/fees");
  await expect(page).toHaveURL(/\/fees$/);
});

test("visiting faculty sees each campus's own classes", async ({ page }) => {
  await signIn(page, "visiting.faculty@termwise.demo");
  await page.goto("/classes");
  await expect(page.getByText("Thermodynamics").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Financial Accounting")).toHaveCount(0);

  await page.getByLabel("Campus", { exact: true }).filter({ visible: true }).selectOption({ label: "Management School" });
  await page.waitForURL("**/home");
  await page.goto("/classes");
  await expect(page.getByText("Financial Accounting").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Thermodynamics")).toHaveCount(0);
});

test("a single-campus login has no switcher", async ({ page }) => {
  await signIn(page, "cse.faculty@termwise.demo");
  await expect(page.getByLabel("Campus", { exact: true })).toHaveCount(0);
});
