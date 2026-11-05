import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("campus and role limits hold", async ({ page }) => {
  await signIn(page, "admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("MBA-25-0093");
  await expect(page.getByText("Nothing matches these filters.")).toBeVisible();
  await page.getByLabel("Search name or roll number").fill("ENG-24-ME-0177");
  await expect(page.getByRole("row", { name: /Ankit Panda/ })).toBeVisible();
});

test("faculty don't see fees", async ({ page }) => {
  await signIn(page, "faculty@termwise.demo");
  await page.goto("/students");
  await expect(page.getByRole("button", { name: "Fee due" })).toHaveCount(0);
  await page.goto("/fees");
  await page.waitForURL("**/home");
});

test("the brief's sample figures appear exactly", async ({ page }) => {
  await signIn(page, "admin@termwise.demo");
  await page.goto("/students");
  await page.getByLabel("Search name or roll number").fill("ENG-24-ME-0177");
  const row = page.getByRole("row", { name: /Ankit Panda/ });
  await expect(row).toContainText("68.2%");
  await expect(row).toContainText("21");
  await expect(row).toContainText("₹45,000");
});

test("office admin screens all load without errors", async ({ page }) => {
  await signIn(page, "admin@termwise.demo");
  for (const [path, heading] of [
    ["/home", "Today"], ["/students", "Students"], ["/attendance", "Attendance"], ["/attendance?tab=conflicts", "Attendance"], ["/marks", "Marks"], ["/fees", "Fees"], ["/risk", "Risk"],
    ["/messages", "Messages"], ["/assistant", "Assistant"], ["/setup", "College setup"], ["/setup?tab=timetable", "College setup"], ["/setup?tab=rules", "College setup"], ["/audit", "Audit log"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
  }
});

test("faculty screens all load without errors", async ({ page }) => {
  await signIn(page, "faculty@termwise.demo");
  for (const [path, heading] of [["/classes", "Classes"], ["/marks", "Marks"], ["/students", "Students"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
  }
});
