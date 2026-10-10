import type { WorkspaceRow } from "./db";
import type { Prescription } from "./ai";
import { formatPrice, type Market } from "./markets";
import type { AgentContext, AgentId, AgentResult } from "./agents/types";
import { scoreChecks, type Check, type SiteAudit } from "./agents/site-audit";
import { rulePrescriptions } from "./agents/site";
import { keywordsAgent } from "./agents/keywords";
import { visibilityAgent } from "./agents/visibility";
import { contentAgent } from "./agents/content";
import { adsAgent } from "./agents/ads";
import { complianceAgent } from "./agents/compliance";
import type { ReportInput } from "./agents/ads-data";
import type { ContentResult, Idea } from "./agents/content-demo";
import type { Reference } from "./social-links";

// The public sample report (/sample). A small set of fictional businesses in the visitor's market,
// run through the real agents' demo() functions at request time. None of these touch the network:
// keywords, visibility, content, ads (sample CSV exports through the real parser) and compliance
// (text only) are pure. Site Doctor's demo crawls a real site, so each business gets a static audit
// fixture below instead, scored with the same rules as the live checkup.

export const SAMPLE_RUN_ID = "sample";

export type SampleBusinessId = "renovation" | "cafe" | "store" | "clinic";
export const SAMPLE_BUSINESS_IDS: SampleBusinessId[] = ["renovation", "cafe", "store", "clinic"];
export const DEFAULT_SAMPLE_BUSINESS: SampleBusinessId = "renovation";

/** "?business=cafe" -> "cafe"; anything else -> the default. */
export function sampleBusinessId(raw: unknown): SampleBusinessId {
  const v = String(Array.isArray(raw) ? raw[0] : (raw ?? "")).toLowerCase();
  return (SAMPLE_BUSINESS_IDS as string[]).includes(v) ? (v as SampleBusinessId) : DEFAULT_SAMPLE_BUSINESS;
}

export type SampleBusiness = {
  id: SampleBusinessId;
  name: string;
  /** "renovation company" */
  kind: string;
  /** "a renovation company" */
  withArticle: string;
  /** What it does, to follow its name and place: "doing kitchens, bathrooms and ..." */
  sells: string;
  platform: string;
  regulated: boolean;
};

export const SAMPLE_BUSINESSES: Record<SampleBusinessId, SampleBusiness> = {
  renovation: {
    id: "renovation",
    name: "Brickhouse Renovations",
    kind: "renovation company",
    withArticle: "a renovation company",
    sells: "doing kitchens, bathrooms and full home renovations",
    platform: "WordPress",
    regulated: false,
  },
  cafe: {
    id: "cafe",
    name: "Saltwater Cafe",
    kind: "cafe",
    withArticle: "a cafe",
    sells: "serving brunch and coffee, with a catering side for offices and events",
    platform: "Squarespace",
    regulated: false,
  },
  store: {
    id: "store",
    name: "Linden & Loft",
    kind: "online homeware store",
    withArticle: "an online store",
    sells: "selling linen bedding, stoneware and candles online through Shopify",
    platform: "Shopify",
    regulated: false,
  },
  clinic: {
    id: "clinic",
    name: "Lumen Aesthetics",
    kind: "aesthetic clinic",
    withArticle: "a clinic",
    sells: "offering skin treatments in a category with strict advertising rules",
    platform: "WordPress",
    regulated: true,
  },
};

export type SampleReport = {
  agent: AgentId;
  result: AgentResult;
  run: { id: string; agent: string; title: string; created_at: string; input: Record<string, unknown> };
};

// ---------- Shared context ----------

type Ctx = {
  m: Market;
  /** The neighbourhood the business is in. */
  area: string;
  /** The country for sentences, or the made-up area when the market is "Anywhere else". */
  country: string;
  /** "WhatsApp us", "Message us on Messenger", "Call or text us" */
  chatUs: string;
  /** "WhatsApp button", "tap-to-call or tap-to-text link" */
  chatThing: string;
};

/** Where the fictional businesses are. "Anywhere else" has no real place, so it gets a made-up one. */
function sampleArea(m: Market): string {
  return m.code === "INTL" ? "Riverside" : m.exampleArea;
}

function ctxOf(m: Market): Ctx {
  const area = sampleArea(m);
  return {
    m,
    area,
    country: m.code === "INTL" ? area : m.name,
    chatUs: m.messaging === "SMS" ? "Call or text us" : m.messaging === "WhatsApp" ? "WhatsApp us" : `Message us on ${m.messaging}`,
    chatThing: m.messaging === "SMS" ? "tap-to-call or tap-to-text link" : `${m.messaging} button`,
  };
}

// ---------- Site Doctor fixture ----------

type SiteFixture = {
  platform: string;
  ms: number;
  bytes: number;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  words: number;
  images: number;
  missingAlt: number;
  phoneLinks: number;
  whatsappLinks: number;
  emailLinks: number;
  forms: number;
  bookingWidget: string;
  trackers: string[];
  schemaTypes: string[];
  pages: { path: string; title: string; description: string; words: number }[];
};

/**
 * The checks for a fixture, worded and scored the same way as buildChecks() in site-audit.ts
 * (HTTPS on, robots.txt and sitemap found, no llms.txt, every inner page loads).
 */
function checksFor(f: SiteFixture, m: Market): Check[] {
  const where = m.code === "INTL" ? "For many customers" : `In ${m.inPhrase}`;
  const chat =
    m.messaging === "SMS"
      ? {
          id: "messaging",
          label: "Tap-to-text or click-to-call",
          ok: f.phoneLinks > 0,
          countLabel: `WhatsApp links: ${f.whatsappLinks}, text (sms:) links: 0, forms: `,
          detail:
            f.phoneLinks > 0
              ? `Tap-to-call links: ${f.phoneLinks}, tap-to-text links: 0.`
              : `No tap-to-call or tap-to-text link. ${where} many customers call or text a local business straight from their phone.`,
        }
      : m.messaging === "Messenger"
        ? { id: "messaging", label: "Messenger click-to-chat", ok: false, countLabel: `Messenger links: 0, WhatsApp links: ${f.whatsappLinks}, forms: `, detail: `No Messenger (m.me) link. ${where} this is often the fastest way customers enquire.` }
        : m.messaging === "LINE"
          ? { id: "messaging", label: "LINE click-to-chat", ok: false, countLabel: `LINE links: 0, WhatsApp links: ${f.whatsappLinks}, forms: `, detail: `No LINE link. ${where} this is often the fastest way customers enquire.` }
          : {
              id: "whatsapp",
              label: "WhatsApp click-to-chat",
              ok: f.whatsappLinks > 0,
              countLabel: `WhatsApp links: ${f.whatsappLinks}, forms: `,
              detail: f.whatsappLinks > 0 ? "WhatsApp link found." : `No WhatsApp link. ${where} this is often the fastest way customers enquire.`,
            };
  const out: Check[] = [];
  const add = (id: string, group: Check["group"], label: string, status: Check["status"], detail: string, weight = 1) => out.push({ id, group, label, status, detail, weight });

  add("https", "Technical", "Secure connection (HTTPS)", "pass", "Site loads over HTTPS.", 3);
  add("viewport", "Technical", "Mobile-friendly viewport", "pass", "Viewport tag present.", 3);
  add("speed", "Technical", "Server response time", f.ms < 1200 ? "pass" : f.ms < 3000 ? "warn" : "fail", `Homepage HTML arrived in ${(f.ms / 1000).toFixed(1)}s from our server.`, 2);
  add("weight", "Technical", "Page weight", f.bytes < 400_000 ? "pass" : f.bytes < 1_000_000 ? "warn" : "fail", `Homepage HTML is ${Math.round(f.bytes / 1024)} KB before images and scripts.`, 1);
  add("robots", "Technical", "robots.txt", "pass", "Found.", 1);
  add("sitemap", "Technical", "XML sitemap", "pass", "Found.", 2);
  add("noindex", "Technical", "Homepage is indexable", "pass", "No noindex tag on the homepage.", 4);
  add("broken", "Technical", "Inner pages load", "pass", `All ${f.pages.length} inner pages we opened loaded.`, 2);
  add("lang", "Technical", "Language declared", "pass", 'lang="en"', 1);

  const tl = f.title.length;
  add("title", "On-page", "Homepage title", tl < 25 || tl > 65 ? "warn" : "pass", `"${f.title}" (${tl} characters; 30 to 60 reads best in Google).`, 3);
  const dl = f.description.length;
  add(
    "description",
    "On-page",
    "Meta description",
    !f.description ? "fail" : dl < 70 || dl > 165 ? "warn" : "pass",
    f.description ? `${dl} characters.` : "No meta description, so Google picks a random snippet.",
    2,
  );
  add(
    "h1",
    "On-page",
    "One clear H1 headline",
    f.h1.length === 1 ? "pass" : f.h1.length === 0 ? "fail" : "warn",
    f.h1.length === 0 ? "No H1 on the homepage." : f.h1.length === 1 ? `"${f.h1[0]}"` : `${f.h1.length} H1 tags found.`,
    2,
  );
  add("content", "On-page", "Enough words on the homepage", f.words >= 400 ? "pass" : f.words >= 200 ? "warn" : "fail", `About ${f.words} words of readable text.`, 2);
  add(
    "alt",
    "On-page",
    "Image alt text",
    f.missingAlt === 0 ? "pass" : f.missingAlt / f.images > 0.3 ? "fail" : "warn",
    `${f.missingAlt} of ${f.images} images have no alt text.`,
    1,
  );
  const titles = f.pages.map((p) => p.title.toLowerCase());
  const dup = titles.length - new Set(titles).size;
  const missingMeta = f.pages.filter((p) => !p.description).length;
  add(
    "inner-meta",
    "On-page",
    "Inner page titles and descriptions",
    dup === 0 && missingMeta === 0 ? "pass" : dup + missingMeta > 2 ? "fail" : "warn",
    `${dup} duplicate title(s), ${missingMeta} page(s) missing a meta description, out of ${f.pages.length} checked.`,
    2,
  );
  add("og", "On-page", "Social share preview", "pass", "Open Graph title and image set.", 1);
  add("canonical", "On-page", "Canonical tag", "pass", "Set.", 1);

  const paths = f.phoneLinks + f.whatsappLinks + f.forms + (f.bookingWidget ? 1 : 0);
  add(
    "contact",
    "Conversion",
    "Easy ways to get in touch",
    paths >= 2 ? "pass" : paths === 1 ? "warn" : "fail",
    `Tap-to-call links: ${f.phoneLinks}, ${chat.countLabel}${f.forms}${f.bookingWidget ? `, booking: ${f.bookingWidget}` : ""}.`,
    4,
  );
  add(chat.id, "Conversion", chat.label, chat.ok ? "pass" : "warn", chat.detail, 2);
  add(
    "booking",
    "Conversion",
    "Online booking or enquiry form",
    f.bookingWidget || f.forms > 0 ? "pass" : "warn",
    f.bookingWidget ? `${f.bookingWidget} detected.` : f.forms > 0 ? "Enquiry form found." : "No booking tool or form on the homepage.",
    2,
  );

  const analytics = f.trackers.some((t) => t.includes("Analytics") || t.includes("Tag Manager"));
  add("analytics", "Tracking", "Website analytics", analytics ? "pass" : "fail", analytics ? f.trackers.join(", ") : "No Google Analytics or Tag Manager found. You can't see where customers come from.", 3);
  const adsTag = f.trackers.some((t) => t === "Meta Pixel" || t === "Google Ads tag" || t === "Google Tag Manager");
  add("ad-pixels", "Tracking", "Ad conversion tracking", adsTag ? "pass" : "warn", adsTag ? "Ad tracking present." : "No Meta Pixel or Google Ads tag found. Ads can't learn who converts.", 2);

  const st = f.schemaTypes;
  const biz = st.some((t) => /LocalBusiness|Organization|MedicalClinic|Store|Restaurant|CafeOrCoffeeShop|GeneralContractor/i.test(t));
  add("schema-biz", "AI search", "Business schema markup", biz ? "pass" : "fail", st.length ? `Schema types: ${st.join(", ")}` : "No structured data. AI assistants and Google have to guess what you are.", 3);
  const faq = st.includes("FAQPage") || f.h2.some((x) => /faq|frequently asked|questions/i.test(x));
  add("faq", "AI search", "Answers to common questions", faq ? "pass" : "warn", faq ? "FAQ content found." : "No FAQ section. Question-and-answer content is what AI assistants quote.", 2);
  add("llms", "AI search", "llms.txt file", "warn", "No /llms.txt. It's a simple file that tells AI assistants what your business does.", 1);
  return out;
}

function siteAudit(f: SiteFixture, domain: string, m: Market): SiteAudit {
  const checks = checksFor(f, m);
  const { score, groupScores } = scoreChecks(checks);
  const base = `https://www.${domain}`;
  const page = (path: string, title: string, description: string, words: number) => ({
    url: base + path,
    status: 200,
    ms: 900,
    title,
    description,
    h1: [title.split(" | ")[0]],
    h2: [],
    wordCount: words,
    canonical: base + path,
    noindex: false,
    bytes: 180_000,
  });
  return {
    url: base + "/",
    finalUrl: base + "/",
    host: `www.${domain}`,
    platform: f.platform,
    home: {
      ...page("/", f.title, f.description, f.words),
      ms: f.ms,
      h1: f.h1,
      h2: f.h2,
      bytes: f.bytes,
      lang: "en",
      viewport: true,
      ogTitle: f.title,
      ogImage: `${base}/og.jpg`,
      schemaTypes: f.schemaTypes,
      imagesTotal: f.images,
      imagesMissingAlt: f.missingAlt,
      internalLinks: 38,
      phoneLinks: f.phoneLinks,
      whatsappLinks: f.whatsappLinks,
      smsLinks: 0,
      messengerLinks: 0,
      lineLinks: 0,
      emailLinks: f.emailLinks,
      forms: f.forms,
      bookingWidget: f.bookingWidget,
      trackers: f.trackers,
      textSample: "",
    },
    pages: f.pages.map((p) => page(p.path, p.title, p.description, p.words)),
    robotsTxt: true,
    sitemap: true,
    llmsTxt: false,
    https: true,
    pageSpeed: null,
    market: m.code,
    checks,
    score,
    groupScores,
  };
}

// ---------- Ads Doctor sample exports ----------
// Written in the exact shape of a Google Ads campaign report, a Google Ads search terms report and a
// Meta Ads Manager ad set export, then read by the real parser. Rates are worked out from the counts
// so every row adds up. All numbers are sample data.

type GoogleCampaign = { name: string; type: string; impr: number; clicks: number; cost: number; conv: number; share: string; value?: number };
type SearchTerm = { term: string; match: string; campaign: string; group: string; clicks: number; impr: number; cost: number; conv: number };
type MetaAdSet = { campaign: string; adset: string; results: number; indicator: string; reach: number; impr: number; spend: number; clicks: number; value?: number };

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
const int = (n: number) => (n >= 1000 ? quote(n.toLocaleString("en-US")) : String(n));
const dec = (n: number) => {
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 1000 ? quote(s) : s;
};
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(2)}%` : "0.00%");
const per = (a: number, b: number) => (b ? dec(a / b) : "0.00");
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);

/** Last full calendar month, in Google's and Meta's date formats. */
function lastMonth(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const long = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { google: `${long(start)} - ${long(end)}`, start: iso(start), end: iso(end) };
}

function googleCampaignsCsv(rows: GoogleCampaign[], cur: string): string {
  const withValue = rows.some((r) => r.value != null);
  const head = `Campaign status,Campaign,Campaign type,Impr.,Clicks,CTR,Currency code,Avg. CPC,Cost,Search impr. share,Conversions,Cost / conv.,Conv. rate${withValue ? ",Conv. value" : ""}`;
  const line = (status: string, name: string, type: string, impr: number, clicks: number, cost: number, share: string, conv: number, value?: number) =>
    [status, name, type, int(impr), int(clicks), pct(clicks, impr), cur, per(cost, clicks), dec(cost), share, dec(conv), per(cost, conv), pct(conv, clicks), ...(withValue ? [dec(value ?? 0)] : [])].join(",");
  const T = { impr: sum(rows, (r) => r.impr), clicks: sum(rows, (r) => r.clicks), cost: sum(rows, (r) => r.cost), conv: sum(rows, (r) => r.conv), value: sum(rows, (r) => r.value ?? 0) };
  return [
    "Campaign report",
    quote(lastMonth().google),
    head,
    ...rows.map((r) => line("Enabled", r.name, r.type, r.impr, r.clicks, r.cost, r.share, r.conv, r.value)),
    line("Total: Account", "--", "--", T.impr, T.clicks, T.cost, "--", T.conv, T.value),
    "",
  ].join("\n");
}

function searchTermsCsv(rows: SearchTerm[], cur: string): string {
  const line = (t: SearchTerm) =>
    [t.term, t.match, "None", t.campaign, t.group, int(t.clicks), int(t.impr), pct(t.clicks, t.impr), cur, per(t.cost, t.clicks), dec(t.cost), dec(t.conv), per(t.cost, t.conv)].join(",");
  const T = { clicks: sum(rows, (r) => r.clicks), impr: sum(rows, (r) => r.impr), cost: sum(rows, (r) => r.cost), conv: sum(rows, (r) => r.conv) };
  return [
    "Search terms report",
    quote(lastMonth().google),
    "Search term,Match type,Added/Excluded,Campaign,Ad group,Clicks,Impr.,CTR,Currency code,Avg. CPC,Cost,Conversions,Cost / conv.",
    ...rows.map(line),
    ["Total: Search terms", "--", "--", "--", "--", int(T.clicks), int(T.impr), pct(T.clicks, T.impr), cur, per(T.cost, T.clicks), dec(T.cost), dec(T.conv), per(T.cost, T.conv)].join(","),
    "",
  ].join("\n");
}

function metaAdSetsCsv(rows: MetaAdSet[], cur: string): string {
  const withValue = rows.some((r) => r.value != null);
  const { start, end } = lastMonth();
  const head = [
    "Reporting starts",
    "Reporting ends",
    "Campaign name",
    "Ad set name",
    "Ad set delivery",
    "Results",
    "Result indicator",
    "Reach",
    "Frequency",
    "Cost per result",
    `Amount spent (${cur})`,
    "Impressions",
    `CPM (cost per 1,000 impressions) (${cur})`,
    "Link clicks",
    `CPC (cost per link click) (${cur})`,
    "CTR (link click-through rate)",
    ...(withValue ? ["Purchases conversion value", "Purchase ROAS (return on ad spend)"] : []),
  ];
  const plain = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const cells = (r: MetaAdSet) => [
    start,
    end,
    r.campaign,
    r.adset,
    "active",
    r.results.toLocaleString("en-US"),
    r.indicator,
    r.reach.toLocaleString("en-US"),
    plain(r.impr / r.reach),
    r.results ? plain(r.spend / r.results) : "",
    plain(r.spend),
    r.impr.toLocaleString("en-US"),
    plain((r.spend / r.impr) * 1000),
    r.clicks.toLocaleString("en-US"),
    plain(r.spend / r.clicks),
    plain((r.clicks / r.impr) * 100),
    ...(withValue ? [plain(r.value ?? 0), plain((r.value ?? 0) / r.spend)] : []),
  ];
  const T = { spend: sum(rows, (r) => r.spend), impr: sum(rows, (r) => r.impr), clicks: sum(rows, (r) => r.clicks), value: sum(rows, (r) => r.value ?? 0) };
  const total = [
    start,
    end,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    plain(T.spend),
    T.impr.toLocaleString("en-US"),
    plain((T.spend / T.impr) * 1000),
    T.clicks.toLocaleString("en-US"),
    plain(T.spend / T.clicks),
    plain((T.clicks / T.impr) * 100),
    ...(withValue ? [plain(T.value), plain(T.value / T.spend)] : []),
  ];
  return [head, total, ...rows.map(cells)].map((r) => r.map(quote).join(",")).join("\n") + "\n";
}

const LEAD = "actions:onsite_conversion.lead_grouped";
const MESSAGES = "actions:onsite_conversion.messaging_conversation_started_7d";
const PURCHASE = "actions:offsite_conversion.fb_pixel_purchase";
const LINK_CLICK = "actions:link_click";

/** Campaign name and result type for a chat-led campaign, in the market's messaging habit. */
function chatCampaign(m: Market) {
  return m.messaging === "SMS" ? { name: "Calls", indicator: LEAD } : { name: m.messaging, indicator: MESSAGES };
}

function exportsOf(slug: string, cur: string, g: GoogleCampaign[], t: SearchTerm[], meta: MetaAdSet[]): ReportInput[] {
  return [
    { platform: "google", filename: `sample-${slug}-google-campaigns.csv`, csv: googleCampaignsCsv(g, cur) },
    { platform: "google", filename: `sample-${slug}-google-search-terms.csv`, csv: searchTermsCsv(t, cur) },
    { platform: "meta", filename: `sample-${slug}-meta-ad-sets.csv`, csv: metaAdSetsCsv(meta, cur) },
  ];
}

// ---------- Compliance for businesses outside regulated categories ----------

/** Why each flag matters under general advertising standards (shown instead of the healthcare wording). */
const GENERAL_WHY: Record<string, string> = {
  Superlative:
    "Claims like 'best' or 'cheapest' can be read as facts. Advertising codes expect you to hold proof for any claim a customer could check, such as a price or a ranking.",
  "Guarantee / absolute claim":
    "A guarantee or '100%' line is a promise to every customer. If you make one, you need to keep it, and the terms (what is covered, for how long, how to claim) should be easy to find.",
  "Testimonial / endorsement":
    "Reviews, ratings and customer counts in ads must be genuine and current, and you should be able to show the records behind them.",
  "Urgency / pressure":
    "Deadlines and 'only a few left' lines must be true. Scarcity that resets every week can count as misleading.",
  "Comparative claim": "Comparing yourself with competitors is fine only when the comparison is fair, like for like, and you can prove it.",
  "Unsupported health claim":
    "'Clinically proven' needs published evidence for this exact product, and health wording can bring a homeware product under stricter rules. 'Organic' claims usually need a certificate.",
  "Before and after": "Before-and-after pictures must be real, unedited and show your own work.",
};

const GENERAL_FIX: Record<string, { title: string; steps: string[] }> = {
  Superlative: {
    title: "Swap 'best' and 'cheapest' for facts you can prove",
    steps: ["Delete ranking words such as 'best', 'No. 1' and 'cheapest' unless you hold independent proof.", "Say something a customer can check instead: years trading, a starting price, a written policy."],
  },
  "Guarantee / absolute claim": {
    title: "Turn the guarantee into terms you can keep",
    steps: ["Remove '100%' and 'guaranteed' lines you can't honour for every customer.", "If you do offer a guarantee, say what it covers, for how long and how to claim, in the ad or one click away."],
  },
  "Testimonial / endorsement": {
    title: "Use reviews and numbers you can back up",
    steps: ["Quote real reviews word for word and keep a note of where each one came from.", "Use star ratings and customer counts only if your current Google rating or your sales records match them."],
  },
  "Urgency / pressure": {
    title: "Give a real deadline or drop the pressure line",
    steps: ["Remove 'only 3 slots left', 'act now' and 'today only' unless they are true for the whole time the ad runs.", "If there is a real deadline, state the date."],
  },
  "Comparative claim": {
    title: "Compare like for like, or describe yourself instead",
    steps: ["Remove 'better than any other' lines unless you can show a fair, current comparison.", "Describe what you offer, not what competitors don't."],
  },
  "Unsupported health claim": {
    title: "Back up or remove 'clinically proven' and 'organic'",
    steps: ["Remove 'clinically proven' unless a published study tested this exact product.", "Keep 'organic' only if you hold the certificate, and name the certifying body on the page."],
  },
  "Before and after": {
    title: "Show real before-and-after photos of your own work",
    steps: ["Use only unedited photos of jobs you did, with the customer's permission.", "Add a line on what was done and how long it took."],
  },
};

function generalCompliancePrescriptions(issues: { rule: string; highlight: string; severity: string }[], channel: string): Prescription[] {
  const where =
    channel === "Meta ad"
      ? "Meta Ads Manager > Ad > Primary text and headline"
      : channel === "Instagram post"
        ? "Instagram > Post > Edit caption"
        : channel === "Website"
          ? "Your website editor > the page you checked"
          : "Wherever this copy is published";
  const families = [...new Set(issues.map((i) => i.rule))].filter((f) => GENERAL_FIX[f]);
  return families.slice(0, 5).map((fam) => {
    const items = issues.filter((i) => i.rule === fam);
    const sev = items.some((i) => i.severity === "high") ? "high" : items.some((i) => i.severity === "medium") ? "medium" : "low";
    return {
      title: GENERAL_FIX[fam].title,
      diagnosis: `${items.length} line${items.length === 1 ? "" : "s"} flagged, e.g. "${items[0].highlight}". ${GENERAL_WHY[fam]}`,
      steps: [...GENERAL_FIX[fam].steps, "Paste the rewritten version from this report, then re-run Compliance Check."],
      where,
      priority: sev === "high" ? "urgent" : sev === "medium" ? "high" : "medium",
      impact: sev === "high" ? "high" : "medium",
      effort: "quick",
      category: "Compliance",
      recheck_days: 7,
    } satisfies Prescription;
  });
}

const FAMILY_WORDS_GENERAL: Record<string, string> = {
  Superlative: "a ranking claim",
  "Guarantee / absolute claim": "a guarantee",
  "Testimonial / endorsement": "reviews and customer counts",
  "Before and after": "before-and-after photos",
  "Inducement / discount": "a discount",
  "Urgency / pressure": "pressure lines",
  "Comparative claim": "a comparison with competitors",
  "Personal attributes": "a line about the reader",
  "Unsupported health claim": "a 'clinically proven' style claim",
};

const FAMILY_WORDS_CLINIC: Record<string, string> = {
  ...FAMILY_WORDS_GENERAL,
  "Testimonial / endorsement": "a patient testimonial",
  "Comparative claim": "a comparison with other providers",
  "Personal attributes": "a line about the reader's body",
  "Unsupported health claim": "an unsupported health claim",
};

// ---------- The businesses ----------

type Spec = {
  domain: string;
  profile: (c: Ctx) => Pick<WorkspaceRow, "industry" | "location" | "audience" | "offers" | "competitors" | "goals" | "monthly_budget" | "tone">;
  site: (c: Ctx) => SiteFixture & {
    summary: (missingChat: boolean) => string;
    strengths: string[];
    rewrite: { title: string; meta_description: string; h1: string };
    faq: { question: string; answer: string }[];
  };
  keywords: (c: Ctx) => { seeds: string; location?: string; data?: string; summary: string };
  visibility: (c: Ctx) => { prompts: string[]; asker: string };
  content: { platforms: string[]; avoid?: string; summary: (c: Ctx) => string };
  /** Sample exports, or null for the built-in Ads Doctor sample account. */
  ads: ((c: Ctx) => ReportInput[]) | null;
  adCopy?: (c: Ctx) => { google_headlines: string[]; google_descriptions: string[] };
  compliance: (c: Ctx) => { text: string; channel: string; category?: string; what: string; rewrite: string; checklist?: string[]; fixes?: [string, string][] };
  /** Wording swaps applied to every string the shared sample code wrote (examples, schema types). */
  retext: (c: Ctx) => [RegExp, string][];
  /** Last edits to the finished reports, for template output that doesn't fit the business. */
  patch?: (r: Record<Exclude<AgentId, "gbp">, AgentResult>, c: Ctx) => void;
};

const SPECS: Record<SampleBusinessId, Spec> = {
  // A home renovation contractor. The default sample.
  renovation: {
    domain: "brickhouse-renovations.example",
    profile: (c) => ({
      industry: "Home renovation contractor",
      location: c.m.code === "INTL" ? c.area : `${c.area}, ${c.m.name}`,
      audience: "Homeowners aged 30 to 55 renovating a home they just bought or one that is getting old, who want a fixed quote and a clear timeline",
      offers: "kitchen renovation, bathroom renovation, full home renovation, carpentry and built-in storage",
      competitors: "Oakline Builders, Northgate Interiors, Fairbuild Renovation Co.",
      goals: "More quote requests and site visits from the website and Google",
      monthly_budget: `About ${formatPrice(c.m, 10500)} a month across Google and Meta ads`,
      tone: "Straightforward and practical",
    }),
    site: (c) => ({
      platform: "WordPress",
      ms: 3400,
      bytes: 640_000,
      title: "Home | Brickhouse",
      description: "",
      h1: ["Quality you can live in"],
      h2: ["Our services", "Recent projects", "Why Brickhouse"],
      words: 340,
      images: 48,
      missingAlt: 21,
      phoneLinks: 0,
      whatsappLinks: 0,
      emailLinks: 1,
      forms: 1,
      bookingWidget: "",
      trackers: ["Google Analytics 4", "Meta Pixel"],
      schemaTypes: [],
      pages: [
        { path: "/kitchen-renovation/", title: "Kitchen Renovation | Brickhouse", description: "", words: 450 },
        { path: "/bathroom-renovation/", title: "Bathroom Renovation | Brickhouse", description: "", words: 380 },
        { path: "/projects/", title: "Projects | Brickhouse", description: "Recent kitchens, bathrooms and full home renovations by Brickhouse.", words: 210 },
      ],
      summary: (missingChat) =>
        `The site is slow and does not say what Brickhouse does. The headline "Quality you can live in" never mentions renovation or ${c.area}, the homepage title is just "Home | Brickhouse", and 21 of the 48 project photos have no description, so Google cannot tell a kitchen from a bathroom.${
          missingChat ? ` There is also no ${c.chatThing}, so a homeowner looking at projects on their phone has to hunt for a way to ask for a quote.` : ""
        } Start with the title and headline, then the contact button, then an FAQ that answers price and timeline questions.`,
      strengths: [
        "Secure connection (HTTPS): site loads over HTTPS.",
        "Mobile-friendly viewport: pages fit phone screens.",
        "Tracking: Google Analytics 4 and the Meta Pixel are installed, so the ads can learn who asks for a quote.",
        "XML sitemap: found, so Google can discover every service and project page.",
      ],
      rewrite: {
        title: `Kitchen and Bathroom Renovation in ${c.area} | Brickhouse`,
        meta_description: `Kitchen, bathroom and full home renovation in ${c.area}. Fixed, itemised quotes and a written timeline for every stage. Book a free site visit.`,
        h1: `Kitchen and bathroom renovation in ${c.area}`,
      },
      faq: [
        {
          question: `How much does a kitchen renovation cost in ${c.area}?`,
          answer:
            "It depends on the size of the kitchen, whether the layout changes and the materials you choose. We give you a fixed, itemised quote after a free site visit, and the price only changes if you change the scope.",
        },
        {
          question: "How long does a bathroom renovation take?",
          answer: "Most bathrooms take two to three weeks from demolition to handover. Your quote includes a written timeline for each stage, so you know when the bathroom will be out of use.",
        },
        {
          question: "Do you handle the permits and approvals?",
          answer: "Yes. We apply for the permits your project needs and include the fees in the quote, so the full cost is clear before work starts.",
        },
        {
          question: "Can I stay at home during the renovation?",
          answer: "For a kitchen or bathroom, usually yes. We seal off the work area and clean up at the end of each day. For a full home renovation we will talk through the options at the site visit.",
        },
      ],
    }),
    keywords: () => ({
      seeds: "kitchen renovation, bathroom renovation, home renovation",
      summary:
        "Three services became keyword groups sorted by what the searcher wants: to ask for a quote, to compare or to learn. Each group is mapped to the page on the site that should rank for it, with a brief for any page that does not exist yet. Demand and difficulty are estimates for comparing groups, not search volumes; paste a Search Console export and the map uses real numbers.",
    }),
    visibility: (c) => ({
      prompts: [
        `best renovation contractor in ${c.area}`,
        `kitchen renovation ${c.area} recommendations`,
        `how much does a bathroom renovation cost in ${c.country}`,
        `reliable renovation company near ${c.area}`,
        `renovation contractors with fixed quotes in ${c.country}`,
        `who can renovate a kitchen in under a month in ${c.area}`,
      ],
      asker: "a homeowner",
    }),
    content: {
      platforms: ["Instagram", "Facebook"],
      avoid: "first visit",
      summary: () =>
        "Six post ideas for Instagram and Facebook, built around the questions homeowners ask before they get a quote. Each one has the hook word for word, a shot list, a caption and hashtags to paste, and a slot in a two-week calendar at three posts a week. With live research on, ideas also use what is trending in your niche this month.",
    },
    ads: (c) => {
      const chat = chatCampaign(c.m);
      return exportsOf(
        "renovation",
        c.m.currency,
        [
          { name: "Search - Brand", type: "Search", impr: 1380, clicks: 311, cost: 161.72, conv: 26, share: "91.40%" },
          { name: "Search - Kitchen Renovation", type: "Search", impr: 14260, clicks: 702, cost: 2702.7, conv: 31, share: "28.30%" },
          { name: "Search - Bathroom Renovation", type: "Search", impr: 9940, clicks: 455, cost: 1547.0, conv: 22, share: "33.80%" },
          { name: "Search - Renovation Packages", type: "Search", impr: 11870, clicks: 386, cost: 1582.6, conv: 4, share: "22.10%" },
          { name: "Search - Competitors", type: "Search", impr: 4120, clicks: 64, cost: 332.8, conv: 0, share: "< 10%" },
          { name: "Performance Max - Project Gallery", type: "Performance Max", impr: 52300, clicks: 690, cost: 1021.2, conv: 9, share: "--" },
        ],
        [
          { term: `kitchen renovation ${c.area.toLowerCase()}`, match: "Phrase match", campaign: "Search - Kitchen Renovation", group: "Kitchen", clicks: 188, impr: 3420, cost: 702.12, conv: 11 },
          { term: "kitchen renovation near me", match: "Phrase match", campaign: "Search - Kitchen Renovation", group: "Kitchen", clicks: 142, impr: 2610, cost: 532.5, conv: 8 },
          { term: "kitchen cabinet makers", match: "Broad match", campaign: "Search - Kitchen Renovation", group: "Kitchen", clicks: 61, impr: 1480, cost: 230.58, conv: 3 },
          { term: "flat pack kitchen installation", match: "Broad match", campaign: "Search - Kitchen Renovation", group: "Kitchen", clicks: 54, impr: 1720, cost: 189.0, conv: 0 },
          { term: "diy kitchen cabinets", match: "Broad match", campaign: "Search - Kitchen Renovation", group: "Kitchen", clicks: 38, impr: 1310, cost: 121.6, conv: 0 },
          { term: "bathroom renovation cost", match: "Phrase match", campaign: "Search - Bathroom Renovation", group: "Bathroom", clicks: 117, impr: 2290, cost: 409.5, conv: 6 },
          { term: `bathroom renovation ${c.area.toLowerCase()}`, match: "Phrase match", campaign: "Search - Bathroom Renovation", group: "Bathroom", clicks: 96, impr: 1840, cost: 316.8, conv: 7 },
          { term: "how to regrout bathroom tiles", match: "Broad match", campaign: "Search - Bathroom Renovation", group: "Bathroom", clicks: 41, impr: 1520, cost: 98.4, conv: 0 },
          { term: "cheap renovation package", match: "Broad match", campaign: "Search - Renovation Packages", group: "Packages", clicks: 92, impr: 2010, cost: 386.4, conv: 0 },
          { term: "renovation jobs", match: "Broad match", campaign: "Search - Renovation Packages", group: "Packages", clicks: 33, impr: 940, cost: 115.5, conv: 0 },
          { term: "interior design course", match: "Broad match", campaign: "Search - Renovation Packages", group: "Packages", clicks: 29, impr: 870, cost: 98.6, conv: 0 },
          { term: "renovation contractor near me", match: "Phrase match", campaign: "Search - Renovation Packages", group: "Packages", clicks: 71, impr: 1390, cost: 312.4, conv: 3 },
          { term: "brickhouse renovations", match: "Exact match", campaign: "Search - Brand", group: "Brand", clicks: 204, impr: 820, cost: 104.04, conv: 19 },
          { term: "brickhouse renovations reviews", match: "Phrase match", campaign: "Search - Brand", group: "Brand", clicks: 39, impr: 260, cost: 21.06, conv: 0 },
        ],
        [
          { campaign: "Leads - Kitchen Makeover", adset: `Homeowners 30-55 - Broad ${c.area}`, results: 34, indicator: LEAD, reach: 24800, impr: 58300, spend: 1012.4, clicks: 702 },
          { campaign: "Leads - Kitchen Makeover", adset: "Interests - Home improvement", results: 11, indicator: LEAD, reach: 11200, impr: 43900, spend: 618.2, clicks: 388 },
          { campaign: "Leads - Kitchen Makeover", adset: "Lookalike 1% - Past clients", results: 0, indicator: LEAD, reach: 7400, impr: 15100, spend: 301.6, clicks: 102 },
          { campaign: `${chat.name} - Site Visit Booking`, adset: "Retargeting - Website visitors 30d", results: 19, indicator: chat.indicator, reach: 3100, impr: 21400, spend: 402.3, clicks: 251 },
          { campaign: "Traffic - Project Gallery", adset: `Broad ${c.area} 25-65`, results: 1210, indicator: LINK_CLICK, reach: 61800, impr: 109400, spend: 868.1, clicks: 1210 },
        ],
      );
    },
    adCopy: (c) => ({
      google_headlines: [
        `Kitchen Renovation ${c.area}`,
        `Bathroom Renovation ${c.area}`,
        "Fixed, Itemised Quotes",
        "Book a Free Site Visit",
        "Written Timeline Per Stage",
        "See Our Recent Kitchens",
        "Brickhouse Renovations",
        "Permits Handled For You",
        `${c.chatUs} for a Quote`,
      ],
      google_descriptions: [
        `Kitchen and bathroom renovation in ${c.area}. Fixed, itemised quote after a free site visit.`,
        "See recent projects, then book a site visit. We send a written timeline with every quote.",
        "Permits, trades and clean-up handled by one team. Ask for a quote online in two minutes.",
      ],
    }),
    compliance: (c) => ({
      text: `Cheapest in town, guaranteed! Brickhouse is the best contractor in ${c.area} for kitchens and bathrooms, and cheaper than any other renovation company. Every project finished on time, 100% stress-free. Only 3 slots left this month, so act now before prices go up.`,
      channel: "Meta ad",
      what: "a draft Meta ad",
      rewrite: `Kitchen and bathroom renovation in ${c.area}. You get a fixed, itemised quote after a free site visit, and a written timeline for every stage before work starts. See recent projects on our website, then ${c.chatUs.toLowerCase()} to book your site visit.`,
      checklist: ["Make sure every project photo in the ad is your own work, and that you have the homeowner's permission to show it."],
      fixes: [
        ["Cheapest in town", "Fixed, itemised quotes after a free site visit."],
        ["Brickhouse is the best", `Brickhouse renovates kitchens and bathrooms in ${c.area}, with a fixed, itemised quote before work starts.`],
        ["Every project finished", "Every quote comes with a written timeline for each stage."],
        ["Only 3 slots left", "We are booking site visits for next month now."],
      ],
    }),
    retext: (c) => [
      [/Aesthetic treatments in/g, "Kitchen and bathroom renovation in"],
      [/'Lash Extensions in [^|']+\| Your Brand'/g, `'Kitchen Renovation in ${c.area} | Brickhouse'`],
      [/MedicalClinic, BeautySalon,? (?:or )?LegalService/g, "GeneralContractor or HomeAndConstructionBusiness"],
      [/'Hydrafacial treatment room at our [^']+ clinic'/g, `'Finished kitchen with oak cabinets in a ${c.area} home'`],
      [/\(price range, downtime, how long it takes, who it suits\)/g, "(price range, how long it takes, permits, whether you can stay at home)"],
      [/book a consultation before committing to a package/g, "ask for an itemised quote before paying a deposit"],
      [/What should I expect at my first (.+?) appointment\?/g, "What happens at the site visit for a $1?"],
      [/book a consult if unsure/g, "book a site visit if unsure"],
    ],
  },

  // A cafe with a brunch trade and a catering side.
  cafe: {
    domain: "saltwater-cafe.example",
    profile: (c) => ({
      industry: "Cafe",
      location: c.m.code === "INTL" ? c.area : `${c.area}, ${c.m.name}`,
      audience: "Office workers and families nearby for brunch and coffee, and office managers ordering catering for meetings and events",
      offers: "office catering, event catering, weekend brunch, celebration cakes",
      competitors: "Tidewater Coffee House, The Little Larder, Copperpot Kitchen",
      goals: "More catering orders from offices, and fuller weekday mornings",
      monthly_budget: `About ${formatPrice(c.m, 5000)} a month across Google and Meta ads`,
      tone: "Friendly, warm and to the point",
    }),
    site: (c) => ({
      platform: "Squarespace",
      ms: 1500,
      bytes: 380_000,
      title: "Saltwater Cafe",
      description: "Specialty coffee and brunch.",
      h1: [],
      h2: ["Menu", "Catering", "Visit us"],
      words: 180,
      images: 22,
      missingAlt: 3,
      phoneLinks: 1,
      whatsappLinks: 0,
      emailLinks: 1,
      forms: 1,
      bookingWidget: "",
      trackers: ["Google Analytics 4"],
      schemaTypes: ["WebSite"],
      pages: [
        { path: "/menu", title: "Menu | Saltwater Cafe", description: "Brunch, coffee and cakes at Saltwater Cafe.", words: 520 },
        { path: "/catering", title: "Catering | Saltwater Cafe", description: "", words: 260 },
        { path: "/cakes", title: "Celebration Cakes | Saltwater Cafe", description: "", words: 190 },
        { path: "/visit", title: "Visit | Saltwater Cafe", description: "Opening hours, address and parking for Saltwater Cafe.", words: 140 },
      ],
      summary: (missingChat) =>
        `People who find Saltwater Cafe on Google land on a page with almost nothing to read: there is no headline, about 180 words of text, and the title is just "Saltwater Cafe". Catering, where the biggest orders come from, has no meta description and is not mentioned on the homepage. Add a headline that names brunch, catering and ${c.area}, then a catering FAQ${missingChat ? ` and a ${c.chatThing} for quick catering questions` : ""}, and install the Meta Pixel so the ads can learn who orders.`,
      strengths: [
        "Secure connection (HTTPS): site loads over HTTPS.",
        "Mobile-friendly viewport: the menu fits phone screens.",
        "Tap-to-call: the phone number is a link, so people can call from the menu page.",
        "Website analytics: Google Analytics 4 is installed, so you can see where visitors come from.",
      ],
      rewrite: {
        title: `Brunch and Office Catering in ${c.area} | Saltwater Cafe`,
        meta_description: `All-day brunch and specialty coffee in ${c.area}, plus office catering for 10 to 200 people. See the menu and order catering online.`,
        h1: `Brunch, coffee and office catering in ${c.area}`,
      },
      faq: [
        {
          question: "How much notice do you need for a catering order?",
          answer: "Two working days for most office orders, and a week for events over 80 people. If you need something sooner, message us and we will tell you what we can do.",
        },
        {
          question: "Do you take bookings for weekend brunch?",
          answer: "We keep most tables for walk-ins and take bookings for groups of six or more. Weekend mornings are busiest before 11am.",
        },
        {
          question: "Do you have vegetarian, vegan and gluten-free options?",
          answer: "Yes. Every catering platter has a vegetarian version, and the menu marks vegan and gluten-free dishes. Tell us about allergies when you order.",
        },
        {
          question: `Where can I park near Saltwater Cafe in ${c.area}?`,
          answer: "There is street parking on the side road and a public car park two minutes' walk away. Directions are on our Visit page.",
        },
      ],
    }),
    keywords: () => ({
      seeds: "office catering, event catering, cake delivery",
      summary:
        "Catering and cake delivery became keyword groups sorted by what the searcher wants: to order or book, to compare or to learn. Each group is mapped to the page on the site that should rank for it, with a brief for any page that does not exist yet. Demand and difficulty are estimates for comparing groups, not search volumes; paste a Search Console export and the map uses real numbers.",
    }),
    visibility: (c) => ({
      prompts: [
        `best brunch in ${c.area}`,
        `office catering in ${c.area} for 30 people`,
        `cafe with good coffee near ${c.area}`,
        `where to order a birthday cake in ${c.area}`,
        `corporate lunch catering in ${c.country}`,
        `cafes in ${c.area} that do catering`,
      ],
      asker: "someone looking for brunch or catering",
    }),
    content: {
      platforms: ["Instagram", "TikTok"],
      avoid: "first visit",
      summary: () =>
        "Six post ideas for Instagram and TikTok that show the food, the team and how catering works. Each one has the hook word for word, a shot list, a caption and hashtags to paste, and a slot in a two-week calendar at three posts a week. With live research on, ideas also use what is trending in your niche this month.",
    },
    ads: (c) => {
      const chat = chatCampaign(c.m);
      return exportsOf(
        "cafe",
        c.m.currency,
        [
          { name: "Search - Brand", type: "Search", impr: 2960, clicks: 702, cost: 168.48, conv: 88, share: "94.10%" },
          { name: "Search - Office Catering", type: "Search", impr: 8420, clicks: 398, cost: 1353.2, conv: 29, share: "36.20%" },
          { name: "Search - Event Catering", type: "Search", impr: 5110, clicks: 214, cost: 792.8, conv: 3, share: "29.40%" },
          { name: "Search - Brunch Near Me", type: "Search", impr: 12880, clicks: 611, cost: 708.76, conv: 41, share: "41.80%" },
          { name: "Search - Celebration Cakes", type: "Search", impr: 6240, clicks: 233, cost: 466.0, conv: 9, share: "32.70%" },
          { name: "Performance Max - Catering", type: "Performance Max", impr: 31600, clicks: 402, cost: 506.52, conv: 4, share: "--" },
        ],
        [
          { term: `office catering ${c.area.toLowerCase()}`, match: "Phrase match", campaign: "Search - Office Catering", group: "Catering", clicks: 121, impr: 2210, cost: 423.5, conv: 11 },
          { term: "corporate lunch catering", match: "Phrase match", campaign: "Search - Office Catering", group: "Catering", clicks: 88, impr: 1730, cost: 299.2, conv: 8 },
          { term: "catering for 50 people", match: "Broad match", campaign: "Search - Office Catering", group: "Catering", clicks: 46, impr: 960, cost: 156.4, conv: 3 },
          { term: "cheap buffet catering", match: "Broad match", campaign: "Search - Office Catering", group: "Catering", clicks: 52, impr: 1410, cost: 171.6, conv: 0 },
          { term: "catering jobs", match: "Broad match", campaign: "Search - Office Catering", group: "Catering", clicks: 27, impr: 690, cost: 86.4, conv: 0 },
          { term: "wedding catering", match: "Broad match", campaign: "Search - Event Catering", group: "Events", clicks: 64, impr: 1620, cost: 249.6, conv: 0 },
          { term: "birthday party catering", match: "Phrase match", campaign: "Search - Event Catering", group: "Events", clicks: 48, impr: 980, cost: 177.6, conv: 2 },
          { term: "brunch near me", match: "Phrase match", campaign: "Search - Brunch Near Me", group: "Brunch", clicks: 233, impr: 4860, cost: 270.28, conv: 19 },
          { term: `best brunch ${c.area.toLowerCase()}`, match: "Broad match", campaign: "Search - Brunch Near Me", group: "Brunch", clicks: 118, impr: 2930, cost: 141.6, conv: 9 },
          { term: "cafe for sale", match: "Broad match", campaign: "Search - Brunch Near Me", group: "Brunch", clicks: 31, impr: 1240, cost: 37.2, conv: 0 },
          { term: "how to make cold brew", match: "Broad match", campaign: "Search - Brunch Near Me", group: "Brunch", clicks: 44, impr: 1880, cost: 48.4, conv: 0 },
          { term: "saltwater cafe", match: "Exact match", campaign: "Search - Brand", group: "Brand", clicks: 388, impr: 1490, cost: 89.24, conv: 52 },
          { term: "saltwater cafe menu", match: "Phrase match", campaign: "Search - Brand", group: "Brand", clicks: 141, impr: 620, cost: 31.02, conv: 0 },
        ],
        [
          { campaign: "Leads - Office Catering", adset: `Office workers 25-50 - ${c.area}`, results: 21, indicator: LEAD, reach: 14200, impr: 31800, spend: 702.4, clicks: 344 },
          { campaign: "Leads - Office Catering", adset: "Interests - Event planning", results: 4, indicator: LEAD, reach: 9800, impr: 29100, spend: 488.6, clicks: 271 },
          { campaign: "Leads - Office Catering", adset: "Lookalike 1% - Catering clients", results: 0, indicator: LEAD, reach: 5200, impr: 9800, spend: 154.2, clicks: 61 },
          { campaign: `${chat.name} - Cake Orders`, adset: "Retargeting - Instagram engagers 60d", results: 17, indicator: chat.indicator, reach: 2600, impr: 19300, spend: 296.4, clicks: 188 },
          { campaign: "Traffic - Weekend Brunch", adset: `Radius 3km - ${c.area}`, results: 690, indicator: LINK_CLICK, reach: 41200, impr: 88700, spend: 412.8, clicks: 690 },
        ],
      );
    },
    adCopy: (c) => ({
      google_headlines: [
        `Office Catering in ${c.area}`,
        "Catering for 10 to 200",
        "Order Catering Online",
        "Vegetarian Platters Included",
        "Order 2 Working Days Ahead",
        "Saltwater Cafe",
        "See the Catering Menu",
        `Brunch in ${c.area}`,
      ],
      google_descriptions: [
        `Office catering from Saltwater Cafe in ${c.area}. See the menu and order online.`,
        "Platters for meetings and events, with vegetarian and gluten-free options marked.",
        `${c.chatUs} with your headcount and date and we confirm the same day.`,
      ],
    }),
    compliance: (c) => ({
      text: `The best brunch in ${c.area}, hands down! Rated 5 stars and loved by 10,000 customers. Our catering is better than any other cafe in town. Today only: 30% off office catering orders. Hurry, while stocks last!`,
      channel: "Instagram post",
      what: "a draft Instagram post",
      rewrite: `Weekend brunch in ${c.area}, from 8am, with specialty coffee roasted locally. Ordering for the office? Our catering menu has platters for 10 to 200 people, with vegetarian and gluten-free options marked. 30% off office catering orders placed by Sunday. ${c.chatUs} to order.`,
      checklist: ["Check that any star rating you quote matches your current Google rating, and that customer numbers come from your own records."],
      fixes: [
        ["The best brunch", `Weekend brunch in ${c.area}, from 8am.`],
        ["Rated 5 stars", "See what customers say in our Google reviews."],
        ["Our catering is better", "Our catering menu has platters for 10 to 200 people."],
        ["Today only", "30% off office catering orders placed by Sunday."],
        ["Hurry", ""],
      ],
    }),
    retext: (c) => [
      [/Aesthetic treatments in/g, "Brunch, coffee and office catering in"],
      [/'Lash Extensions in [^|']+\| Your Brand'/g, `'Office Catering in ${c.area} | Saltwater Cafe'`],
      [/MedicalClinic, BeautySalon,? (?:or )?LegalService/g, "CafeOrCoffeeShop"],
      [/'Hydrafacial treatment room at our [^']+ clinic'/g, `'Brunch platter with sourdough and eggs at our ${c.area} cafe'`],
      [/\(price range, downtime, how long it takes, who it suits\)/g, "(notice needed for catering, headcounts, dietary options, parking)"],
      [/book a consultation before committing to a package/g, "check the menu and opening hours before you go"],
      [/What should I expect at my first (.+?) appointment\?/g, "What should I expect with my first $1 order?"],
      [/book a consult if unsure/g, "message us if unsure"],
      [/'(Call or text|Message us(?: on LINE)?|WhatsApp us) to book'/g, "'$1 to order catering'"],
      [/each service page/g, "your catering and menu pages"],
      [/\bservice page/g, "menu page"],
      [/\bService page/g, "Menu page"],
    ],
  },

  // An online homeware brand on Shopify.
  store: {
    domain: "lindenandloft.example",
    profile: (c) => ({
      industry: "Online homeware store",
      location: c.m.code === "INTL" ? c.area : `${c.area}, ${c.m.name}`,
      audience: `Home owners and renters aged 25 to 45 furnishing a new place, and people buying housewarming gifts, anywhere in ${c.country}`,
      offers: "linen bedding, stoneware dinnerware, scented candles, gift sets",
      competitors: "Hearth & Loom, Stillwater Home, Marlow Linen Co.",
      goals: "More online sales at a better return on ad spend",
      monthly_budget: `About ${formatPrice(c.m, 9000)} a month across Google and Meta ads`,
      tone: "Calm, warm and specific",
    }),
    site: (c) => ({
      platform: "Shopify",
      ms: 900,
      bytes: 820_000,
      title: "Linden & Loft | Homeware",
      description: "Linen bedding, stoneware dinnerware and scented candles, designed in-house and delivered to your door. Free returns within 30 days.",
      h1: ["Linden & Loft", "Slow mornings start here", "New in: oat linen"],
      h2: ["Shop by room", "Bestsellers", "FAQs"],
      words: 610,
      images: 64,
      missingAlt: 30,
      phoneLinks: 0,
      whatsappLinks: 0,
      emailLinks: 1,
      forms: 1,
      bookingWidget: "",
      trackers: ["Google Analytics 4", "Meta Pixel", "Google Ads tag"],
      schemaTypes: ["Organization", "WebSite"],
      pages: [
        { path: "/collections/linen-bedding", title: "Linen Bedding | Linden & Loft", description: "", words: 320 },
        { path: "/products/stoneware-dinner-set", title: "Stoneware Dinner Set | Linden & Loft", description: "A 12-piece stoneware dinner set in speckled oat, dishwasher safe.", words: 280 },
        { path: "/collections/all", title: "Products | Linden & Loft", description: "", words: 90 },
        { path: "/collections/gift-sets", title: "Products | Linden & Loft", description: "", words: 110 },
      ],
      summary: (missingChat) =>
        `The shop loads quickly and its tracking is set up, but Google sees it less clearly than shoppers do. 30 of 64 product images have no alt text, so they are close to invisible in Google Images, the homepage has 3 H1 headlines, and two collection pages share the title "Products | Linden & Loft".${
          missingChat ? ` There is also no ${c.chatThing} for size and delivery questions before checkout.` : ""
        } Fix the alt text first, then the titles, then add a quick way to ask a question.`,
      strengths: [
        "Server response time: the homepage arrives in 0.9s.",
        "Tracking: Google Analytics 4, the Meta Pixel and the Google Ads tag are all installed, so purchases flow back to the ads.",
        "Business schema: Organization markup is set, so Google can connect the brand name to the shop.",
        "FAQ: the homepage answers common questions, which AI assistants can quote.",
      ],
      rewrite: {
        title: "Linen Bedding and Stoneware Homeware | Linden & Loft",
        meta_description: `Linen bedding, stoneware dinnerware and scented candles, designed in-house and delivered across ${c.country}. Free returns within 30 days.`,
        h1: "Linen bedding and stoneware for slow mornings",
      },
      faq: [
        {
          question: `How long does delivery take in ${c.country}?`,
          answer: "Most orders arrive in two to four working days. You get a tracking link by email as soon as your order leaves our warehouse.",
        },
        {
          question: "Can I return bedding if it doesn't fit?",
          answer: "Yes. Unused bedding in its original packaging can be returned within 30 days for a refund. Start a return from the link in your order email.",
        },
        {
          question: "How do I wash linen sheets?",
          answer: "Wash at 40 degrees with a mild detergent, skip the fabric softener and tumble dry on low or line dry. Linen gets softer with every wash.",
        },
        {
          question: "Do you gift wrap orders?",
          answer: "Yes. Tick 'Gift wrap' at checkout and add a note. We leave the prices off the packing slip.",
        },
      ],
    }),
    keywords: (c) => ({
      seeds: "linen bedding, stoneware dinnerware, scented candles",
      location: c.country,
      // A sample Google Search Console Queries export, read by the real parser.
      data: [
        "Top queries,Clicks,Impressions,CTR,Position",
        "linden and loft,412,1960,21.02%,1.2",
        "linen bedding,38,4210,0.9%,9.4",
        "linen sheets,29,3880,0.75%,11.2",
        "stoneware dinner set,44,2140,2.06%,6.8",
        "linen duvet cover queen,21,1320,1.59%,7.9",
        "speckled stoneware plates,18,640,2.81%,4.6",
        "housewarming gift ideas,12,2950,0.41%,14.3",
        "scented candles,9,3610,0.25%,18.7",
        "how to wash linen sheets,31,1180,2.63%,3.1",
        "oat linen bedding,26,410,6.34%,2.4",
        "stoneware mugs,7,1240,0.56%,12.6",
        "linen pillowcases,11,980,1.12%,8.8",
      ].join("\n"),
      summary:
        "Three product ranges became keyword groups sorted by what the searcher wants: to buy, to compare or to learn, each mapped to the collection page that should rank for it. This sample also includes a Search Console export, read by the real code: the visibility score and the quick wins below come from those queries, several of which sit just off the top of Google.",
    }),
    visibility: (c) => ({
      prompts: [
        `where to buy linen bedding online in ${c.country}`,
        `best online homeware store in ${c.country}`,
        "stoneware dinner set gift ideas",
        `linen sheets that deliver to ${c.area}`,
        `housewarming gift ideas in ${c.country}`,
        "good quality ceramic plates that are dishwasher safe",
      ],
      asker: "a shopper",
    }),
    content: {
      platforms: ["Instagram", "TikTok"],
      avoid: "first visit, slot, meet the person, before you book, plan your, jargon",
      summary: () =>
        "Six post ideas for Instagram and TikTok that show the products in real homes and answer what shoppers ask before they buy. Each one has the hook word for word, a shot list, a caption and hashtags to paste, and a slot in a two-week calendar at three posts a week. With live research on, ideas also use what is trending in your niche this month.",
    },
    ads: (c) =>
      exportsOf(
        "store",
        c.m.currency,
        [
          { name: "Search - Brand", type: "Search", impr: 3410, clicks: 1022, cost: 245.28, conv: 96, share: "95.20%", value: 13420.8 },
          { name: "Shopping - Linen Bedding", type: "Shopping", impr: 48900, clicks: 1288, cost: 1494.08, conv: 41, share: "52.30%", value: 7995.0 },
          { name: "Search - Linen Bedding", type: "Search", impr: 9620, clicks: 402, cost: 727.62, conv: 12, share: "38.90%", value: 2148.0 },
          { name: "Search - Broad Homeware", type: "Search", impr: 18300, clicks: 611, cost: 1111.0, conv: 3, share: "18.40%", value: 249.0 },
          { name: "Performance Max - Gift Sets", type: "Performance Max", impr: 61200, clicks: 905, cost: 1276.05, conv: 22, share: "--", value: 2618.0 },
          { name: "Search - Competitors", type: "Search", impr: 5880, clicks: 97, cost: 358.9, conv: 0, share: "< 10%", value: 0 },
        ],
        [
          { term: "linen bedsheets", match: "Phrase match", campaign: "Search - Linen Bedding", group: "Bedsheets", clicks: 132, impr: 2760, cost: 237.6, conv: 5 },
          { term: "linen duvet cover queen", match: "Phrase match", campaign: "Search - Linen Bedding", group: "Bedsheets", clicks: 88, impr: 1690, cost: 167.2, conv: 4 },
          { term: "stonewashed linen sheets", match: "Broad match", campaign: "Search - Linen Bedding", group: "Bedsheets", clicks: 61, impr: 1180, cost: 112.85, conv: 3 },
          { term: "how to wash linen sheets", match: "Broad match", campaign: "Search - Linen Bedding", group: "Bedsheets", clicks: 49, impr: 2140, cost: 71.05, conv: 0 },
          { term: "homeware", match: "Broad match", campaign: "Search - Broad Homeware", group: "Homeware", clicks: 168, impr: 6020, cost: 302.4, conv: 1 },
          { term: "home decor ideas", match: "Broad match", campaign: "Search - Broad Homeware", group: "Homeware", clicks: 121, impr: 4810, cost: 205.7, conv: 0 },
          { term: "cheap home decor", match: "Broad match", campaign: "Search - Broad Homeware", group: "Homeware", clicks: 97, impr: 3220, cost: 174.6, conv: 0 },
          { term: "homeware wholesale", match: "Broad match", campaign: "Search - Broad Homeware", group: "Homeware", clicks: 44, impr: 980, cost: 88.0, conv: 0 },
          { term: "pottery class", match: "Broad match", campaign: "Search - Broad Homeware", group: "Homeware", clicks: 38, impr: 1130, cost: 64.6, conv: 0 },
          { term: "free homeware samples", match: "Broad match", campaign: "Search - Broad Homeware", group: "Homeware", clicks: 29, impr: 870, cost: 52.2, conv: 0 },
          { term: "linden and loft", match: "Exact match", campaign: "Search - Brand", group: "Brand", clicks: 512, impr: 1820, cost: 117.76, conv: 61 },
          { term: "linden and loft discount code", match: "Phrase match", campaign: "Search - Brand", group: "Brand", clicks: 166, impr: 690, cost: 41.5, conv: 6 },
        ],
        [
          { campaign: "Sales - Linen Bedding", adset: `Advantage+ audience - ${c.country}`, results: 38, indicator: PURCHASE, reach: 52100, impr: 98400, spend: 1402.6, clicks: 1310, value: 7410.0 },
          { campaign: "Sales - Linen Bedding", adset: "Interests - Interior design", results: 9, indicator: PURCHASE, reach: 21400, impr: 55200, spend: 702.2, clicks: 520, value: 1620.0 },
          { campaign: "Sales - Retargeting", adset: "Viewed product 14d", results: 26, indicator: PURCHASE, reach: 4100, impr: 33600, spend: 512.4, clicks: 402, value: 4940.0 },
          { campaign: "Sales - Gift Sets", adset: "Lookalike 1% - Purchasers", results: 3, indicator: PURCHASE, reach: 18800, impr: 36100, spend: 496.8, clicks: 287, value: 486.0 },
          { campaign: "Traffic - Journal", adset: "Broad 25-54", results: 1488, indicator: LINK_CLICK, reach: 70200, impr: 121000, spend: 610.3, clicks: 1488, value: 0 },
        ],
      ),
    adCopy: (c) => ({
      google_headlines: [
        "Natural Linen Bedding",
        "Shop Linen Bedsheets",
        "Stoneware Dinner Sets",
        "Free Returns Within 30 Days",
        "Linden & Loft Homeware",
        "Gift Sets for New Homes",
        `Delivered Across ${c.country}`,
        "Oat, Clay and Sage Linen",
      ],
      google_descriptions: [
        `Linen bedding and stoneware from Linden & Loft, delivered across ${c.country} in 2 to 4 days.`,
        "Stonewashed linen that gets softer with every wash. Free returns within 30 days.",
        "Gift wrap at checkout, with prices left off the packing slip.",
      ],
    }),
    compliance: (c) => ({
      text: `100% organic linen, clinically proven to help you sleep better. The best bedding in ${c.country}, loved by 20,000 customers. Our sheets are better than any other brand and last forever. Flash sale ends tonight!`,
      channel: "Website",
      what: "a product page",
      rewrite: `Stonewashed linen bedding, woven from flax and finished to get softer with every wash. Breathable in warm weather and warm enough for cooler nights. Free returns within 30 days if it isn't right. Sale prices end Sunday at midnight.`,
      checklist: ["If you keep 'organic', hold the certificate for this exact fabric and name the certifying body on the product page."],
      fixes: [
        ["100% organic", "Stonewashed linen, woven from flax and breathable in warm weather."],
        ["The best bedding", `Linen bedding delivered across ${c.country} in 2 to 4 working days.`],
        ["Our sheets are better", "Linen gets softer with every wash."],
        ["Flash sale", "Sale prices end Sunday at midnight."],
      ],
    }),
    patch: (r, c) => {
      // The keyword and content templates are written for service businesses. Swap the parts a
      // shop would never say for what an online store's live run would write.
      const kw = r.keywords as AgentResult & { aeo_questions: { question: string; answer_angle: string; where_to_answer: string; format: string }[] };
      kw.aeo_questions = [
        ...kw.aeo_questions.filter((q) => !/ near | appointment\?|^How long does |choose a good/.test(q.question)),
        { question: "How do I wash linen sheets so they last?", answer_angle: "Temperature, detergent, drying and how linen softens over time, in four short steps.", where_to_answer: "Linen bedding collection page FAQ", format: "how-to steps" },
        { question: "Are stoneware plates dishwasher and microwave safe?", answer_angle: "Yes or no first, then the care instructions for each product.", where_to_answer: "Stoneware dinner set product page", format: "FAQ block" },
        { question: `How long does delivery take in ${c.country}?`, answer_angle: "Working days first, then cut-off times and how tracking works.", where_to_answer: "Shipping page, linked from every product page", format: "FAQ block" },
      ];
      kw.prescriptions = kw.prescriptions.filter((p) => !/Google Business Profile/.test(p.title));
      const bio = r.content.prescriptions.find((p) => /in your bio$/.test(p.title));
      if (bio) {
        bio.title = "Put a shop link and one clear line in your bio";
        bio.diagnosis = "Content only brings sales if the next step is obvious. Your bio should say what you sell and where to buy it in one tap.";
        bio.steps = [
          `Line 1: what you sell, e.g. "Linen bedding and stoneware, delivered across ${c.country}".`,
          'Line 2: one reason to choose you (a fact, not a superlative), e.g. "Free returns within 30 days".',
          'Line 3: "Shop the new linen" and point to the link.',
          "Set the link to your newest collection page, and connect your Shopify catalogue to Instagram Shopping through the Facebook & Instagram app in Shopify so posts can tag products.",
        ];
      }
    },
    retext: (c) => [
      [/'Aesthetic treatments in [^']+'/g, `'Linen bedding and stoneware, delivered across ${c.country}'`],
      [/'(Call or text|Message us(?: on LINE)?|WhatsApp us) to book'/g, "'$1 with a question'"],
      [/Add LocalBusiness schema with your name, address and services/g, "Add OnlineStore schema with your brand name and product ranges"],
      [/Use the LocalBusiness type that fits \(for example MedicalClinic, BeautySalon or LegalService\)\./g, "Use the OnlineStore type, with your brand name, logo and the countries you deliver to."],
      [/after each visit/g, "after each delivery"],
      [/Thanks for coming in today!/g, "Thanks for your order!"],
      [/Include price ranges, opening hours and how to book where it fits\./g, "Include prices, delivery times and the returns policy where it fits."],
      [/cheapest enquiries/g, "cheapest sales"],
      [/She almost didn't book/g, "She almost didn't order"],
      [/Co\.\./g, "Co."],
      [/'Lash Extensions in [^|']+\| Your Brand'/g, `'Linen Bedding, Delivered Across ${c.country} | Linden & Loft'`],
      [/MedicalClinic, BeautySalon,? (?:or )?LegalService/g, "OnlineStore"],
      [/'Hydrafacial treatment room at our [^']+ clinic'/g, "'Oat linen duvet cover on a queen bed'"],
      [/\(price range, downtime, how long it takes, who it suits\)/g, "(delivery times, returns, sizes, how to wash linen)"],
      [/book a consultation before committing to a package/g, "check delivery times and the returns policy before you order"],
      [/are ready to book/g, "are ready to buy"],
      [/ is how you show up here and in the Google Maps results/g, " is how you show up here"],
      [/Questions before booking/g, "Questions before buying"],
      [/\bservice page/g, "collection page"],
      [/\bService page/g, "Collection page"],
      [/book a consult if unsure/g, "message us if unsure"],
    ],
  },

  // The regulated example: an aesthetic clinic.
  clinic: {
    domain: "lumen-aesthetics.example",
    profile: (c) => ({
      industry: "Aesthetic clinic",
      location: c.m.code === "INTL" ? c.area : `${c.area}, ${c.m.name}`,
      audience: "Women and men aged 28 to 50 who want help with pigmentation, acne scars and early signs of ageing",
      offers: "Pico laser for pigmentation, Acne scar treatment, Hydrafacial, Skin consultation",
      competitors: "Halcyon Skin Clinic, Atlas Aesthetics, Fernleaf Dermatology",
      goals: "More consultation bookings from the website and ads",
      monthly_budget: "",
      tone: "Warm, clear and factual",
    }),
    site: (c) => ({
      platform: "WordPress",
      ms: 2400,
      bytes: 217_000,
      title: "Home | Lumen",
      description: "",
      h1: ["Glow with confidence"],
      h2: ["Our treatments", "Meet the doctors", "Visit us"],
      words: 520,
      images: 14,
      missingAlt: 4,
      phoneLinks: 0,
      whatsappLinks: 0,
      emailLinks: 1,
      forms: 1,
      bookingWidget: "",
      trackers: ["Google Analytics 4"],
      schemaTypes: [],
      pages: [
        { path: "/treatments/pico-laser/", title: "Pico Laser | Lumen", description: "", words: 610 },
        { path: "/treatments/acne-scars/", title: "Acne Scar Treatment | Lumen", description: "", words: 480 },
        { path: "/about/", title: "About Us | Lumen", description: "Meet the doctors and team at Lumen Aesthetics.", words: 390 },
      ],
      summary: () =>
        `The site loads well and is set up for Google to read, but it makes booking harder than it needs to be. There is no ${c.chatThing}, the homepage title is just "Home | Lumen", and there is no meta description, so the search listing gives people little reason to click. Start with the contact button and the title, then add the FAQ and schema so AI assistants can quote you.`,
      strengths: [
        "Secure connection (HTTPS): site loads over HTTPS.",
        "Mobile-friendly viewport: pages fit phone screens.",
        "Website analytics: Google Analytics 4 is installed, so you can see where visitors come from.",
        "XML sitemap: found, so Google can discover every treatment page.",
      ],
      rewrite: {
        title: `Pico Laser and Acne Scar Treatment in ${c.area} | Lumen`,
        meta_description: `Doctor-led pigmentation and acne scar treatments in ${c.area}. See what each treatment involves, typical downtime and fees, then book a consultation.`,
        h1: `Doctor-led skin treatments in ${c.area}`,
      },
      faq: [
        {
          question: "How many pico laser sessions will I need for pigmentation?",
          answer:
            "It depends on the type and depth of pigmentation. Many patients need a course of sessions a few weeks apart. Your doctor will assess your skin at consultation and give you a plan and an estimate before you start.",
        },
        {
          question: "Is there downtime after acne scar treatment?",
          answer:
            "Most patients have some redness for a day or two, and some treatments need a few days of recovery. Your doctor will explain what to expect for the treatment recommended for you.",
        },
        {
          question: `Where is Lumen Aesthetics in ${c.area}?`,
          answer: `We are in ${c.area}, a short walk from the main bus and train stops. Opening hours and directions are on our contact page, and you can book a consultation online.`,
        },
        {
          question: "What happens at a skin consultation?",
          answer:
            "A doctor looks at your skin, asks about your concerns and medical history, and explains which treatments may suit you, how many sessions are usual and the fees. There is no obligation to book a treatment.",
        },
      ],
    }),
    keywords: () => ({
      seeds: "pico laser, acne scar treatment, hydrafacial",
      summary:
        "Three services became keyword groups sorted by what the searcher wants: to book, to compare or to learn. Each group is mapped to the page on the site that should rank for it, with a brief for any page that does not exist yet. Demand and difficulty are estimates for comparing groups, not search volumes; paste a Search Console export and the map uses real numbers.",
    }),
    visibility: (c) => ({
      prompts: [
        `best pico laser clinic in ${c.area}`,
        `where to treat pigmentation in ${c.area}`,
        `acne scar treatment ${c.area} recommendations`,
        `hydrafacial near ${c.area}`,
        `how much does pico laser cost in ${c.country}`,
        `doctor-led aesthetic clinic ${c.area}`,
      ],
      asker: "a patient",
    }),
    content: {
      platforms: ["Instagram", "TikTok"],
      summary: (c) =>
        `Six post ideas for Instagram and TikTok, written to stay inside the advertising rules for clinics in ${c.m.inPhrase}. Each one has the hook word for word, a shot list, a caption and hashtags to paste, and a slot in a two-week calendar at three posts a week. With live research on, ideas also use what is trending in your niche this month.`,
    },
    ads: null,
    compliance: (c) => ({
      text: `The best pico laser clinic in ${c.area}. Guaranteed results with zero downtime. Our doctors have treated thousands of happy patients, see the before and after photos! Book this month and get 50% off your first session. Read what our patients say: "My skin has never looked better."`,
      channel: "Meta ad",
      category: "Aesthetic clinic",
      what: "a draft Meta ad",
      rewrite: `Pico laser treatment for pigmentation in ${c.area}. Your doctor will assess your skin, explain the results you can expect and any downtime, and give you a treatment plan with fees at your consultation. Book a consultation online or message us with your questions.`,
    }),
    retext: () => [],
  },
};

// ---------- Running the demos ----------

function ctxFor(ws: WorkspaceRow): AgentContext {
  return { ws, runId: SAMPLE_RUN_ID, progress: () => {} };
}

export function sampleWorkspace(m: Market, id: SampleBusinessId = DEFAULT_SAMPLE_BUSINESS): WorkspaceRow {
  const b = SAMPLE_BUSINESSES[id];
  const spec = SPECS[id];
  // Spread so the row carries no stored API keys or billing ids; the agents treat them as unset.
  return {
    id: "sample",
    owner_id: "sample",
    name: b.name,
    website: `https://www.${spec.domain}`,
    country: m.code,
    ...spec.profile(ctxOf(m)),
    regulated: b.regulated ? 1 : 0,
    plan: "growth",
    stripe_customer_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  } as WorkspaceRow;
}

function stripPrefix(s: string, prefix: string) {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

/** Applies wording swaps to every string in a plain JSON value. */
function retext<T>(value: T, pairs: [RegExp, string][]): T {
  if (!pairs.length) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return pairs.reduce((s, [re, to]) => s.replace(re, to), v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

async function demoOf(agent: AgentId, raw: Record<string, unknown>, ws: WorkspaceRow): Promise<SampleReport> {
  const def = { keywords: keywordsAgent, visibility: visibilityAgent, content: contentAgent, ads: adsAgent, compliance: complianceAgent }[agent as Exclude<AgentId, "site" | "gbp">];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = (def.parseInput as (r: unknown, w: WorkspaceRow) => any)(raw, ws);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (def.demo as (i: any, c: AgentContext) => Promise<AgentResult>)(input, ctxFor(ws));
  return {
    agent,
    result,
    run: { id: SAMPLE_RUN_ID, agent, title: result.title, created_at: ws.created_at, input: input as Record<string, unknown> },
  };
}

// The demos are cheap but not free (the content calendar is date-based), so keep one set per
// business per market per day.
const cache = new Map<string, Promise<SampleReport[]>>();

/** Every specialist's report for one fictional business, in the visitor's market. */
export function sampleReports(m: Market, id: SampleBusinessId = DEFAULT_SAMPLE_BUSINESS): Promise<SampleReport[]> {
  const key = `${id}:${m.code}:${new Date().toISOString().slice(0, 10)}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 200) cache.clear();
    // Round-trip through JSON, as a stored run would, so client report components get plain data.
    hit = buildSampleReports(m, id).then((r) => JSON.parse(JSON.stringify(r)) as SampleReport[]);
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}

async function buildSampleReports(m: Market, id: SampleBusinessId): Promise<SampleReport[]> {
  const b = SAMPLE_BUSINESSES[id];
  const spec = SPECS[id];
  const c = ctxOf(m);
  const ws = sampleWorkspace(m, id);

  // Site Doctor, from the fixture.
  const fx = spec.site(c);
  const audit = siteAudit(fx, spec.domain, m);
  const chatCheck = audit.checks.find((x) => x.id === "whatsapp" || x.id === "messaging");
  const site: AgentResult = {
    title: `Site checkup: ${audit.host}`,
    score: audit.score,
    summary: fx.summary(chatCheck?.status !== "pass"),
    strengths: fx.strengths,
    rewrite: fx.rewrite,
    faq: fx.faq,
    audit,
    prescriptions: rulePrescriptions(audit),
    demo: true,
  };

  const kw = spec.keywords(c);
  const vis = spec.visibility(c);
  const comp = spec.compliance(c);
  const [keywords, visibility, content, ads, compliance] = await Promise.all([
    demoOf("keywords", { seeds: kw.seeds, location: kw.location, data: kw.data }, ws),
    demoOf("visibility", { prompts: vis.prompts, brand: b.name, domain: spec.domain, competitors: ws.competitors }, ws),
    demoOf("content", { platforms: spec.content.platforms, per_week: 3, count: 6, trends: false, avoid: spec.content.avoid }, ws),
    demoOf("ads", spec.ads ? { source: "upload", reports: spec.ads(c) } : { source: "sample" }, ws),
    demoOf("compliance", { text: comp.text, channel: comp.channel, category: comp.category }, ws),
  ]);

  // The demo summaries are written for a signed-in owner without an AI key. Rewrite them for a
  // visitor reading a sample, using the numbers the real code computed.
  keywords.result.summary = kw.summary;

  const vr = visibility.result as AgentResult & {
    prompts: { mentioned: boolean; brand_context: string }[];
    insights: string[];
    share_of_voice: { name: string; is_brand: boolean }[];
  };
  const named = vr.prompts.filter((p) => p.mentioned).length;
  const leader = vr.share_of_voice.find((s) => !s.is_brand)?.name;
  vr.summary = `We asked ${vr.prompts.length} questions ${vis.asker} might type into ChatGPT or Perplexity. ${b.name} is named in ${named} of ${vr.prompts.length} answers and its website is never used as a source${leader ? `, while ${leader} shows up most` : ""}. The answers below are made up for this sample; the detection and scoring are the real code.`;
  vr.insights = vr.insights.map((s) => stripPrefix(s, "Sample insight: "));
  vr.prompts.forEach((p) => (p.brand_context = stripPrefix(p.brand_context, "Sample: ")));

  content.result.summary = spec.content.summary(c);
  addSampleTrends(content.result as ContentResult);

  const ar = ads.result as AgentResult & {
    sample?: boolean;
    sources_used?: { source: string }[];
    creative?: { google_headlines: string[]; google_descriptions: string[] };
  };
  if (spec.ads) {
    // Fed through the upload path so the real parser reads the files; label it as the sample it is.
    ar.sample = true;
    ar.title = ar.title.replace(/^Ads checkup/, "Sample ads checkup");
    ar.sources_used = (ar.sources_used ?? []).map((s) => ({ ...s, source: "sample" }));
    ads.run.title = ar.title;
    ads.run.input = { source: "sample" };
    if (spec.adCopy && ar.creative) {
      const copy = spec.adCopy(c);
      ar.creative.google_headlines = copy.google_headlines.filter((h) => h.length <= 30);
      ar.creative.google_descriptions = copy.google_descriptions.filter((d) => d.length <= 90);
    }
  }
  ar.summary = `${ar.summary}`
    .replace(/This is sample data, not [^.]*\. Upload [^.]*\./, "")
    .replace("Rules-based review of your real numbers (AI writing is off).", "")
    .trim();

  const cr = compliance.result as AgentResult & {
    issues: { rule: string; highlight: string; severity: string; why: string; quote: string; fix: string }[];
    flags: { family: string; why: string }[];
    rewritten_copy: string;
    checklist: string[];
  };
  const families = [...new Set(cr.issues.map((i) => (b.regulated ? FAMILY_WORDS_CLINIC : FAMILY_WORDS_GENERAL)[i.rule] ?? i.rule.toLowerCase()))];
  const listed = families.length > 1 ? `${families.slice(0, -1).join(", ")} and ${families.at(-1)}` : families[0];
  if (b.regulated) {
    cr.summary = `We checked ${comp.what} against the rules for clinics in ${m.inPhrase}. ${cr.issues.length} lines need another look${listed ? `, covering ${listed}` : ""}. The suggested rewrite keeps the call to book and drops the claims. Compliance Check is a review aid, not legal advice.`;
  } else {
    const rules = m.code === "INTL" ? "your local advertising standards" : m.adStandards;
    const platform = comp.channel === "Website" ? "" : " and Meta's ad policies";
    cr.summary = `${b.name} is not in a regulated category, so we checked ${comp.what} against general advertising rules: ${rules}${platform}. ${cr.issues.length} lines need another look${listed ? `, covering ${listed}` : ""}, because claims like these still need proof. The suggested rewrite keeps the offer and the call to action. Compliance Check is a review aid, not legal advice.`;
    cr.issues.forEach((i) => (i.why = GENERAL_WHY[i.rule] ?? i.why));
    cr.flags.forEach((f) => (f.why = GENERAL_WHY[f.family] ?? f.why));
    cr.prescriptions = generalCompliancePrescriptions(cr.issues, comp.channel);
    cr.checklist = [...cr.checklist.filter((l) => !/body parts|weight or skin/i.test(l)), ...(comp.checklist ?? [])];
  }
  // The rules-only rewrite is a word swap. Show the kind of rewrite the full review writes.
  cr.rewritten_copy = comp.rewrite;
  for (const i of cr.issues) {
    const fix = comp.fixes?.find(([start]) => i.quote.startsWith(start));
    if (fix) i.fix = fix[1];
  }

  spec.patch?.({ site, keywords: keywords.result, visibility: visibility.result, content: content.result, ads: ads.result, compliance: compliance.result }, c);

  const reports: SampleReport[] = [
    { agent: "site", result: site, run: { id: SAMPLE_RUN_ID, agent: "site", title: site.title, created_at: ws.created_at, input: { url: ws.website } } },
    keywords,
    visibility,
    content,
    ads,
    compliance,
  ];
  return retext(reports, spec.retext(c));
}

// ---------- Homepage slips ----------

export type HomeSlip = { business: SampleBusiness; agent: AgentId; prescription: Prescription };

/**
 * One prescription each from the renovation company, the cafe and the online store, taken from
 * their sample reports so the homepage and /sample always agree.
 */
export async function homeSampleSlips(m: Market): Promise<HomeSlip[]> {
  const pick = async (id: SampleBusinessId, agent: AgentId, match: (p: Prescription) => boolean): Promise<HomeSlip | null> => {
    const reports = await sampleReports(m, id);
    const list = reports.find((r) => r.agent === agent)?.result.prescriptions ?? [];
    const prescription = list.find(match) ?? list[0];
    return prescription ? { business: SAMPLE_BUSINESSES[id], agent, prescription } : null;
  };
  const slips = await Promise.all([
    pick("renovation", "site", (p) => p.category === "Content"),
    pick("cafe", "visibility", (p) => /FAQ/.test(p.title)),
    pick("store", "ads", (p) => /^Pause/.test(p.title)),
  ]);
  return slips.filter((s): s is HomeSlip => s !== null);
}

// ---------- Social Media Content: sample trends and reference posts ----------

// Live runs link real posts that the trend research found, with the view counts the source showed.
// The sample business is made up, so its references are placeholders: no links, no numbers.

function sampleRef(platform: string, borrow: string): Reference {
  return { platform, url: null, creator: "A creator in your niche", views: null, posted: null, borrow, sample: true };
}

function borrowFor(idea: Idea): { basis: string; borrow: string } {
  const t = `${idea.title} ${idea.hook}`.toLowerCase();
  if (/pov|finally found/.test(t))
    return {
      basis: "POV captions over everyday footage are low effort to film and easy to share with a friend who needs the service.",
      borrow: "Borrow the on-screen POV caption over simple footage of your work. Keep it under 15 seconds.",
    };
  if (/myth|believ|wrong|truth/.test(t))
    return {
      basis: "Myth-versus-fact videos keep working in service niches because the first line names something viewers already believe. Live reports show the posts this borrows from and how they performed.",
      borrow: "Borrow the structure: say the myth in the first line, show the fact on screen, end with one thing to do instead. Use your own wording.",
    };
  if (/question|ask|before you/.test(t))
    return {
      basis: "Checklist posts get saved and shared by people comparing options, which is the moment before they enquire.",
      borrow: "Borrow the numbered format: one question per slide or shot, the answer underneath, and a save prompt at the end.",
    };
  if (/price|cost|paying/.test(t))
    return {
      basis: "Price explainers answer the question most people are too shy to message about, so they bring in enquiries that are ready to talk.",
      borrow: "Borrow the breakdown: show what changes the price, one factor per shot, and end with how to get a quote.",
    };
  return {
    basis: "This format is easy to film in one sitting and fits how people in your niche are posting right now.",
    borrow: "Borrow the pacing: one point per shot, text on screen, under 30 seconds.",
  };
}

function addSampleTrends(cr: ContentResult) {
  for (const idea of cr.ideas.slice(0, 3)) {
    const { basis, borrow } = borrowFor(idea);
    idea.trend_basis = basis;
    idea.references = [sampleRef(idea.platform, borrow)];
  }
  const platforms = [...new Set(cr.ideas.map((i) => i.platform))];
  const a = platforms[0] ?? "Instagram";
  const b = platforms[1] ?? a;
  cr.trends = [
    {
      name: "Myth versus fact explainers",
      what_it_is: "Short videos that open with a belief people in the niche hold, then correct it with one clear fact on screen.",
      how_to_use_it: "Pick the myth you correct most often on calls or in messages and film your answer in under 30 seconds.",
      platform: a,
      shelf_life: "evergreen",
      examples: [sampleRef(a, "Borrow the first line: name the myth in five words or fewer, then cut straight to the fact.")],
    },
    {
      name: "Before-you-book checklists",
      what_it_is: "Carousels and talking-head videos listing the questions to ask before choosing a provider.",
      how_to_use_it: "Turn the five questions you wish every customer asked into a carousel, with your honest answer to each.",
      platform: b,
      shelf_life: "evergreen",
      examples: [sampleRef(b, "Borrow the numbered list and the save prompt at the end. Leave out any claims about competitors.")],
    },
  ];
  cr.trends_note = "";
}
