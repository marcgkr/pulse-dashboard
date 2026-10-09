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

  // The first Site Doctor checkup starts automatically from the website given at signup.
  await expect(page).toHaveURL(/\/app\/runs\//);
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

test("free-checkup leads are captured", async ({ request }) => {
  const bad = await request.post("/api/leads", { data: { email: "not-an-email", url: "example.com" } });
  expect(bad.status()).toBe(400);
  const ok = await request.post("/api/leads", { data: { email: "lead@example.com", url: "example.com", score: 42, country: "AU" } });
  expect(ok.status()).toBe(200);
  const csv = await request.get("/api/admin/leads");
  expect(csv.status()).toBe(403); // admins only
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

test("owner notes on a report are remembered, listed in settings, and can be forgotten", async ({ page, browser }) => {
  await page.goto("/signup?website=http://127.0.0.1:4555/");
  await page.getByLabel("Your name").fill("Ravi");
  await page.getByLabel("Email").fill("notes@example.com");
  await page.getByLabel("Password").fill("correct-horse-2");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Business name").fill("Northside Renovations");
  await page.getByLabel("Industry").selectOption({ index: 1 });
  await page.getByLabel("What you sell").fill("Kitchen and bathroom renovations");
  await page.getByRole("button", { name: "Save and open my dashboard" }).click();
  await expect(page).toHaveURL(/\/app\/runs\//);
  await expect(page.getByText("Every check we ran")).toBeVisible({ timeout: 60_000 });
  const runUrl = page.url();

  await page.getByPlaceholder(/We only serve the north/).fill("We only serve the north of the city.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Saved. Site Doctor will use this on your next run.")).toBeVisible();

  // The note is still there after a reload.
  await page.reload();
  await expect(page.getByPlaceholder(/We only serve the north/)).toHaveValue("We only serve the north of the city.");

  // Another account can't write feedback on this report.
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  await other.request.post("/api/auth/signup", { data: { email: "intruder@example.com", name: "X", password: "intruder-pass-1" } });
  const runId = runUrl.split("/").pop();
  const denied = await other.request.post(`/api/runs/${runId}/feedback`, { data: { item: "", verdict: "comment", comment: "hijack" }, headers: { origin: "http://127.0.0.1:3100" } });
  expect([401, 404]).toContain(denied.status());
  await other.close();

  await page.goto("/app/settings#memory");
  const memory = page.locator("#memory");
  await expect(memory.getByText("We only serve the north of the city.")).toBeVisible();
  await memory.getByRole("button", { name: "Forget this" }).click();
  await expect(memory.getByText(/Nothing yet/)).toBeVisible();
});

test("sample Content Studio shows feedback buttons and reference posts", async ({ page }) => {
  await page.goto("/sample/content");
  await expect(page.getByRole("heading", { name: "Post ideas" })).toBeVisible();
  await expect(page.getByText("Sample reference. Live reports link the real post.").first()).toBeVisible();
  const idea = page.locator("#idea-1");
  await idea.getByRole("button", { name: "Approve" }).click();
  await expect(idea.getByText("Approved. Content Studio will do more like this.")).toBeVisible();
  await idea.getByRole("button", { name: "Approved" }).click(); // clicking again clears it
  await expect(idea.getByRole("button", { name: "Approve" })).toBeVisible();
  await idea.getByRole("button", { name: "Reject" }).click();
  await idea.getByRole("textbox").fill("We never film customers.");
  await idea.getByRole("button", { name: "Save comment" }).click();
  await expect(idea.getByText("Rejected. Content Studio won't suggest this again.")).toBeVisible();
});

test("Pro accounts can add, switch between and remove businesses", async ({ page }) => {
  const api = page.request;
  expect((await api.post("/api/auth/signup", { data: { email: "pro@example.com", name: "Pro Owner", password: "pro-owner-pass-1" } })).ok()).toBeTruthy();
  const first = await api.post("/api/workspace", { data: { name: "Outlet One", industry: "Reflexology", country: "SG" } });
  expect(first.ok()).toBeTruthy();
  const firstId = (await first.json()).id as string;

  // Not on Pro yet: no second business.
  const refused = await api.post("/api/workspace", { data: { name: "Outlet Two", add: true } });
  expect(refused.status()).toBe(402);

  expect((await api.post("/api/admin/claim", { data: { token: "e2e-setup-token-1234567890" } })).ok()).toBeTruthy();
  expect((await api.post("/api/admin/plan", { data: { workspaceId: firstId, plan: "pro" } })).ok()).toBeTruthy();

  await page.goto("/app");
  await page.getByRole("link", { name: "+ Add a business" }).first().click();
  await expect(page.getByRole("heading", { name: "Add another business or location" })).toBeVisible();
  await page.getByLabel("Business name").fill("Outlet Two");
  await page.getByLabel("Industry").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add this business" }).click();
  await expect(page).toHaveURL(/\/app/);

  const switcher = page.getByLabel("Your business").first();
  await expect(switcher).toHaveValue(/.+/);
  await expect(switcher.locator("option:checked")).toHaveText("Outlet Two");
  await switcher.selectOption({ label: "Outlet One" });
  await expect(page.getByLabel("Your business").first().locator("option:checked")).toHaveText("Outlet One");

  await page.goto("/app/settings#businesses");
  const list = page.locator("#businesses");
  await expect(list.getByText("Outlet Two")).toBeVisible();
  await expect(page.locator("#autopilot").getByRole("switch")).toHaveAttribute("aria-checked", "true");
  page.once("dialog", (d) => d.accept());
  await list.getByRole("button", { name: "Remove" }).click();
  await expect(list.getByText("Outlet Two")).toHaveCount(0);
});
