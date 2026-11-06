// Records real screenshots of Termwise from a seeded local instance.
// Start it first: E2E=1 pnpm dev (health is 503 when CRON_SECRET is blank, which is fine).
// Usage: BASE_URL=http://localhost:3000 node scripts/capture.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(here, "../src/assets/screens");
mkdirSync(OUT, { recursive: true });

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PASSWORD = "termwise-demo";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
const ctx = (device, dark = false) => browser.newContext({ ...device, baseURL: BASE, colorScheme: dark ? "dark" : "light" });

async function settle(page) {
  // Next dev keeps an HMR socket open, so networkidle never fires.
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}// Sign in through the auth endpoint: same session cookie the form sets, and it
// does not depend on the client form hydrating.
async function session(context, email) {
  const res = await context.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`sign-in ${res.status()} for ${email}: ${(await res.text()).slice(0, 120)}`);
  const page = await context.newPage();
  return page;
}

async function shot(page, route, name, grow = true) {
  const width = page.viewportSize().width;
  // A previous shot may have grown the viewport; start from the device height.
  await page.setViewportSize({ width, height: width < 500 ? PHONE.viewport.height : DESKTOP.viewport.height });
  // Dev compiles routes on first hit and RSC streaming can hold "load".
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await settle(page);
  // Desktop pages grow to their content height (cap 2200px) unless the shot is
  // meant to be a fixed plate. Phone shots stay at the device viewport.
  const height = grow && width >= 500
    ? Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 2200)
    : page.viewportSize().height;
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("shot", name, route, `${page.viewportSize().width}x${height}`);
}

// ---- office staff: desktop -------------------------------------------------
{
  const c = await ctx(DESKTOP);
  const page = await session(c, "eng.admin@termwise.demo");
  await shot(page, "/attendance", "attendance-conflicts-desktop");
  await shot(page, "/marks", "marks-desktop");
  await shot(page, "/fees", "fees-desktop", false);
  await shot(page, "/risk", "risk-desktop", false);
  await c.close();
}

// ---- faculty: phone --------------------------------------------------------
{
  const c = await ctx(PHONE);
  const page = await session(c, "cse.faculty@termwise.demo");
  await shot(page, "/home", "faculty-home-phone");
  await c.close();
}

// ---- student: phone (read-only own record) ---------------------------------
{
  const c = await ctx(PHONE);
  const page = await session(c, "subhashree.mohanty@termwise.demo", /\/my/);
  await shot(page, "/my/marks", "student-marks-phone");
  await c.close();
}

// ---- trust secretary: desktop ---------------------------------------------
{
  const c = await ctx(DESKTOP);
  const page = await session(c, "trust@termwise.demo", /\/trust/);
  await shot(page, "/trust", "trust-overview-desktop");
  await c.close();
}

await browser.close();
console.log("done");
