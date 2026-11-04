import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("office admin runs the at-risk check, opens a flag, and the assistant reports no AI provider", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@termwise.demo");

  await page.goto("/risk");
  await expect(page.getByRole("heading", { level: 1, name: "Risk" })).toBeVisible();
  const ankit = page.getByRole("row", { name: /Ankit Panda/ });
  await expect(ankit).toBeVisible();
  await expect(ankit).toContainText(/Attendance below cutoff in .+\(\d+(\.\d+)?%\)/);
  await expect(page.getByRole("row", { name: /Subhashree Mohanty/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Run now" }).click();
  await expect(page.getByText(/Flagged \d+, cleared \d+/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Ankit Panda/ })).toBeVisible();

  await page.getByRole("row", { name: /Ankit Panda/ }).click();
  await page.waitForURL(/\/students\?student=\d+/);
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("At risk", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Attendance below cutoff in/)).toBeVisible();
  await expect(panel.getByText(/^Mentor: /)).toBeVisible();

  await page.goto("/assistant");
  await expect(page.getByRole("heading", { level: 1, name: "Assistant" })).toBeVisible();
  await page.getByLabel("Question").fill("how many second-year students are below 75% this month");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "no AI provider configured" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
});

test("faculty visiting the admin-only assistant and risk pages land on home", async ({ page }) => {
  await signIn(page, "faculty@termwise.demo");
  for (const path of ["/assistant", "/risk"]) {
    await page.goto(path);
    await page.waitForURL("**/home");
  }
});
