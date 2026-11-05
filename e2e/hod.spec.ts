import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const year = 2100 + (Math.floor(Date.now() / 60_000) % 700);
const reason = `E2E HoD leave ${year}`;

test("a CSE head of department sees only CSE students, and another department's student refuses", async ({ browser }) => {
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await signIn(admin, "eng.admin@termwise.demo");
  await admin.goto("/students");
  await admin.getByText("ENG-24-ME-0177").filter({ visible: true }).first().click();
  await admin.waitForURL(/student=\d+/);
  const meStudent = new URL(admin.url()).searchParams.get("student");
  await adminCtx.close();

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const hod = await ctx.newPage();
  await signIn(hod, "cse.hod@termwise.demo");
  await hod.goto("/students");
  await expect(hod.getByText("in your department").filter({ visible: true }).first()).toBeVisible();
  await expect(hod.getByText("ENG-24-CSE-0412").filter({ visible: true }).first()).toBeVisible();
  await expect(hod.getByText("ENG-24-ME-0177")).toHaveCount(0);

  await hod.goto(`/students?student=${meStudent}`);
  await expect(hod.getByText("This student isn't available to you.")).toBeVisible();

  await hod.goto("/marks");
  await expect(hod.getByText("View only.").filter({ visible: true }).first()).toBeVisible();
  await hod.goto("/fees");
  await hod.waitForURL("**/home");
  await ctx.close();
});

test("a faculty leave request reaches the CSE head, not Mechanical's, and the decision is audited", async ({ browser }) => {
  const facultyCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const faculty = await facultyCtx.newPage();
  await signIn(faculty, "cse.faculty@termwise.demo");
  await faculty.goto("/leave");
  await faculty.getByLabel("From", { exact: true }).fill(`${year}-05-04`);
  await faculty.getByLabel("To", { exact: true }).fill(`${year}-05-05`);
  await faculty.getByLabel("Reason", { exact: true }).fill(reason);
  await faculty.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(faculty.getByText("Leave applied. The office will decide.")).toBeVisible();
  await facultyCtx.close();

  const meCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const me = await meCtx.newPage();
  await signIn(me, "me.hod@termwise.demo");
  await me.goto("/leave");
  await expect(me.getByRole("heading", { name: "Leave", exact: true })).toBeVisible();
  await expect(me.getByText(reason)).toHaveCount(0);
  await meCtx.close();

  const hodCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const hod = await hodCtx.newPage();
  await signIn(hod, "cse.hod@termwise.demo");
  await hod.goto("/leave");
  const request = hod.locator("li").filter({ hasText: reason });
  await request.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(hod.getByText("Leave approved.")).toBeVisible();
  await hodCtx.close();

  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await signIn(admin, "eng.admin@termwise.demo");
  await admin.goto("/audit");
  await expect(admin.getByText("Dr. Soumya Ranjan Panigrahi").filter({ visible: true }).first()).toBeVisible();
  await adminCtx.close();
});
