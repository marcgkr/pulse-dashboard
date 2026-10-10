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
  /** Outlets included. Pro can add more for a monthly fee each (extraOutlets), up to maxOutlets in all. */
  businesses: number;
  /** Most outlets one account can run on this plan, extras included. */
  maxOutlets: number;
  /** Extra outlets can be bought on this plan, at the market's outlet price each a month. */
  extraOutlets: boolean;
  /** Weekly Site Doctor and monthly AI Visibility re-checks run on their own (src/lib/autopilot.ts). */
  autopilot: boolean;
  /** How many of the latest connected videos get transcribed (src/lib/videos.ts). */
  transcribeVideos: number;
  /** What only this plan gets, called out at the top of its card. */
  exclusives?: string[];
};

export type AgentKey = "site" | "keywords" | "visibility" | "content" | "ads" | "compliance";
const ALL_SPECIALISTS: AgentKey[] = ["site", "keywords", "visibility", "content", "ads", "compliance"];

// Placeholder pricing. Adjust before launch.
// A "report" is one finished run of one specialist. Allowances are sized for real use (one business
// using every specialist lands around 30 to 60 a month) so the AI bill stays predictable.
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Checkup",
    priceMonthly: 0,
    blurb: "See what's wrong before you pay anything.",
    runsPerMonth: 5,
    chatPerMonth: 0,
    features: ["Site Doctor (1 site)", "5 reports a month", "Prescription board"],
    forWho: "Try it on your own website before you pay anything.",
    specialists: ["site"],
    businesses: 1,
    maxOutlets: 1,
    extraOutlets: false,
    autopilot: false,
    transcribeVideos: 0,
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 99,
    blurb: "For owners who want a clear weekly to-do list.",
    runsPerMonth: 20,
    chatPerMonth: 0,
    features: ["Every specialist included", "20 reports a month", "Connect your ad and social accounts", "Compliance check against your country's ad rules", "Download reports as PDF"],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    forWho: "Owners who do their own marketing and want a clear weekly to-do list.",
    specialists: ALL_SPECIALISTS,
    businesses: 1,
    maxOutlets: 1,
    extraOutlets: false,
    autopilot: false,
    transcribeVideos: 0,
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 249,
    blurb: "For businesses running Google and Meta ads every month.",
    runsPerMonth: 50,
    chatPerMonth: 1000,
    features: ["Everything in Starter", "50 reports a month", "Ask PULSE strategist chat", "Ads Doctor with live Google and Meta ad sync", "Your latest 20 videos transcribed, so ideas and articles build on them"],
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
    forWho: "Businesses spending on Google or Meta ads every month.",
    specialists: ALL_SPECIALISTS,
    businesses: 1,
    maxOutlets: 1,
    extraOutlets: false,
    autopilot: false,
    transcribeVideos: 20,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 499,
    blurb: "For owners who want everything, including their Google Business Profile.",
    runsPerMonth: 300,
    chatPerMonth: 3000,
    features: [
      "Everything in Growth",
      "300 reports a month, shared across your outlets",
      "Google Business Profile: fixes and post ideas",
      "Your latest 100 videos transcribed",
      "Autopilot: your website re-checked every week, your AI visibility every month",
      "Priority support on WhatsApp",
      "3 outlets included, each with its own Google Business Profile",
      "Up to 2 more outlets at a monthly fee each",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
    forWho: "Owners who want every specialist, their Google Business Profile and a person on WhatsApp when they're stuck.",
    specialists: ALL_SPECIALISTS,
    businesses: 3,
    maxOutlets: 5,
    extraOutlets: true,
    autopilot: true,
    transcribeVideos: 100,
    exclusives: [
      "Google Business Profile connected: profile fixes and post ideas",
      "Autopilot: your website re-checked every week and your AI visibility every month",
      "Priority support on WhatsApp with the PULSE team",
      "3 outlets included, each with its own Google Business Profile, set up in Settings",
    ],
  },
];

/**
 * How many businesses or outlets an account can run: the plan's included one, plus extra outlets
 * paid for on Pro. Pass the account's first business (it holds the plan).
 */
export function outletLimit(primary: { plan: string; extra_outlets?: number }): number {
  const plan = planById(primary.plan);
  return Math.min(plan.maxOutlets, plan.businesses + (plan.extraOutlets ? Math.max(0, primary.extra_outlets ?? 0) : 0));
}

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
    label: "Reports a month",
    detail: "A report is one finished piece of work from a specialist, for example one website checkup, one keyword plan or one 2-week content plan.",
    value: (p) => `${p.runsPerMonth}`,
  },
  { label: "Connect your ad and social accounts", value: (p) => p.id !== "free" },
  { label: "Latest videos transcribed", value: (p) => (p.transcribeVideos > 0 ? `${p.transcribeVideos}` : false) },
  { label: "Google Business Profile: fixes and post ideas", value: (p) => p.id === "pro" },
  { label: "Outlets of the same business", value: (p) => (p.maxOutlets > 1 ? `${p.businesses} included, up to ${p.maxOutlets}` : "1") },
  { label: "Prescription board with re-check dates", value: () => true },
  { label: "Ask PULSE strategist chat", value: (p) => p.chatPerMonth > 0 },
  { label: "Ads Doctor from Google and Meta exports", value: (p) => p.specialists.includes("ads") },
  { label: "Compliance Check for your country's ad rules", value: (p) => p.specialists.includes("compliance") },
  { label: "Download reports as PDF", value: (p) => p.id !== "free" },
  { label: "Live sync from your Google Ads and Meta Ads accounts", value: (p) => LIVE_SYNC_PLANS.includes(p.id) },
  {
    label: "Autopilot re-checks",
    detail: "Site Doctor re-checks your website every week and AI Visibility re-asks your questions every month, on their own. They don't use your monthly reports.",
    value: (p) => p.autopilot,
  },
  { label: "Live chat with the PULSE team", value: () => true },
  { label: "Priority support on WhatsApp", value: (p) => p.id === "pro" },
];

/** Plain-language translation of a plan's monthly report allowance. */
export function runsInPlainWords(plan: Pick<Plan, "runsPerMonth" | "businesses">): string {
  const runs = plan.runsPerMonth;
  return runs === 1 ? "1 report a month" : `${runs} reports a month`;
}
