import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { db, type UserRow } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const user = db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (!user || !verifyPassword(body.password ?? "", user.password_hash)) {
    return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
