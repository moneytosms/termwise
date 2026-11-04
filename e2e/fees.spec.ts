import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const ROLL = "ENG-24-ME-0177";
const NAME = "Ankit Panda";
const money = (s: string) => Number(s.replace(/\D/g, ""));

async function openFees(page: import("@playwright/test").Page) {
  await page.goto("/fees");
  await page.getByLabel("Search name or roll number").fill(ROLL);
  return page.getByRole("row", { name: new RegExp(ROLL) });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@termwise.demo");
});

test("office admin records a payment and the due drops, then sends a reminder that lands on messages", async ({ page }) => {
  const row = await openFees(page);
  const dueBefore = money(await row.getByRole("cell", { name: /^₹/ }).first().innerText());
  expect(dueBefore).toBeGreaterThan(100);

  await page.getByRole("cell", { name: NAME }).click();
  await expect(page).toHaveURL(/\/fees\?student=\d+/);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: NAME })).toBeVisible();

  const ref = `E2E-FEE-${Date.now()}`;
  await dialog.getByLabel("Amount (₹)").first().fill("100");
  await dialog.getByLabel("Bank reference").first().fill(ref);
  await dialog.getByRole("button", { name: "Record payment" }).first().click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
  await expect(dialog.getByText(ref)).toBeVisible();

  const rowAfter = await openFees(page);
  expect(money(await rowAfter.getByRole("cell", { name: /^₹/ }).first().innerText())).toBe(dueBefore - 100);

  await rowAfter.getByRole("checkbox", { name: "Select row" }).click();
  await page.getByRole("button", { name: "Send reminder" }).click();
  await expect(page.getByText(/reminders logged/)).toBeVisible();

  await page.goto("/messages");
  await page.getByLabel("Search name or roll number").fill(ROLL);
  await expect(page.getByRole("row", { name: new RegExp(`${ROLL}.*Fee reminder`) }).first()).toBeVisible();
});

test("a payment of zero or over the due is refused with a visible error", async ({ page }) => {
  await openFees(page);
  await page.getByRole("cell", { name: NAME }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: NAME })).toBeVisible();

  // Native min/max would block submit before the server check; bypass it to reach the server rule.
  const submit = dialog.getByRole("button", { name: "Record payment" }).first();
  await submit.evaluate((b) => { (b as HTMLButtonElement).form!.noValidate = true; });

  await dialog.getByLabel("Amount (₹)").first().fill("0");
  await dialog.getByLabel("Bank reference").first().fill("E2E-ZERO");
  await submit.click();
  await expect(page.getByText("Enter an amount above zero.")).toBeVisible();

  await dialog.getByLabel("Amount (₹)").first().fill("9999999");
  await submit.click();
  await expect(page.getByText("That's more than is due on this instalment.")).toBeVisible();
});
