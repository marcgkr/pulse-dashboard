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
  priceMonthly: number; // SGD
  blurb: string;
  runsPerMonth: number;
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
    features: ["Site Doctor (1 site)", "5 agent runs a month", "Prescription board"],
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 99,
    blurb: "For owners who want a clear weekly to-do list.",
    runsPerMonth: 40,
    features: [
      "Every specialist included",
      "40 agent runs a month",
      "Ask PULSE strategist chat",
      "Compliance check for SG healthcare ads",
    ],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 249,
    blurb: "For businesses running Google and Meta ads every month.",
    runsPerMonth: 150,
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
    features: [
      "Everything in Growth",
      "500 agent runs a month",
      "Monthly 30-min review call with PULSE",
      "Priority support",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
];

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
