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

/**
 * Stripe price for a plan in a currency: STRIPE_PRICE_GROWTH_AUD, falling back to STRIPE_PRICE_GROWTH
 * (your default-currency price) when no currency-specific price is set.
 */
export function priceFor(plan: PlanId, currency: string): string | null {
  const p = PLANS.find((x) => x.id === plan);
  if (!p?.stripePriceEnv) return null;
  return process.env[`${p.stripePriceEnv}_${currency.toUpperCase()}`] || process.env[p.stripePriceEnv] || null;
}

export function planForPrice(priceId: string): PlanId | null {
  for (const p of PLANS) {
    if (!p.stripePriceEnv) continue;
    for (const [k, v] of Object.entries(process.env)) {
      if ((k === p.stripePriceEnv || k.startsWith(`${p.stripePriceEnv}_`)) && v === priceId) return p.id;
    }
  }
  return null;
}

export function appUrl(req: Request): string {
  return process.env.APP_URL || new URL(req.url).origin;
}
