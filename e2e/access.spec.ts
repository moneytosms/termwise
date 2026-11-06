import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("campus and role limits hold", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("MBA-25-0093");
  await expect(page.getByText("Nothing matches these filters.")).toBeVisible();
  await page.getByLabel("Search name or roll number").fill("ENG-24-ME-0177");
  await expect(page.getByRole("row", { name: /Ankit Panda/ })).toBeVisible();
});

test("faculty don't see fees", async ({ page }) => {
  await signIn(page, "cse.faculty@termwise.demo");
  await page.goto("/students");
  await expect(page.getByRole("button", { name: "Fee due" })).toHaveCount(0);
  await page.goto("/fees");
  await page.waitForURL("**/home");
});

test("the brief's sample figures appear exactly", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("ENG-24-ME-0177");
  const row = page.getByRole("row", { name: /Ankit Panda/ });
  await expect(row).toContainText("68.2%");
  await expect(row).toContainText("21");
  await expect(row).toContainText("₹45,000");
});

test("the CSE sample figures appear exactly", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("ENG-24-CSE-0412");
  const row = page.getByRole("row", { name: /Subhashree Mohanty/ });
  await expect(row).toContainText("81.5%");
  await expect(row).toContainText("33");
  await expect(row).not.toContainText(/₹\s*[1-9]/); // ₹0 due: no amount on phone, "₹0" on desktop
});

test("the MBA sample figures appear exactly", async ({ page }) => {
  await signIn(page, "mgt.admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("MBA-25-0093");
  const row = page.getByRole("row", { name: /Farheen Ali/ });
  await expect(row).toContainText("92.0%");
  await expect(row).toContainText("36");
  await expect(row).not.toContainText(/₹\s*[1-9]/); // ₹0 due: no amount on phone, "₹0" on desktop
});

test("office admin screens all load without errors", async ({ page }) => {
  await signIn(page, "eng.admin@termwise.demo");
  for (const [path, heading] of [
    ["/home", "Today"], ["/students", "Students"], ["/attendance", "Attendance"], ["/attendance?tab=conflicts", "Attendance"], ["/marks", "Marks"], ["/fees", "Fees"], ["/risk", "Risk"],
    ["/messages", "Messages"], ["/assistant", "Termy"], ["/setup", "College setup"], ["/setup?tab=timetable", "College setup"], ["/setup?tab=rules", "College setup"], ["/audit", "Audit log"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
  }
});

test("faculty screens all load without errors", async ({ page }) => {
  await signIn(page, "cse.faculty@termwise.demo");
  for (const [path, heading] of [["/classes", "Classes"], ["/marks", "Marks"], ["/students", "Students"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
  }
});

test("sign-in picker fills a persona and lands on its home", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("combobox", { name: "Demo login", exact: true }).fill("trust");
  await page.getByRole("option", { name: /Bijay Mishra/ }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("trust@termwise.demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/trust$/);
});
