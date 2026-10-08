import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { db, type UserRow } from "@/lib/db";
import { clientIp, errorResponse, rateLimit, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ email?: unknown; password?: unknown }>(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!rateLimit(`login-ip:${clientIp(req)}`, 30, 15 * 60 * 1000) || !rateLimit(`login-email:${email}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
    }
    const user = db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    const ok = await verifyPassword(String(body.password ?? ""), user?.password_hash ?? null);
    if (!user || !ok) return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
