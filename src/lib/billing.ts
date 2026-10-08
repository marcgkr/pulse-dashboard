import Stripe from "stripe";
import { PLANS, type PlanId } from "./config";

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Billing isn't set up yet.");
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

export function priceFor(plan: PlanId): string | null {
  const p = PLANS.find((x) => x.id === plan);
  return p?.stripePriceEnv ? process.env[p.stripePriceEnv] || null : null;
}

export function planForPrice(priceId: string): PlanId | null {
  for (const p of PLANS) if (p.stripePriceEnv && process.env[p.stripePriceEnv] === priceId) return p.id;
  return null;
}

export function appUrl(req: Request): string {
  return process.env.APP_URL || new URL(req.url).origin;
}
