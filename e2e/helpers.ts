import type { Page } from "@playwright/test";

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("termwise-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(home|my|trust)$/);
}
