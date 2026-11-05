import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("student sees a term mark sheet whose verify link confirms it and rejects tampering", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "ankit.panda@termwise.demo");
  await page.goto("/my/marks/sheet");
  await expect(page.getByRole("heading", { name: "Term mark sheet" })).toBeVisible();

  const href = await page.getByTestId("verify-link").getAttribute("href");
  expect(href).toBeTruthy();

  const verify = await browser.newContext();
  const v = await verify.newPage();
  await v.goto(href!);
  await expect(v.getByText("Genuine mark sheet")).toBeVisible();

  const flipped = href!.slice(0, -1) + (href!.endsWith("0") ? "1" : "0");
  await v.goto(flipped);
  await expect(v.getByText("Not genuine")).toBeVisible();
  await verify.close();

  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await signIn(parent, "sarat.panda@termwise.demo");
  await parent.goto("/my/marks/sheet");
  await expect(parent.getByRole("heading", { name: "Term mark sheet" })).toBeVisible();
  await parentContext.close();
});
