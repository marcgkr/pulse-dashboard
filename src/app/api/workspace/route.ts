import { NextResponse } from "next/server";
import { currentUser, ownedWorkspaces, workspaceFor } from "@/lib/auth";
import { planById } from "@/lib/config";
import { db, id, now } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";
import { MARKETS } from "@/lib/markets";
import { startRun } from "@/lib/runs";
import type { WorkspaceRow } from "@/lib/db";

const countryOf = (v: unknown) => (typeof v === "string" && MARKETS.some((m) => m.code === v) ? v : null);

const FIELDS = ["name", "website", "industry", "location", "audience", "offers", "competitors", "goals", "monthly_budget", "tone"] as const;
const REGULATED = /medical|clinic|aesthetic|dental|doctor|surgery|surgeon|health|physio|rehab|legal|law|lawyer|syariah|financ|insurance|supplement/i;

function clean(body: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const f of FIELDS) if (typeof body[f] === "string") out[f] = (body[f] as string).trim().slice(0, 2000);
  return out;
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch (e) {
    return errorResponse(e);
  }
  // A first business, or (on Pro) another business or location on the same login.
  const owned = ownedWorkspaces(user.id);
  if (owned.length > 0) {
    const allowed = planById(owned[0].plan).businesses;
    if (body.add !== true) return NextResponse.json({ error: "You already have a business set up." }, { status: 409 });
    if (allowed <= 1) return NextResponse.json({ error: "Running more than one business is part of the Pro plan. Upgrade in Settings." }, { status: 402 });
    if (owned.length >= allowed) return NextResponse.json({ error: `Your plan covers ${allowed} businesses. Remove one in Settings to add another.` }, { status: 409 });
  }
  const f = clean(body);
  if (!f.name) return NextResponse.json({ error: "Enter your business name." }, { status: 400 });
  const regulated = typeof body.regulated === "boolean" ? body.regulated : REGULATED.test(`${f.industry} ${f.offers}`);
  const row = {
    id: id("w_"),
    owner_id: user.id,
    name: f.name,
    website: f.website ?? "",
    industry: f.industry ?? "",
    location: f.location || "",
    country: countryOf(body.country) ?? "SG",
    audience: f.audience ?? "",
    offers: f.offers ?? "",
    competitors: f.competitors ?? "",
    goals: f.goals ?? "",
    monthly_budget: f.monthly_budget ?? "",
    tone: f.tone ?? "",
    regulated: regulated ? 1 : 0,
    created_at: now(),
  };
  db()
    .prepare(
      `INSERT INTO workspaces (id, owner_id, name, website, industry, location, country, audience, offers, competitors, goals, monthly_budget, tone, regulated, created_at)
       VALUES (@id, @owner_id, @name, @website, @industry, @location, @country, @audience, @offers, @competitors, @goals, @monthly_budget, @tone, @regulated, @created_at)`,
    )
    .run(row);
  if (owned.length > 0) db().prepare("UPDATE users SET current_workspace_id = ? WHERE id = ?").run(row.id, user.id);
  // Time to first value: start the first Site Doctor checkup straight away so the owner lands on a working report.
  let firstRunId: string | null = null;
  if (row.website) {
    try {
      // workspaceFor gives an extra business the account's plan.
      const ws = workspaceFor(user.id) ?? (db().prepare("SELECT * FROM workspaces WHERE id = ?").get(row.id) as WorkspaceRow);
      firstRunId = startRun(ws, "site", { url: row.website }).id;
    } catch (e) {
      console.warn("[onboarding] first checkup not started:", (e as Error).message);
    }
  }
  return NextResponse.json({ ok: true, id: row.id, firstRunId });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  const ws = user && workspaceFor(user.id);
  if (!user || !ws) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch (e) {
    return errorResponse(e);
  }
  const f = clean(body);
  if (f.name === "") return NextResponse.json({ error: "Business name can't be empty." }, { status: 400 });
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(f)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (countryOf(body.country)) {
    sets.push("country = ?");
    vals.push(body.country);
  }
  if (typeof body.regulated === "boolean") {
    sets.push("regulated = ?");
    vals.push(body.regulated ? 1 : 0);
  }
  if (typeof body.autopilot === "boolean") {
    sets.push("autopilot = ?");
    vals.push(body.autopilot ? 1 : 0);
  }
  if (sets.length) db().prepare(`UPDATE workspaces SET ${sets.join(", ")} WHERE id = ?`).run(...vals, ws.id);
  return NextResponse.json({ ok: true });
}

/** Removes an extra business (never the first one, which holds the plan) and everything in it. */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const owned = ownedWorkspaces(user.id);
  const target = owned.find((w) => w.id === id);
  if (!target) return NextResponse.json({ error: "Business not found." }, { status: 404 });
  if (target.id === owned[0].id) return NextResponse.json({ error: "Your first business holds your plan and billing, so it can't be removed here." }, { status: 400 });
  db().prepare("DELETE FROM workspaces WHERE id = ? AND owner_id = ?").run(target.id, user.id);
  db().prepare("UPDATE users SET current_workspace_id = NULL WHERE id = ? AND current_workspace_id = ?").run(user.id, target.id);
  return NextResponse.json({ ok: true });
}
