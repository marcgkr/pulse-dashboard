import { NextResponse } from "next/server";
import { createSession, createUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Use at least 8 characters for your password." }, { status: 400 });
  if (db().prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    return NextResponse.json({ error: "There's already an account with that email. Log in instead." }, { status: 409 });
  }
  const user = createUser(email, name, password);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
