import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, errorResponse, rateLimit, readJson } from "@/lib/http";

// Grants admin to the logged-in user when they present ADMIN_SETUP_TOKEN. Remove the env var afterwards.
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    if (!rateLimit(`claim:${clientIp(req)}`, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    const expected = process.env.ADMIN_SETUP_TOKEN || "";
    const { token } = await readJson<{ token?: unknown }>(req);
    const given = String(token ?? "");
    const ok =
      expected.length >= 16 &&
      given.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!ok) return NextResponse.json({ error: "That token isn't right, or admin setup is switched off." }, { status: 403 });
    db().prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
