import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { outletLimit } from "./config";
import { db, id, now, type UserRow, type WorkspaceRow } from "./db";
import { effectivePlan } from "./promos";

const COOKIE = "prx_session";
const SESSION_DAYS = 30;

const scrypt = (password: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, len, (err, key) => (err ? reject(err) : resolve(key))));

export const PASSWORD_MAX = 256;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// Used when the email doesn't exist so login takes the same time either way.
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, saltHex, hashHex] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password.slice(0, PASSWORD_MAX), Buffer.from(saltHex, "hex"), expected.length);
  return stored != null && crypto.timingSafeEqual(expected, actual);
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

/**
 * Admin is a flag on the user row, granted only with ADMIN_SETUP_TOKEN (see /admin/claim) or the CLI.
 * Never by email alone: emails aren't verified, so anyone could sign up as an admin address.
 */
export function isAdmin(user: Pick<UserRow, "is_admin"> | null): boolean {
  return Boolean(user?.is_admin);
}

/** Every business this login owns, oldest first. The first one holds the plan and billing. */
export function ownedWorkspaces(userId: string): WorkspaceRow[] {
  const rows = db().prepare("SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at, id").all(userId) as WorkspaceRow[];
  // The first business holds the plan: a running promo code can lift it (src/lib/promos.ts).
  if (rows[0]) rows[0] = { ...rows[0], plan: effectivePlan(rows[0]), paid_plan: rows[0].plan };
  return rows;
}

/** The business that holds the plan and the Stripe subscription. */
export function primaryWorkspace(userId: string): WorkspaceRow | null {
  return ownedWorkspaces(userId)[0] ?? null;
}

/**
 * The business the owner is looking at. Pro accounts can switch between up to five; every other
 * plan always gets the first. Extra businesses take the plan, billing and add-ons of the first one.
 */
export function workspaceFor(userId: string): WorkspaceRow | null {
  const all = ownedWorkspaces(userId);
  const primary = all[0];
  if (!primary) return null;
  if (all.length === 1 || outletLimit(primary) <= 1) return primary;
  const pick = (db().prepare("SELECT current_workspace_id AS id FROM users WHERE id = ?").get(userId) as { id: string | null } | undefined)?.id;
  const allowed = all.slice(0, outletLimit(primary));
  const current = allowed.find((w) => w.id === pick) ?? primary;
  if (current.id === primary.id) return primary;
  return {
    ...current,
    plan: primary.plan,
    paid_plan: primary.paid_plan,
    promo_plan: primary.promo_plan,
    promo_until: primary.promo_until,
    promo_code: primary.promo_code,
    webcare: primary.webcare,
    stripe_customer_id: primary.stripe_customer_id,
    stripe_subscription_id: primary.stripe_subscription_id,
  };
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

export async function createUser(email: string, name: string, password: string): Promise<UserRow> {
  const user: UserRow = {
    id: id("u_"),
    email: email.trim().toLowerCase(),
    name: name.trim().slice(0, 120),
    password_hash: await hashPassword(password),
    is_admin: 0,
    created_at: now(),
  };
  db()
    .prepare("INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (@id, @email, @name, @password_hash, @is_admin, @created_at)")
    .run(user);
  return user;
}
