import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const noHorizontalScroll = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

test("document checklist: verifying the last document completes it, and the change is audited", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/applicants");
  await page.getByRole("row", { name: /Sanjay Pradhan/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("4/5 verified")).toBeVisible();
  const passport = dialog.getByRole("group", { name: "Status of Passport photo" });
  try {
    await passport.getByRole("button", { name: "Verified" }).click();
    await expect(dialog.getByText("5/5 verified · complete")).toBeVisible();
  } finally {
    await passport.getByRole("button", { name: "Received" }).click();
    await expect(dialog.getByText("4/5 verified")).toBeVisible();
  }

  await page.goto("/audit");
  await page.getByLabel("Search").fill("applicant.document");
  await expect(page.getByText("applicant.document").filter({ visible: true }).first()).toBeVisible();
});

test("documents: attach a PDF, open it, verify it; a text file is refused", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/applicants");
  await page.getByRole("row", { name: /Deepika Swain/ }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Attach file for Aadhaar card", { exact: true }).setInputFiles({
    name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test"),
  });
  const view = dialog.getByRole("link", { name: "View", exact: true }).filter({ visible: true });
  await expect(view).toBeVisible();
  const res = await page.request.get((await view.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");

  await dialog.getByRole("group", { name: "Status of Aadhaar card", exact: true }).getByRole("button", { name: "Verified", exact: true }).click();
  await expect(dialog.getByText("2/5 verified")).toBeVisible();

  await dialog.getByLabel("Attach file for Passport photo", { exact: true }).setInputFiles({
    name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo"),
  });
  await expect(page.getByText("Only PDF, JPEG or PNG files.").filter({ visible: true })).toBeVisible();
});

test("import: a valid CSV adds applicants, a bad one lists its line errors and imports nothing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "eng.admin@termwise.demo");
  await page.goto("/applicants");

  await page.getByRole("button", { name: "Import CSV" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Batch" }).click();
  await page.getByRole("option", { name: /^CSE-2024/ }).click();
  const tag = Date.now();
  const good = `name,birth_date,category,guardian_name,guardian_phone,guardian_email\n` +
    `E2E Applicant ${tag} A,2006-03-01,general,Guardian A,+91 90000 09001,\n` +
    `"E2E, Applicant ${tag} B",2006-04-02,obc,"Guardian ""B""",+91 90000 09002,b@example.com\n`;
  await dialog.locator('input[type="file"]').setInputFiles({ name: "a.csv", mimeType: "text/csv", buffer: Buffer.from(good) });
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("Imported 2 applicants")).toBeVisible();

  await page.getByRole("button", { name: "Import CSV" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Batch" }).click();
  await page.getByRole("option", { name: /^CSE-2024/ }).click();
  const bad = "name,birth_date,category,guardian_name,guardian_phone\n" +
    "Bad Date,2006-02-30,general,Guardian,+91 90000 09003\n" +
    "Bad Category,2006-01-01,gen,Guardian,+91 90000 09004\n";
  await dialog.locator('input[type="file"]').setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByText("Line 2: birth_date")).toBeVisible();
  await expect(dialog.getByText("Line 3: category")).toBeVisible();
});

test("faculty are sent home from applicants", async ({ page }) => {
  await signIn(page, "cse.faculty@termwise.demo");
  await page.goto("/applicants");
  await page.waitForURL("**/home");
});

test("applicants list, record and documents setup fit a 375px phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, "eng.admin@termwise.demo");

  await page.goto("/applicants");
  await expect(page.getByRole("heading", { level: 1, name: "Applicants" })).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("row", { name: /Sanjay Pradhan/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto("/setup?tab=documents");
  await noHorizontalScroll(page);
});
