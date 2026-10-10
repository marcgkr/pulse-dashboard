import Stripe from "stripe";
import { PLANS, planById, planPrice, type PlanId } from "./config";
import { db } from "./db";
import { marketFor } from "./markets";

// Billing needs only STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET for renewals and cancellations).
// Prices come from the price list in src/lib/markets.ts, in the customer's currency, so nothing has
// to be set up in Stripe first. One Stripe product per plan is created the first time it's needed.

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Billing isn't set up yet.");
  if (!_stripe) {
    // STRIPE_API_BASE points the SDK at tests/mock-stripe in end-to-end tests. Never set it in production.
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    _stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY,
      base ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(":", "") as "http" | "https" } : undefined,
    );
  }
  return _stripe;
}

/**
 * Optional fixed Stripe price for a plan: STRIPE_PRICE_GROWTH_AUD, else STRIPE_PRICE_GROWTH. Without
 * one, checkout uses the price list (see priceData).
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

const products = new Map<string, string>();

/** The Stripe product for a plan, or "outlet" for extra outlets (tagged mrx_plan), created on first use. */
async function productFor(key: PlanId | "outlet"): Promise<string> {
  const hit = products.get(key);
  if (hit) return hit;
  const found = await stripe().products.search({ query: `metadata['mrx_plan']:'${key}' AND active:'true'`, limit: 1 });
  const name = key === "outlet" ? "MarketingRx extra outlet" : `MarketingRx ${planById(key).name}`;
  const id = found.data[0]?.id ?? (await stripe().products.create({ name, metadata: { mrx_plan: key } })).id;
  products.set(key, id);
  return id;
}

/** Monthly price of one extra outlet in the business's currency. */
export async function outletPriceData(country: string) {
  const m = marketFor(country);
  return { currency: m.currency.toLowerCase(), product: await productFor("outlet"), unit_amount: Math.round(m.prices.outlet * 100), recurring: { interval: "month" as const } };
}

/** The subscription item that holds extra outlets, and the one that holds the plan. */
export function subscriptionItems(sub: Stripe.Subscription): { plan: Stripe.SubscriptionItem | null; outlets: Stripe.SubscriptionItem | null } {
  const items = sub.items.data;
  const outlets = items.find((i) => i.metadata?.kind === "outlet") ?? null;
  return { outlets, plan: items.find((i) => i !== outlets) ?? null };
}

/** A monthly price for the plan in the business's currency, from the price list. */
export async function priceData(plan: PlanId, country: string) {
  const m = marketFor(country);
  return {
    currency: m.currency.toLowerCase(),
    product: await productFor(plan),
    // Every currency we sell in has two decimal places in Stripe.
    unit_amount: Math.round(planPrice(planById(plan), m) * 100),
    recurring: { interval: "month" as const },
  };
}

/** Line item for Checkout: a fixed price from the environment if there is one, else the price list. */
export async function lineItem(plan: PlanId, country: string): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  const fixed = priceFor(plan, marketFor(country).currency);
  return fixed ? { price: fixed, quantity: 1 } : { price_data: await priceData(plan, country), quantity: 1 };
}

/** Price for a subscription item: a fixed price from the environment if there is one, else the price list. */
export async function fixedOrInline(plan: PlanId, country: string): Promise<{ price: string } | { price_data: Awaited<ReturnType<typeof priceData>> }> {
  const fixed = priceFor(plan, marketFor(country).currency);
  return fixed ? { price: fixed } : { price_data: await priceData(plan, country) };
}

/** Which plan a subscription is for: its metadata (set by us), else a fixed price from the environment. */
export function planOfSubscription(sub: Stripe.Subscription): PlanId | null {
  const meta = sub.metadata?.plan;
  if (meta && PLANS.some((p) => p.id === meta && p.id !== "free")) return meta as PlanId;
  return planForPrice(sub.items.data[0]?.price.id ?? "");
}

/**
 * Applies a finished Checkout session to its business. Used by the webhook and straight after the
 * customer returns from Stripe, so the plan changes without waiting for the webhook.
 */
export function applyCheckout(s: Stripe.Checkout.Session): boolean {
  const wsId = s.client_reference_id || s.metadata?.workspace_id;
  const plan = s.metadata?.plan;
  const subId = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
  // Bank transfers and other delayed methods complete the session before the money arrives.
  const paid = s.payment_status === "paid" || s.payment_status === "no_payment_required";
  if (!wsId || !plan || !subId || !paid || !PLANS.some((p) => p.id === plan)) return false;
  // Only once per subscription: a replayed webhook or a refreshed return page must not undo a plan
  // change made since (switching plans keeps the same subscription).
  db()
    .prepare(
      `UPDATE workspaces SET plan = ?, stripe_subscription_id = ?, stripe_customer_id = COALESCE(?, stripe_customer_id)
       WHERE id = ? AND (stripe_subscription_id IS NULL OR stripe_subscription_id != ?)`,
    )
    .run(plan, subId, typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null), wsId, subId);
  return true;
}

/** Public address of the app, for links Stripe sends people back to. APP_URL in production. */
export function appUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // Behind a proxy the request URL can say localhost; the Host header has the address the visitor used.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
