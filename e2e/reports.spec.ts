import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
});

test("office admin opens reports from the nav and switches the report", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: "Reports" }).first().click();
  await expect(page).toHaveURL(/\/reports/);
  const picker = page.getByRole("form", { name: "Report picker" });
  await picker.getByLabel("Report").selectOption("fees");
  await picker.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/report=fees/);
  await expect(page.getByRole("columnheader", { name: "Overdue (INR)" })).toBeVisible();
});

test("export downloads a CSV with the report's header row", async ({ page }) => {
  await page.goto("/reports?report=strength&month=2026-10");
  const link = page.getByRole("link", { name: "Export CSV" });
  await expect(link).toHaveAttribute("href", /\/reports\/strength\/export\?month=2026-10/);
  const res = await page.request.get("/reports/strength/export?month=2026-10");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toContain("strength-2026-10.csv");
  expect((await res.text()).split("\n")[0]).toBe("Programme,Year,Batch,Category,Gender,Students");
});

test("AICTE SFR shows its norm note and exports the matching header", async ({ page }) => {
  await page.goto("/reports?report=aicte_sfr");
  await expect(page.getByText("Students not yet alumni per faculty member", { exact: false }).filter({ visible: true })).toBeVisible();
  const res = await page.request.get("/reports/aicte_sfr/export");
  expect(res.status()).toBe(200);
  expect((await res.text()).split("\n")[0]).toBe("Programme,Students,Faculty,Ratio,Norm,Status");
});

test("NAAC 2.4.1 shows its [A] note and the department rows", async ({ page }) => {
  await page.goto("/reports?report=naac_2_4_1");
  await expect(page.getByText("Full-time teachers (faculty and HODs) / sanctioned posts", { exact: false }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Computer Science", exact: true })).toBeVisible();
});

test("an unknown report or a bad month is refused", async ({ page }) => {
  expect((await page.request.get("/reports/nope/export")).status()).toBe(404);
  expect((await page.request.get("/reports/fees/export?month=2026-13")).status()).toBe(400);
});
