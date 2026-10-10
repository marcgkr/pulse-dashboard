import { defineConfig } from "@playwright/test";

// Ports can be moved (E2E_PORT, E2E_STRIPE_PORT) so two checkouts can run the suite at once.
const APP = process.env.E2E_PORT || "3100";
const STRIPE = process.env.E2E_STRIPE_PORT || "4700";

// E2E smoke test. Runs the production build against a local fixture website.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  use: { baseURL: `http://127.0.0.1:${APP}`, launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  webServer: [
    {
      command: "python3 -m http.server 4555 --directory tests/fixtures/site",
      url: "http://127.0.0.1:4555/",
      reuseExistingServer: true,
    },
    {
      command: `MOCK_STRIPE_PORT=${STRIPE} npx tsx tests/mock-stripe/server.ts`,
      url: `http://127.0.0.1:${STRIPE}/__requests`,
      reuseExistingServer: false,
    },
    {
      command: `rm -f data/e2e-${APP}.db* && npx next start -p ${APP}`,
      url: `http://127.0.0.1:${APP}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_PATH: `data/e2e-${APP}.db`,
        PULSERX_ALLOW_PRIVATE: "1",
        ADMIN_SETUP_TOKEN: "e2e-setup-token-1234567890",
        // Every test signs up from the same address.
        SIGNUPS_PER_IP_PER_HOUR: "50",
        RATE_LIMIT_PAGES_PER_MIN: "5000",
        RATE_LIMIT_API_PER_MIN: "5000",
        ANTHROPIC_API_KEY: "",
        // Payments against tests/mock-stripe.
        STRIPE_SECRET_KEY: "sk_test_mock",
        STRIPE_API_BASE: `http://127.0.0.1:${STRIPE}`,
        NO_PROXY: "*",
      },
    },
  ],
});
