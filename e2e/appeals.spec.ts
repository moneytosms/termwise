import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test("student appeals a mark, the faculty accepts a corrected value, the student sees it", async ({ browser }) => {
  const reason = `Re-check requested ${Date.now()}`;
  const subject = (page: Page) => page.locator("li").filter({ hasText: "Strength of Materials" }).first();

  const student = await browser.newPage();
  await signIn(student, "ankit.panda@termwise.demo");
  await student.goto("/my/marks");
  // Lab-section components only: internal marks feed figures other specs check. Components with an open appeal show no Appeal button.
  const card = subject(student);
  const appealButton = card.locator("dl > div").filter({ hasText: /Lab exam|Viva|Continuous evaluation/ })
    .getByRole("button", { name: /^Appeal / }).first();
  const component = (await appealButton.getAttribute("aria-label"))!.split(", ").pop()!;
  const row = card.locator("dl > div").filter({ hasText: component });
  const [, current, max] = (await row.locator("dd").textContent())!.match(/([\d.]+) \/ (\d+)/)!;
  const newValue = Number(current) === 0 ? 1 : 0;

  await row.getByRole("button", { name: /^Appeal / }).click();
  const dialog = student.getByRole("dialog");
  await dialog.getByLabel("Reason").fill(reason);
  await dialog.getByRole("button", { name: "Send appeal" }).click();
  await expect(row.getByText("Appeal open")).toBeVisible();
  await expect(student.locator("li").filter({ hasText: reason })).toContainText("Appeal open");

  const faculty = await browser.newPage();
  await signIn(faculty, "me.faculty@termwise.demo");
  await faculty.goto("/requests");
  const appealCard = faculty.locator("li").filter({ hasText: reason }).filter({ has: faculty.getByRole("button", { name: "Accept" }) });
  await appealCard.getByLabel("Corrected marks").fill(String(newValue));
  await appealCard.getByRole("button", { name: "Accept" }).click();
  await expect(appealCard).toHaveCount(0);

  await student.reload();
  await expect(row.locator("dd")).toHaveText(new RegExp(`^${newValue} / ${max}(?!\\d)`));
  await expect(student.locator("li").filter({ hasText: reason }).getByText("Accepted", { exact: true })).toBeVisible();
});
