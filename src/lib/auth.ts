import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, id, now, type UserRow, type WorkspaceRow } from "./db";

const COOKIE = "prx_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires.toISOString());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?",
    )
    .get(token, now()) as UserRow | undefined;
  return row ?? null;
}

export function isAdmin(user: Pick<UserRow, "email"> | null): boolean {
  if (!user) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

export function workspaceFor(userId: string): WorkspaceRow | null {
  const row = db()
    .prepare("SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at LIMIT 1")
    .get(userId) as WorkspaceRow | undefined;
  return row ?? null;
}

/** For server components/pages: requires a logged-in user with a workspace. */
export async function requireWorkspace(): Promise<{ user: UserRow; ws: WorkspaceRow }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ws = workspaceFor(user.id);
  if (!ws) redirect("/onboarding");
  return { user, ws };
}

/** For route handlers: returns null instead of redirecting. */
export async function apiWorkspace(): Promise<{ user: UserRow; ws: WorkspaceRow } | null> {
  const user = await currentUser();
  if (!user) return null;
  const ws = workspaceFor(user.id);
  if (!ws) return null;
  return { user, ws };
}

export function createUser(email: string, name: string, password: string): UserRow {
  const user: UserRow = {
    id: id("u_"),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    password_hash: hashPassword(password),
    created_at: now(),
  };
  db()
    .prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (@id, @email, @name, @password_hash, @created_at)")
    .run(user);
  return user;
}
