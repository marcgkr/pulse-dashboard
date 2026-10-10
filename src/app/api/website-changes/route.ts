import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { appUrl } from "@/lib/billing";
import { planById } from "@/lib/config";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { buildItems, loginSummary, nextRoundOpens, notifyTeam, ROUNDS_PER_MONTH, submitRound, webcareActive } from "@/lib/webcare";

export const runtime = "nodejs";

/** The owner sends this round of website changes. The team gets an email (and a WhatsApp alert when set up). */
export async function POST(req: Request) {
  try {
    const auth = await apiWorkspace();
    if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    const { user, ws } = auth;
    if (!webcareActive(ws)) return NextResponse.json({ error: "Add website changes by PULSE first." }, { status: 402 });
    if (!loginSummary(ws.id)?.hasPassword) return NextResponse.json({ error: "Save your website login first, so PULSE can make the changes." }, { status: 409 });
    if (!rateLimit(`webcare-round:${user.id}`, 10, 3_600_000)) return NextResponse.json({ error: "Too many tries in the last hour. Try again later." }, { status: 429 });
    const raw = await readJson<{ text?: unknown; taskIds?: unknown }>(req, 64_000);
    const built = buildItems(ws.id, raw);
    if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });
    const round = submitRound(ws, user.id, built.items);
    if (!round) {
      const opens = nextRoundOpens().toISOString();
      return NextResponse.json({ error: `You've sent both rounds for this month (${ROUNDS_PER_MONTH} a month).`, opens }, { status: 409 });
    }
    // Best effort: the round is saved whether or not the email goes out.
    try {
      await notifyTeam(round, {
        business: ws.name,
        ownerName: user.name,
        ownerEmail: user.email,
        website: ws.website,
        planName: planById(ws.plan).name,
        appUrl: appUrl(req),
      });
    } catch (e) {
      console.warn("[webcare] team notification failed:", (e as Error).message);
    }
    return NextResponse.json({ ok: true, id: round.id });
  } catch (e) {
    return errorResponse(e);
  }
}
