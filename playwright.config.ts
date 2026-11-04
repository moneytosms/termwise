import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "pnpm start -p 3100", url: "http://localhost:3100/sign-in", reuseExistingServer: true, env: { E2E: "1", BETTER_AUTH_URL: "http://localhost:3100" } },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
});
