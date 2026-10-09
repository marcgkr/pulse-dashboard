import type { Market } from "./markets";

// Brand + commercial settings live here so the name, domain and plans can change in one place.

export const BRAND = {
  name: "MarketingRx",
  tagline: "Your marketing, diagnosed. The fixes, prescribed. You do the rest.",
  domain: "marketingrx.ai",
  parent: "PULSE Digital",
  parentUrl: "https://pulsedigital.sg",
  // Every enquiry (contact links, done-for-you, guarantee claims, privacy requests) goes to this inbox.
  contactEmail: "info@pulsedigital.sg",
  // Done-for-you upsell: where "Get PULSE to do this" sends people. Opens an email to contactEmail.
  doneForYouUrl:
    "mailto:info@pulsedigital.sg?subject=" +
    encodeURIComponent("MarketingRx: done-for-you enquiry") +
    "&body=" +
    encodeURIComponent("Hi PULSE Digital,\n\nI'd like to book a free strategy call about MarketingRx.\n\nBusiness name:\nWebsite:\nMonthly ad spend (roughly):\n"),
  // FOUNDER TO APPROVE OR EDIT before launch: this is a promise to customers. Set to null to hide
  // the guarantee block on the homepage and pricing page.
  guarantee: {
    title: "The do-five guarantee",
    // Tied to the website score after a re-check, not the overall Pulse Score, because ticking slips
    // as done raises the Pulse Score by itself.
    body: "Do the first five prescriptions Site Doctor gives you, then run the checkup again. If your website score hasn't gone up within 30 days, tell us and we'll refund that month.",
  } as { title: string; body: string } | null,
  // What PULSE Digital's done-for-you service covers. Shown on the done-for-you tier and section.
  // FOUNDER TO CHECK: keep only services PULSE actually sells.
  doneForYouServices: [
    { group: "Paid ads", items: ["Google Ads (Search, Performance Max, YouTube)", "Meta Ads (Facebook and Instagram)", "TikTok Ads", "LinkedIn Ads"] },
    { group: "Search", items: ["SEO: technical fixes, on-page and content", "AEO and GEO: getting named in ChatGPT, Perplexity and Google AI answers", "Google Business Profile and local listings"] },
    { group: "Website and content", items: ["Implements every MarketingRx prescription for you", "Landing pages built to convert ad traffic", "Social content plans and captions"] },
    { group: "Tracking and reporting", items: ["Conversion tracking set up properly (GA4, Meta Pixel, Google Ads)", "Monthly report and strategy call"] },
  ] as { group: string; items: string[] }[],
  // DRAFT for Marcus to rewrite in his own words. Shown on the homepage next to the done-for-you
  // offer. Set to "" to hide it.
  founderNote:
    "Most businesses that come to PULSE Digital don't need a bigger ad budget first. They need the fixes we make for almost every new client: a clear headline, an easy way to message them, tracking that works and ads that stop paying for the wrong clicks. I built MarketingRx so owners who aren't ready for an agency can get that same list and do the work themselves.",
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
  /** One line on who the plan suits, shown on plan cards. */
  forWho: string;
  /** Specialists the plan can use. */
  specialists: AgentKey[];
};

export type AgentKey = "site" | "keywords" | "visibility" | "content" | "ads" | "compliance";
const ALL_SPECIALISTS: AgentKey[] = ["site", "keywords", "visibility", "content", "ads", "compliance"];

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
    forWho: "Try it on your own website before you pay anything.",
    specialists: ["site"],
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
    forWho: "Owners who do their own marketing and want a clear weekly to-do list.",
    specialists: ALL_SPECIALISTS,
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
      "Ads Doctor with live ad sync",
      "AI Visibility tracking",
    ],
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
    forWho: "Businesses spending on Google or Meta ads every month.",
    specialists: ALL_SPECIALISTS,
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
    forWho: "Multi-outlet brands and in-house marketers who want PULSE checking in.",
    specialists: ALL_SPECIALISTS,
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

/** Plans that can sync ad accounts live (others upload exports). Enforced in startRun. */
export const LIVE_SYNC_PLANS: PlanId[] = ["growth", "pro"];

/**
 * What each plan includes, as rows that line up across plan cards and the comparison table.
 * `value` is shown instead of a tick when a row has a per-plan amount.
 */
export type PlanRow = { label: string; detail?: string; value: (p: Plan) => boolean | string };

export const PLAN_ROWS: PlanRow[] = [
  {
    label: "Agent runs a month",
    detail: "One run is one report from any specialist, for example one Site Doctor checkup.",
    value: (p) => `${p.runsPerMonth}`,
  },
  { label: "Prescription board with re-check dates", value: () => true },
  { label: "Ask PULSE strategist chat", value: (p) => (p.chatPerMonth > 0 ? `${p.chatPerMonth.toLocaleString("en")} messages` : false) },
  { label: "Ads Doctor from Google and Meta exports", value: (p) => p.specialists.includes("ads") },
  { label: "Live sync from your Google Ads and Meta Ads accounts", value: (p) => LIVE_SYNC_PLANS.includes(p.id) },
  { label: "Compliance Check for your country's ad rules", value: (p) => p.specialists.includes("compliance") },
  { label: "Monthly 30-minute review call with PULSE", value: (p) => p.id === "pro" },
  { label: "Priority support", value: (p) => p.id === "pro" },
];

/** Plain-language translation of a monthly run allowance. */
export function runsInPlainWords(runs: number): string {
  if (runs <= 5) return `${runs} reports a month`;
  const perWeek = Math.floor(runs / 4.3);
  return `${runs} reports a month, about ${perWeek} a week`;
}
