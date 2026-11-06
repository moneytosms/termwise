import { defineConfig, devices } from "@playwright/test";

// Specs like parent-link sign tokens and query the DB, so they need the same env as the server.
try { process.loadEnvFile(".env"); } catch { /* CI provides env directly */ }

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "pnpm start -p 3100", url: "http://localhost:3100/sign-in", reuseExistingServer: true, env: { E2E: "1", BETTER_AUTH_URL: "http://localhost:3100", GOOGLE_GENERATIVE_AI_API_KEY: "", GROQ_API_KEY: "" } },
  projects: [
    // Desktop runs first on the fresh seed: phone specs mark attendance and confirm admissions, which moves the brief's figures.
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: ["access.spec.ts", "office-roles.spec.ts", "campus-roles.spec.ts", "hod.spec.ts"] },
    { name: "phone", use: { ...devices["Pixel 7"] }, dependencies: ["desktop"] },
  ],
});
