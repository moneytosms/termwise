import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Pallavi Jena is guardian of ENG-24-CSE-0001 and reads Odia (set by seedLanguage).
test("admin sees the Odia templates and the Odia guardian's inbox loads", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@termwise.demo");
  await page.goto("/messages");
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
  await expect(page.getByText("Odia text needs native-speaker review.")).toBeVisible();
  await expect(page.getByText(/ଶୁଳ୍କ ସ୍ମାରକ/).first()).toBeVisible();

  await signIn(page, "pallavi.jena@termwise.demo");
  await expect(page).toHaveURL(/\/my$/);
  await page.goto("/my/messages");
  await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toHaveCount(0);
});
