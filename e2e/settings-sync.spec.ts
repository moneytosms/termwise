import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("settings follow the account to a fresh device", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "cse.faculty2@termwise.demo");
  const open = async (p: typeof page) => { await p.getByRole("button", { name: "Settings" }).first().click(); return p.getByRole("dialog"); };

  await (await open(page)).getByRole("radio", { name: "Compact" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.waitForTimeout(1500); // debounced save

  const other = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await signIn(other, "cse.faculty2@termwise.demo");
  await expect(other.locator("html")).toHaveAttribute("data-density", "compact");

  await (await open(other)).getByRole("radio", { name: "Comfortable" }).click();
  await other.waitForTimeout(1500);
  await other.close();
});
