import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const ok = async (page: Page, path: string, heading: string | RegExp) => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
};

test("student screens load and staff pages stay closed", async ({ page }) => {
  await signIn(page, "ankit.panda@termwise.demo");
  await expect(page).toHaveURL(/\/my$/);
  for (const [path, heading] of [
    ["/my", /Ankit/], ["/my/timetable", "Timetable"], ["/my/attendance", "Attendance"], ["/my/marks", "Internal marks"],
    ["/my/fees", "Fees"], ["/my/leave", "Leave"], ["/my/profile", "Profile"],
  ] as const) await ok(page, path, heading);
  await page.goto("/students");
  await expect(page).toHaveURL(/\/my$/);
  await page.goto("/my/messages"); // parent-only
  await expect(page).toHaveURL(/\/my$/);
});

test("parent switches child and sees each child's data", async ({ page }) => {
  await signIn(page, "sarat.panda@termwise.demo");
  await ok(page, "/my/messages", "Messages");
  await ok(page, "/my/profile", "Profile");
  await expect(page.getByText("ENG-24-ME-0177").first()).toBeVisible();
  await page.getByLabel("Child").filter({ visible: true }).selectOption({ label: "Riya Panda" });
  await expect(page.getByText("ENG-24-CSE-0012").first()).toBeVisible();
  await expect(page.getByText(/consent/i).first()).toBeVisible();
  await page.getByLabel("Child").filter({ visible: true }).selectOption({ label: "Ankit Panda" });
  await expect(page.getByText("ENG-24-ME-0177").first()).toBeVisible();
});

test("leave goes student → parent → mentor", async ({ browser }) => {
  const reason = `E2E family function ${Date.now()}`;
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const card = (page: Page) => page.locator("li").filter({ hasText: reason }).filter({ has: page.getByRole("button", { name: "Approve" }) });

  const student = await browser.newPage();
  await signIn(student, "ankit.panda@termwise.demo");
  await student.goto("/my/leave");
  await student.getByRole("button", { name: "Apply for leave" }).click();
  await student.getByRole("textbox", { name: "From" }).fill(day(10));
  await student.getByRole("textbox", { name: "To", exact: true }).fill(day(11));
  await student.getByLabel("Reason").fill(reason);
  await student.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(student.getByText(reason)).toBeVisible();

  const parent = await browser.newPage();
  await signIn(parent, "sarat.panda@termwise.demo");
  await parent.goto("/my/leave");
  await card(parent).getByRole("button", { name: "Approve" }).click();
  await expect(card(parent)).toHaveCount(0);

  const mentor = await browser.newPage();
  await signIn(mentor, "me.faculty@termwise.demo");
  await mentor.goto("/requests");
  await card(mentor).getByRole("button", { name: "Approve" }).click();
  await expect(card(mentor)).toHaveCount(0);

  await student.reload();
  await expect(student.locator("li").filter({ hasText: reason })).toContainText(/Approved/);
});
