import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const ROLL = "ENG-24-CSE-0001"; // Amrita Jena; guardian Pallavi Jena reads Odia (set by seedLanguage)
const ODIA_PHRASE = "ଦୟାକରି ବ୍ୟାଙ୍କ କାଉଣ୍ଟରରେ"; // fixed text from feeMessage("or", ...)

test("admin sends a fee reminder; the Odia guardian's message is logged in Odia and visible to the guardian", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/messages");
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
  await expect(page.getByText("Odia text needs native-speaker review.")).toBeVisible();
  await expect(page.getByText(/ଶୁଳ୍କ ସ୍ମାରକ/).first()).toBeVisible();

  await page.goto("/fees");
  await page.getByLabel("Search name or roll number").fill(ROLL);
  const row = page.getByRole("row", { name: new RegExp(ROLL) });
  await row.getByRole("checkbox", { name: "Select row" }).click();
  await page.getByRole("button", { name: "Send reminder" }).click();
  await expect(page.getByText(/reminders logged/)).toBeVisible();

  await page.goto("/messages");
  await page.getByLabel("Search name or roll number").fill(ROLL);
  const odiaRow = page.getByRole("row").filter({ hasText: ROLL }).filter({ hasText: "Odia" }).first();
  await expect(odiaRow).toBeVisible();

  const guardian = await browser.newContext();
  const guardianPage = await guardian.newPage();
  await guardianPage.setViewportSize({ width: 1280, height: 900 });
  await signIn(guardianPage, "pallavi.jena@termwise.demo");
  await expect(guardianPage).toHaveURL(/\/my$/);
  await guardianPage.goto("/my/messages");
  await expect(guardianPage.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  await expect(guardianPage.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
  await expect(guardianPage.getByText(new RegExp(ODIA_PHRASE)).first()).toBeVisible();
  await guardian.close();
});
