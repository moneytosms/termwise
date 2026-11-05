import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// CS302 is a submitted CSE subject (seed), and Subhashree Mohanty (ENG-24-CSE-0412) is in that CSE batch.
test("locking marks publishes final results to a student of the batch", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/marks?status=submitted");
  await page.getByRole("row", { name: /CS302/ }).click();
  await page.waitForURL(/\/marks\/\d+/);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

  const pupilContext = await browser.newContext();
  const pupil = await pupilContext.newPage();
  await signIn(pupil, "subhashree.mohanty@termwise.demo");
  await pupil.goto("/my/marks");
  const card = pupil.getByRole("listitem").filter({ hasText: "CS302" });
  await expect(card.getByText(/^\d+(\.\d+)? \/ 100$/)).toBeVisible();

  const res = await pupil.request.get("/api/results");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CS302" })]));
  await pupilContext.close();

  await page.getByRole("button", { name: "Reopen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("E2E results check done");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: "Lock", exact: true })).toBeVisible();
});
