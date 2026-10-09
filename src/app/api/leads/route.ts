import { NextResponse } from "next/server";
import { db, id, now } from "@/lib/db";
import { clientIp, errorResponse, rateLimit, readJson } from "@/lib/http";
import { MARKETS } from "@/lib/markets";

// Free-checkup leads: saved before the visitor reaches signup, so PULSE can follow up even if they stop there.
export async function POST(req: Request) {
  try {
    if (!rateLimit(`lead:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests from this network. Try again later." }, { status: 429 });
    }
    const body = await readJson<{ email?: unknown; url?: unknown; score?: unknown; country?: unknown }>(req, 4000);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const website = String(body.url ?? "").trim().slice(0, 300);
    const score = typeof body.score === "number" && body.score >= 0 && body.score <= 100 ? Math.round(body.score) : null;
    const country = MARKETS.some((m) => m.code === body.country) ? String(body.country) : "";
    // One row per email + website; repeat submissions just refresh it.
    const existing = db().prepare("SELECT id FROM leads WHERE email = ? AND website = ?").get(email, website) as { id: string } | undefined;
    if (existing) {
      db().prepare("UPDATE leads SET score = ?, country = ?, created_at = ? WHERE id = ?").run(score, country, now(), existing.id);
    } else {
      db().prepare("INSERT INTO leads (id, email, website, score, country, source, created_at) VALUES (?, ?, ?, ?, ?, 'checkup', ?)").run(id("l_"), email, website, score, country, now());
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
