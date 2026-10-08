import { NextResponse } from "next/server";
import { createSession, createUser, PASSWORD_MAX } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, errorResponse, rateLimit, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    if (!rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many sign-ups from this network. Try again in an hour." }, { status: 429 });
    }
    const body = await readJson<{ email?: unknown; name?: unknown; password?: unknown }>(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Use at least 8 characters for your password." }, { status: 400 });
    if (password.length > PASSWORD_MAX) return NextResponse.json({ error: `Use at most ${PASSWORD_MAX} characters for your password.` }, { status: 400 });
    if (db().prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
      return NextResponse.json({ error: "There's already an account with that email. Log in instead." }, { status: 409 });
    }
    const user = await createUser(email, name, password);
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
