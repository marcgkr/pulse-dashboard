import type { Market } from "./markets";

// Brand + commercial settings live here so the name, domain and plans can change in one place.

export const BRAND = {
  name: "MarketingRx",
  tagline: "Your marketing, diagnosed. The fixes, prescribed. You do the rest.",
  domain: "marketingrx.ai",
  parent: "PULSE Digital",
  parentUrl: "https://pulsedigital.sg",
  contactEmail: "hello@marketingrx.ai",
  // Done-for-you upsell: where "Get PULSE to do this" sends people.
  doneForYouUrl:
    "https://wa.me/?text=" +
    encodeURIComponent("Hi PULSE Digital, I'd like you to implement a MarketingRx prescription for me."),
};

export type PlanId = "free" | "starter" | "growth" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number; // SGD reference price; per-country prices live in src/lib/markets.ts
  blurb: string;
  runsPerMonth: number;
  /** Ask PULSE messages a month (live AI only). */
  chatPerMonth: number;
  features: string[];
  stripePriceEnv?: string;
};

// Placeholder pricing. Adjust before launch.
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Checkup",
    priceMonthly: 0,
    blurb: "See what's wrong before you pay anything.",
    runsPerMonth: 5,
    chatPerMonth: 0,
    features: ["Site Doctor (1 site)", "5 agent runs a month", "Prescription board"],
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 99,
    blurb: "For owners who want a clear weekly to-do list.",
    runsPerMonth: 40,
    chatPerMonth: 300,
    features: [
      "Every specialist included",
      "40 agent runs a month",
      "Ask PULSE strategist chat",
      "Compliance check against your country's ad rules",
    ],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 249,
    blurb: "For businesses running Google and Meta ads every month.",
    runsPerMonth: 150,
    chatPerMonth: 1000,
    features: [
      "Everything in Starter",
      "150 agent runs a month",
      "Ads Doctor with Windsor.ai live sync",
      "AI Visibility tracking",
    ],
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 499,
    blurb: "For multi-outlet brands and in-house marketers.",
    runsPerMonth: 500,
    chatPerMonth: 3000,
    features: [
      "Everything in Growth",
      "500 agent runs a month",
      "Monthly 30-min review call with PULSE",
      "Priority support",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
];

/** Monthly price of a plan in a market's currency (0 for the free plan). */
export function planPrice(plan: Plan, market: Market): number {
  if (plan.id === "free") return 0;
  return market.prices[plan.id];
}

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
