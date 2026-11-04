import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("office admin corrects a past session with a reason, and the change is audited", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "admin@termwise.demo");
  await page.goto("/attendance?tab=sessions");
  await page.getByLabel("Date").selectOption("Last 7 days");
  await page.getByRole("row").nth(1).click();
  await page.waitForURL(/session=/);
  const sessionUrl = page.url();

  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", { name: /^Status for/ }).first();
  const name = (await select.getAttribute("aria-label"))!.replace("Status for ", "");
  const before = await select.inputValue();
  const after = before === "absent" ? "present" : "absent";
  await select.selectOption(after);

  const reason = `Roll call fix ${Date.now()}`;
  await dialog.getByLabel("Reason for correction (required)").fill(reason);
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Correction saved.")).toBeVisible();

  await page.goto(sessionUrl);
  await expect(page.getByRole("dialog").getByRole("combobox", { name: `Status for ${name}` })).toHaveValue(after);

  await page.goto("/audit");
  await page.getByLabel("Search changes").fill(reason);
  await expect(page.getByRole("cell", { name: reason })).toBeVisible();
});

test("admin keeps the saved session on a sync conflict and it leaves the open list", async ({ page, playwright }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const base = { baseURL: "http://localhost:3100" };
  const signInApi = (ctx: Awaited<ReturnType<typeof playwright.request.newContext>>, email: string) =>
    ctx.post("/api/auth/sign-in/email", { data: { email, password: "termwise-demo" }, headers: { origin: "http://localhost:3100" } });

  // A second teacher's sheet for a saved class creates the conflict this test resolves.
  const first = await playwright.request.newContext(base);
  await signInApi(first, "faculty@termwise.demo");
  const { classes } = await (await first.get("/api/today")).json();
  const cls = classes[classes.length - 1];
  const item = {
    sessionId: crypto.randomUUID(), batchId: cls.batchId, subjectId: cls.subjectId, date: cls.date, period: cls.period, periodCount: cls.periodCount,
    entries: cls.roster.map((s: { id: number }) => ({ studentId: s.id, status: "present" })), editedAt: new Date().toISOString(), markedBy: cls.staffId,
  };
  const send = (req: typeof first, body: object) => req.post("/api/sync", { data: { clientNow: new Date().toISOString(), items: [body] } });
  expect((await (await send(first, item)).json()).results[0].outcome).toMatch(/saved|stale/);

  const second = await playwright.request.newContext(base);
  await signInApi(second, "faculty2@termwise.demo");
  const otherId = (await (await second.get("/api/today")).json()).staffId;
  const r = await send(second, { ...item, sessionId: crypto.randomUUID(), markedBy: otherId });
  expect((await r.json()).results[0].outcome).toBe("conflict");
  await first.dispose();
  await second.dispose();

  await signIn(page, "admin@termwise.demo");
  await page.goto("/attendance?tab=conflicts");
  await page.getByRole("row").filter({ hasText: "Open" }).first().click();
  await page.waitForURL(/conflict=/);
  const conflictId = new URL(page.url()).searchParams.get("conflict");

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Keep saved" }).click();
  await expect(page.getByText("Kept the saved session.")).toBeVisible();

  await page.goto(`/attendance?tab=conflicts&conflict=${conflictId}`);
  await expect(page.getByRole("dialog").getByText(/^Resolved\s+Kept/)).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Keep saved" })).toHaveCount(0);
});
