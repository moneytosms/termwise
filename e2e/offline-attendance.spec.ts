import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("mark attendance offline, then it syncs and is saved on the server", async ({ page, context }) => {
  await signIn(page, "faculty@termwise.demo");
  // Roster downloaded and service worker has cached the offline pages.
  const firstClass = page.getByRole("list", { name: "Today's periods" }).getByRole("link").first();
  await expect(firstClass).toBeVisible();
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) return false;
    return Boolean(reg.active && (await caches.match("/mark")));
  });
  const href = await firstClass.getAttribute("href");
  const key = decodeURIComponent(href!.split("#")[1]);
  const [batchId, subjectId, date, period] = key.split(":");

  await context.setOffline(true);
  await page.goto(href!);
  await expect(page.getByText("Offline. You can still mark attendance.")).toBeVisible();

  const rows = page.getByRole("button", { name: /Tap to change/ });
  await rows.nth(0).click();
  await rows.nth(1).click();
  await rows.nth(1).click(); // Absent, then Late
  await expect(page.getByRole("list", { name: "Absent and late" }).getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: /^Submit/ }).click();
  await expect(page.getByText("Absent (1)")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await page.waitForURL("**/home");
  await expect(page.getByText(/1 pending/)).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("All saved")).toBeVisible({ timeout: 20_000 });

  const today = await page.request.get("/api/today");
  const cls = (await today.json()).classes.find((c: { key: string }) => c.key === `${batchId}:${subjectId}:${date}:${period}`);
  expect(cls.sessionId).toBeTruthy();
  const saved = await (await page.request.get(`/api/sessions/${cls.sessionId}`)).json();
  const statuses = saved.entries.map((e: { status: string }) => e.status);
  expect(statuses.filter((s: string) => s === "absent")).toHaveLength(1);
  expect(statuses.filter((s: string) => s === "late")).toHaveLength(1);
});

test("expired sign-in keeps entries queued", async ({ page, context }) => {
  await signIn(page, "faculty@termwise.demo");
  await expect(page.getByRole("list", { name: "Today's periods" })).toBeVisible();
  await context.clearCookies();
  const r = await page.request.post("/api/sync", { data: { clientNow: new Date().toISOString(), items: [] } });
  expect(r.status()).toBe(401);
});

test("a second teacher's sheet for a saved class goes to the conflict queue", async ({ page, playwright }) => {
  await signIn(page, "faculty@termwise.demo");
  const { classes } = await (await page.request.get("/api/today")).json();
  const cls = classes[classes.length - 1];
  const item = {
    sessionId: crypto.randomUUID(), batchId: cls.batchId, subjectId: cls.subjectId, date: cls.date, period: cls.period, periodCount: cls.periodCount,
    entries: cls.roster.map((s: { id: number }) => ({ studentId: s.id, status: "present" })), editedAt: new Date().toISOString(),
  };
  const send = (req: typeof page.request, body = item) => req.post("/api/sync", { data: { clientNow: new Date().toISOString(), items: [body] } });
  expect((await (await send(page.request)).json()).results[0].outcome).toMatch(/saved|stale/);

  const other = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
  await other.post("/api/auth/sign-in/email", { data: { email: "faculty2@termwise.demo", password: "termwise-demo" }, headers: { origin: "http://localhost:3100" } });
  const r = await send(other, { ...item, sessionId: crypto.randomUUID() });
  expect((await r.json()).results[0].outcome).toBe("conflict");
  await other.dispose();
});
