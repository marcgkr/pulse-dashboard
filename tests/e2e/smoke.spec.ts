import { expect, test } from "@playwright/test";

const email = "owner@example.com"; // DB is reset each run

test("owner signs up, runs Site Doctor, and works a prescription", async ({ page }) => {
  await page.goto("/signup?website=http://127.0.0.1:4555/");
  await page.getByLabel("Your name").fill("Mei Ling");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible();
  await page.getByLabel("Business name").fill("Glow Aesthetics");
  await page.getByLabel("Industry").selectOption("Aesthetic clinic");
  await page.getByLabel("What you sell").fill("Pico laser, Hydrafacial, skin boosters");
  await page.getByRole("button", { name: "Save and open my dashboard" }).click();

  await expect(page.getByRole("heading", { name: /Welcome, Mei/ })).toBeVisible();
  await expect(page.getByLabel("Website to check")).toHaveValue("http://127.0.0.1:4555/");
  await page.getByRole("button", { name: "Run checkup" }).click();

  await expect(page.getByText("Diagnosis")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Sample output").first()).toBeVisible();
  await expect(page.getByText("Every check we ran")).toBeVisible();
  const firstDone = page.getByRole("button", { name: "Mark done" }).first();
  await firstDone.click();
  await expect(page.getByRole("button", { name: "Undo" }).first()).toBeVisible();

  await page.goto("/app/plan?tab=done");
  await expect(page.locator("article")).toHaveCount(1);

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /(Morning|Afternoon|Evening) check/ })).toBeVisible();

  await page.goto("/app/ask");
  await page.getByLabel("Your question").fill("What should I fix first?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I'm running in demo mode")).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app$/); // not an admin yet
  await page.goto("/admin/claim");
  await page.getByLabel("Setup token").fill("wrong-token-wrong-token");
  await page.getByRole("button", { name: "Make me an admin" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Setup token").fill("e2e-setup-token-1234567890");
  await page.getByRole("button", { name: "Make me an admin" }).click();
  await expect(page.getByRole("heading", { name: "Admin console" })).toBeVisible();
  await expect(page.getByText("Glow Aesthetics")).toBeVisible();
});

test("wrong password is rejected", async ({ request }) => {
  await request.post("/api/auth/signup", { data: { email: "pw@example.com", name: "Pw", password: "right-password-1" } });
  const bad = await request.post("/api/auth/login", { data: { email: "pw@example.com", password: "wrong-password-1" } });
  expect(bad.status()).toBe(401);
  const good = await request.post("/api/auth/login", { data: { email: "pw@example.com", password: "right-password-1" } });
  expect(good.status()).toBe(200);
  const nobody = await request.post("/api/auth/login", { data: { email: "nobody@example.com", password: "whatever-123" } });
  expect(nobody.status()).toBe(401);
});

test("cross-site writes are blocked", async ({ request }) => {
  const res = await request.post("/api/auth/login", { data: { email: "a@b.co", password: "x" }, headers: { origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("landing page free checkup works", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  const res = await page.request.post("/api/checkup", { data: { url: "http://127.0.0.1:4555/" } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(typeof body.score).toBe("number");
});
