import { defineConfig } from "@playwright/test";

// E2E smoke test. Runs the production build against a local fixture website.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3100", launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  webServer: [
    {
      command: "python3 -m http.server 4555 --directory tests/fixtures/site",
      url: "http://127.0.0.1:4555/",
      reuseExistingServer: true,
    },
    {
      command: "rm -f data/e2e.db* && npx next start -p 3100",
      url: "http://127.0.0.1:3100/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_PATH: "data/e2e.db",
        PULSERX_ALLOW_PRIVATE: "1",
        ADMIN_SETUP_TOKEN: "e2e-setup-token-1234567890",
        ANTHROPIC_API_KEY: "",
        NO_PROXY: "*",
      },
    },
  ],
});
