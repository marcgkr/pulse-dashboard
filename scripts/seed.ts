/**
 * Creates a demo account with a fictional clinic and one sample report from every specialist.
 *   SEED_EMAIL=demo@marketingrx.ai SEED_SITE_URL=https://example-clinic.sg npm run seed
 * Prints the password (random unless SEED_PASSWORD is set). Runs in demo mode: no API calls.
 */
import crypto from "node:crypto";
import { createUser } from "@/lib/auth";
import { db, id, now, type UserRow, type WorkspaceRow } from "@/lib/db";
import { AGENT_ORDER, getAgent } from "@/lib/agents";
import { execute } from "@/lib/runs";

async function main() {
  const email = (process.env.SEED_EMAIL || "demo@marketingrx.ai").toLowerCase();
  const password = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const existing = db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (existing) {
    console.log(`${email} already exists. Delete it or use another SEED_EMAIL.`);
    return;
  }
  const user = await createUser(email, "Demo Owner", password);
  db().prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(user.id);
  const ws: WorkspaceRow = {
    id: id("w_"),
    owner_id: user.id,
    name: "Lumen Skin Clinic",
    website: process.env.SEED_SITE_URL || "",
    industry: "Aesthetic clinic",
    location: "Singapore (Tampines and Orchard)",
    country: "SG",
    audience: "Working women 28-45, first-timers worried about downtime and pain",
    offers: "Pico laser for pigmentation, Hydrafacial, skin boosters, acne scar treatment",
    competitors: "Glow Aesthetics, The Skin Lab SG",
    goals: "25 more first-time consultations a month without raising ad spend",
    monthly_budget: "S$4,000 Google + Meta",
    tone: "Warm, reassuring, no hard sell",
    regulated: 1,
    plan: "growth",
    stripe_customer_id: null,
    windsor_api_key: null,
    created_at: now(),
  };
  db()
    .prepare(
      `INSERT INTO workspaces (id, owner_id, name, website, industry, location, country, audience, offers, competitors, goals, monthly_budget, tone, regulated, plan, created_at)
       VALUES (@id, @owner_id, @name, @website, @industry, @location, @country, @audience, @offers, @competitors, @goals, @monthly_budget, @tone, @regulated, @plan, @created_at)`,
    )
    .run(ws);

  // Sample inputs for specialists that need something to work on.
  const sampleInputs: Record<string, unknown> = {
    visibility: {
      prompts: [
        "best clinic for pico laser in Tampines",
        "where to get a hydrafacial in Singapore",
        "acne scar treatment clinic Singapore with low downtime",
      ],
    },
    compliance: {
      channel: "Meta ad",
      category: "Aesthetic clinic",
      text: "Singapore's best pico laser! Guaranteed clear skin in 1 session, painless with no downtime. Our patients say it changed their lives. See the before and after. Book this week only and get 50% off!",
    },
  };

  for (const agentId of AGENT_ORDER) {
    const agent = getAgent(agentId)!;
    if (agentId === "site" && !ws.website) {
      console.log("- skipping Site Doctor (set SEED_SITE_URL to include it)");
      continue;
    }
    let input: unknown;
    try {
      input = agent.parseInput(sampleInputs[agentId] ?? {}, ws);
    } catch (e) {
      console.log(`- skipping ${agent.name}: ${(e as Error).message}`);
      continue;
    }
    const runId = id("r_");
    db()
      .prepare("INSERT INTO runs (id, workspace_id, agent, title, input_json, status, demo, created_at) VALUES (?, ?, ?, ?, ?, 'queued', 1, ?)")
      .run(runId, ws.id, agentId, agent.runTitle(input, ws), JSON.stringify(input), now());
    await execute(runId, ws, input, false);
    const r = db().prepare("SELECT status, error FROM runs WHERE id = ?").get(runId) as { status: string; error: string | null };
    console.log(`- ${agent.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  console.log(`\nDemo account ready:\n  email:    ${email}\n  password: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
