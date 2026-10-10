import crypto from "node:crypto";
import { PLANS, planById, type PlanId } from "./config";
import { db, now, type PromoRow, type WorkspaceRow } from "./db";

// Promo codes give an account a plan for free for a while, for friends and testers. They don't
// touch billing: the account's paid plan (if any) stays as it is, and whichever plan is higher
// applies. When the promo ends the account drops back to its paid plan on its own.

export class PromoError extends Error {}

const DAY = 24 * 60 * 60 * 1000;
const rank = (plan: string) => PLANS.findIndex((p) => p.id === plan);

/** Upper case, no spaces. Letters, numbers and dashes, 3 to 32 characters. */
export function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function validCode(code: string): boolean {
  return /^[A-Z0-9-]{3,32}$/.test(code);
}

/** e.g. MRX-7KQ2-HD4P. No 0/O or 1/I so it's easy to read out. */
export function generateCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from(crypto.randomBytes(4), (b) => abc[b % abc.length]).join("");
  return `MRX-${part()}-${part()}`;
}

/** True while a workspace's promo applies. */
export function promoActive(ws: Pick<WorkspaceRow, "promo_plan" | "promo_until">, at = Date.now()): boolean {
  return Boolean(ws.promo_plan) && (!ws.promo_until || Date.parse(ws.promo_until) > at);
}

/** The plan that applies: the paid plan, or the promo plan while it runs if it's higher. */
export function effectivePlan(ws: Pick<WorkspaceRow, "plan" | "promo_plan" | "promo_until">): string {
  return promoActive(ws) && rank(ws.promo_plan!) > rank(ws.plan) ? ws.promo_plan! : ws.plan;
}

export function getPromo(code: string): PromoRow | null {
  return (db().prepare("SELECT * FROM promo_codes WHERE code = ?").get(code) as PromoRow | undefined) ?? null;
}

/** Why a code can't be used right now, or null if it can. */
function unusable(p: PromoRow | null, at = Date.now()): string | null {
  if (!p || !p.active) return "That code isn't valid. Check the spelling, or ask whoever gave it to you.";
  if (p.redeem_by && Date.parse(p.redeem_by) < at) return "That code has expired.";
  if (p.max_uses != null && p.uses >= p.max_uses) return "That code has been used up.";
  return null;
}

/** Checks a code without using it. Returns what it gives. */
export function checkPromo(raw: unknown): { code: string; plan: PlanId; days: number | null } {
  const code = normalizeCode(raw);
  const p = validCode(code) ? getPromo(code) : null;
  const why = unusable(p);
  if (why) throw new PromoError(why);
  return { code, plan: planById(p!.plan).id, days: p!.days };
}

/**
 * Uses a code on an account (its first business, which holds the plan). One use per account per
 * code. Counting the use and checking the limit happen in one statement, so two people can't
 * squeeze past the last use at the same time.
 */
export function redeemPromo(primary: WorkspaceRow, raw: unknown, email: string): { plan: PlanId; until: string | null } {
  const { code, plan, days } = checkPromo(raw);
  const run = db().transaction(() => {
    if (db().prepare("SELECT 1 FROM promo_redemptions WHERE code = ? AND workspace_id = ?").get(code, primary.id)) {
      throw new PromoError("You've already used this code.");
    }
    const took = db()
      .prepare("UPDATE promo_codes SET uses = uses + 1 WHERE code = ? AND active = 1 AND (max_uses IS NULL OR uses < max_uses)")
      .run(code);
    if (took.changes !== 1) throw new PromoError("That code has been used up.");
    const until = days ? new Date(Date.now() + days * DAY).toISOString() : null;
    db().prepare("UPDATE workspaces SET promo_plan = ?, promo_until = ?, promo_code = ? WHERE id = ?").run(plan, until, code, primary.id);
    db().prepare("INSERT INTO promo_redemptions (code, workspace_id, email, until, redeemed_at) VALUES (?, ?, ?, ?, ?)").run(code, primary.id, email, until, now());
    return { plan, until };
  });
  return run();
}

/** Admin: ends an account's promo access now. */
export function endPromo(workspaceId: string) {
  const t = now();
  db().prepare("UPDATE workspaces SET promo_until = ? WHERE id = ? AND promo_plan IS NOT NULL").run(t, workspaceId);
  db().prepare("UPDATE promo_redemptions SET until = ? WHERE workspace_id = ? AND (until IS NULL OR until > ?)").run(t, workspaceId, t);
}

export type PromoInput = { plan?: unknown; days?: unknown; max_uses?: unknown; redeem_by?: unknown; note?: unknown; active?: unknown };

/** Validates admin input for creating or editing a code. Only fields present are returned. */
export function promoFields(b: PromoInput): Partial<Omit<PromoRow, "code" | "uses" | "created_at">> {
  const out: Partial<Omit<PromoRow, "code" | "uses" | "created_at">> = {};
  const whole = (v: unknown, name: string, max: number) => {
    if (v === null || v === "" || v === undefined) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > max) throw new PromoError(`${name} must be a whole number from 1 to ${max}, or blank.`);
    return n;
  };
  if (b.plan !== undefined) {
    if (!PLANS.some((p) => p.id === b.plan && p.id !== "free")) throw new PromoError("Pick Starter, Growth or Pro.");
    out.plan = String(b.plan);
  }
  if (b.days !== undefined) out.days = whole(b.days, "Days", 3650);
  if (b.max_uses !== undefined) out.max_uses = whole(b.max_uses, "Uses", 100000);
  if (b.redeem_by !== undefined) {
    if (b.redeem_by === null || b.redeem_by === "") out.redeem_by = null;
    else {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(String(b.redeem_by)) ? Date.parse(`${b.redeem_by}T23:59:59Z`) : NaN;
      if (Number.isNaN(d)) throw new PromoError("Last day to redeem must be a date.");
      out.redeem_by = new Date(d).toISOString();
    }
  }
  if (b.note !== undefined) out.note = String(b.note ?? "").trim().slice(0, 200);
  if (b.active !== undefined) out.active = b.active ? 1 : 0;
  return out;
}
