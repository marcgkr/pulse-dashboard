import type { WorkspaceRow } from "./db";
import type { Market } from "./markets";
import type { AgentContext, AgentId, AgentResult } from "./agents/types";
import { scoreChecks, type Check, type SiteAudit } from "./agents/site-audit";
import { rulePrescriptions } from "./agents/site";
import { keywordsAgent } from "./agents/keywords";
import { visibilityAgent } from "./agents/visibility";
import { contentAgent } from "./agents/content";
import { adsAgent } from "./agents/ads";
import { complianceAgent } from "./agents/compliance";

// The public sample report (/sample). A fictional clinic in the visitor's market, run through the
// real agents' demo() functions at request time. None of these touch the network: keywords,
// visibility, content, ads (source "sample") and compliance (text only) are pure. Site Doctor's
// demo crawls a real site, so it gets a static audit fixture below instead.

export const SAMPLE_RUN_ID = "sample";
export const SAMPLE_BRAND = "Lumen Aesthetics";
const SAMPLE_DOMAIN = "lumen-aesthetics.example";

export type SampleReport = {
  agent: AgentId;
  result: AgentResult;
  run: { id: string; agent: string; title: string; created_at: string; input: Record<string, unknown> };
};

/** Where the fictional clinic is. "Anywhere else" has no real place, so it gets a made-up one. */
function sampleArea(m: Market): string {
  return m.code === "INTL" ? "Riverside" : m.exampleArea;
}

export function sampleWorkspace(m: Market): WorkspaceRow {
  const area = sampleArea(m);
  return {
    id: "sample",
    owner_id: "sample",
    name: SAMPLE_BRAND,
    website: `https://www.${SAMPLE_DOMAIN}`,
    industry: "Aesthetic clinic",
    location: m.code === "INTL" ? area : `${area}, ${m.name}`,
    country: m.code,
    audience: "Women and men aged 28 to 50 who want help with pigmentation, acne scars and early signs of ageing",
    offers: "Pico laser for pigmentation, Acne scar treatment, Hydrafacial, Skin consultation",
    competitors: "Halcyon Skin Clinic, Atlas Aesthetics, Fernleaf Dermatology",
    goals: "More consultation bookings from the website and ads",
    monthly_budget: "",
    tone: "Warm, clear and factual",
    regulated: 1,
    plan: "growth",
    stripe_customer_id: null,
    windsor_api_key: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function ctxFor(ws: WorkspaceRow): AgentContext {
  return { ws, runId: SAMPLE_RUN_ID, progress: () => {} };
}

// ---------- Site Doctor fixture ----------

function siteChecks(m: Market): Check[] {
  // Same wording as buildChecks() in site-audit.ts, for a site with one enquiry form and no
  // tap-to-call or chat links.
  const where = m.code === "INTL" ? "For many customers" : `In ${m.inPhrase}`;
  const chat =
    m.messaging === "SMS"
      ? {
          id: "messaging",
          label: "Tap-to-text or click-to-call",
          count: "WhatsApp links: 0, text (sms:) links: 0, forms: ",
          detail: `No tap-to-call or tap-to-text link. ${where} many customers call or text a local business straight from their phone.`,
        }
      : m.messaging === "Messenger"
        ? { id: "messaging", label: "Messenger click-to-chat", count: "Messenger links: 0, WhatsApp links: 0, forms: ", detail: `No Messenger (m.me) link. ${where} this is often the fastest way customers enquire.` }
        : m.messaging === "LINE"
          ? { id: "messaging", label: "LINE click-to-chat", count: "LINE links: 0, WhatsApp links: 0, forms: ", detail: `No LINE link. ${where} this is often the fastest way customers enquire.` }
          : { id: "whatsapp", label: "WhatsApp click-to-chat", count: "WhatsApp links: 0, forms: ", detail: `No WhatsApp link. ${where} this is often the fastest way customers enquire.` };
  const c = (id: string, group: Check["group"], label: string, status: Check["status"], detail: string, weight: number): Check => ({ id, group, label, status, detail, weight });
  return [
    c("https", "Technical", "Secure connection (HTTPS)", "pass", "Site loads over HTTPS.", 3),
    c("viewport", "Technical", "Mobile-friendly viewport", "pass", "Viewport tag present.", 3),
    c("speed", "Technical", "Server response time", "warn", "Homepage HTML arrived in 2.4s from our server.", 2),
    c("weight", "Technical", "Page weight", "pass", "Homepage HTML is 212 KB before images and scripts.", 1),
    c("robots", "Technical", "robots.txt", "pass", "Found.", 1),
    c("sitemap", "Technical", "XML sitemap", "pass", "Found.", 2),
    c("noindex", "Technical", "Homepage is indexable", "pass", "No noindex tag on the homepage.", 4),
    c("broken", "Technical", "Inner pages load", "pass", "All 3 inner pages we opened loaded.", 2),
    c("lang", "Technical", "Language declared", "pass", 'lang="en"', 1),
    c("title", "On-page", "Homepage title", "warn", '"Home | Lumen" (12 characters; 30 to 60 reads best in Google).', 3),
    c("description", "On-page", "Meta description", "fail", "No meta description, so Google picks a random snippet.", 2),
    c("h1", "On-page", "One clear H1 headline", "pass", '"Glow with confidence"', 2),
    c("content", "On-page", "Enough words on the homepage", "pass", "About 520 words of readable text.", 2),
    c("alt", "On-page", "Image alt text", "warn", "4 of 14 images have no alt text.", 1),
    c("inner-meta", "On-page", "Inner page titles and descriptions", "warn", "0 duplicate title(s), 2 page(s) missing a meta description, out of 3 checked.", 2),
    c("og", "On-page", "Social share preview", "pass", "Open Graph title and image set.", 1),
    c("canonical", "On-page", "Canonical tag", "pass", "Set.", 1),
    c("contact", "Conversion", "Easy ways to get in touch", "warn", `Tap-to-call links: 0, ${chat.count}1.`, 4),
    c(chat.id, "Conversion", chat.label, "warn", chat.detail, 2),
    c("booking", "Conversion", "Online booking or enquiry form", "pass", "Enquiry form found.", 2),
    c("analytics", "Tracking", "Website analytics", "pass", "Google Analytics 4", 3),
    c("ad-pixels", "Tracking", "Ad conversion tracking", "warn", "No Meta Pixel or Google Ads tag found. Ads can't learn who converts.", 2),
    c("schema-biz", "AI search", "Business schema markup", "fail", "No structured data. AI assistants and Google have to guess what you are.", 3),
    c("faq", "AI search", "Answers to common questions", "warn", "No FAQ section. Question-and-answer content is what AI assistants quote.", 2),
    c("llms", "AI search", "llms.txt file", "warn", "No /llms.txt. It's a simple file that tells AI assistants what your business does.", 1),
  ];
}

function siteAudit(m: Market): SiteAudit {
  const checks = siteChecks(m);
  const { score, groupScores } = scoreChecks(checks);
  const base = `https://www.${SAMPLE_DOMAIN}`;
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
    host: `www.${SAMPLE_DOMAIN}`,
    platform: "WordPress",
    home: {
      ...page("/", "Home | Lumen", "", 520),
      ms: 2400,
      h1: ["Glow with confidence"],
      h2: ["Our treatments", "Meet the doctors", "Visit us"],
      bytes: 217_000,
      lang: "en",
      viewport: true,
      ogTitle: "Lumen Aesthetics",
      ogImage: `${base}/og.jpg`,
      schemaTypes: [],
      imagesTotal: 14,
      imagesMissingAlt: 4,
      internalLinks: 38,
      phoneLinks: 0,
      whatsappLinks: 0,
      smsLinks: 0,
      messengerLinks: 0,
      lineLinks: 0,
      emailLinks: 1,
      forms: 1,
      bookingWidget: "",
      trackers: ["Google Analytics 4"],
      textSample: "",
    },
    pages: [
      page("/treatments/pico-laser/", "Pico Laser | Lumen", "", 610),
      page("/treatments/acne-scars/", "Acne Scar Treatment | Lumen", "", 480),
      page("/about/", "About Us | Lumen", "Meet the doctors and team at Lumen Aesthetics.", 390),
    ],
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

function siteResult(m: Market): AgentResult {
  const audit = siteAudit(m);
  const area = sampleArea(m);
  const chatThing = m.messaging === "SMS" ? "tap-to-call or tap-to-text link" : `${m.messaging} button`;
  return {
    title: `Site checkup: ${audit.host}`,
    score: audit.score,
    summary: `The site loads well and is set up for Google to read, but it makes booking harder than it needs to be. There is no ${chatThing}, the homepage title is just "Home | Lumen", and there is no meta description, so the search listing gives people little reason to click. Start with the contact button and the title, then add the FAQ and schema so AI assistants can quote you.`,
    strengths: [
      "Secure connection (HTTPS): site loads over HTTPS.",
      "Mobile-friendly viewport: pages fit phone screens.",
      "Website analytics: Google Analytics 4 is installed, so you can see where visitors come from.",
      "XML sitemap: found, so Google can discover every treatment page.",
    ],
    rewrite: {
      title: `Pico Laser and Acne Scar Treatment in ${area} | Lumen`,
      meta_description: `Doctor-led pigmentation and acne scar treatments in ${area}. See what each treatment involves, typical downtime and fees, then book a consultation.`,
      h1: `Doctor-led skin treatments in ${area}`,
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
        question: `Where is Lumen Aesthetics in ${area}?`,
        answer: `We are in ${area}, a short walk from the main bus and train stops. Opening hours and directions are on our contact page, and you can book a consultation online.`,
      },
      {
        question: "What happens at a skin consultation?",
        answer:
          "A doctor looks at your skin, asks about your concerns and medical history, and explains which treatments may suit you, how many sessions are usual and the fees. There is no obligation to book a treatment.",
      },
    ],
    audit,
    prescriptions: rulePrescriptions(audit),
    demo: true,
  };
}

// ---------- The other five, from their real demo() ----------

function stripPrefix(s: string, prefix: string) {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

const COMPLIANCE_COPY = (area: string) =>
  `The best pico laser clinic in ${area}. Guaranteed results with zero downtime. Our doctors have treated thousands of happy patients, see the before and after photos! Book this month and get 50% off your first session. Read what our patients say: "My skin has never looked better."`;

function visibilityPrompts(m: Market): string[] {
  const area = sampleArea(m);
  return [
    `best pico laser clinic in ${area}`,
    `where to treat pigmentation in ${area}`,
    `acne scar treatment ${area} recommendations`,
    `hydrafacial near ${area}`,
    `how much does pico laser cost in ${m.code === "INTL" ? area : m.name}`,
    `doctor-led aesthetic clinic ${area}`,
  ];
}

async function demoOf(agent: AgentId, raw: Record<string, unknown>, ws: WorkspaceRow): Promise<SampleReport> {
  const def = { keywords: keywordsAgent, visibility: visibilityAgent, content: contentAgent, ads: adsAgent, compliance: complianceAgent }[agent as Exclude<AgentId, "site">];
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
// market per day.
const cache = new Map<string, Promise<SampleReport[]>>();

/** Every specialist's report for the fictional clinic, in the visitor's market. */
export function sampleReports(m: Market): Promise<SampleReport[]> {
  const key = `${m.code}:${new Date().toISOString().slice(0, 10)}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 50) cache.clear();
    // Round-trip through JSON, as a stored run would, so client report components get plain data.
    hit = buildSampleReports(m).then((r) => JSON.parse(JSON.stringify(r)) as SampleReport[]);
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}

async function buildSampleReports(m: Market): Promise<SampleReport[]> {
  const ws = sampleWorkspace(m);
  const area = sampleArea(m);

  const site = siteResult(m);
  const [keywords, visibility, content, ads, compliance] = await Promise.all([
    demoOf("keywords", { seeds: "pico laser, acne scar treatment, hydrafacial" }, ws),
    demoOf(
      "visibility",
      { prompts: visibilityPrompts(m), brand: SAMPLE_BRAND, domain: SAMPLE_DOMAIN, competitors: ws.competitors },
      ws,
    ),
    demoOf("content", { platforms: ["Instagram", "TikTok"], per_week: 3, count: 6, trends: false }, ws),
    demoOf("ads", { source: "sample" }, ws),
    demoOf("compliance", { text: COMPLIANCE_COPY(area), channel: "Meta ad", category: "Aesthetic clinic" }, ws),
  ]);

  // The demo summaries are written for a signed-in owner without an AI key. Rewrite them for a
  // visitor reading a sample, using the numbers the real code computed.
  keywords.result.summary = `Three services became keyword groups sorted by what the searcher wants: to book, to compare or to learn. Each group is mapped to the page on the site that should rank for it, with a brief for any page that does not exist yet. Demand and difficulty are estimates for comparing groups, not search volumes; paste a Search Console export and the map uses real numbers.`;

  const vr = visibility.result as AgentResult & {
    prompts: { mentioned: boolean; brand_context: string }[];
    insights: string[];
    share_of_voice: { name: string; is_brand: boolean }[];
  };
  const named = vr.prompts.filter((p) => p.mentioned).length;
  const leader = vr.share_of_voice.find((s) => !s.is_brand)?.name;
  vr.summary = `We asked ${vr.prompts.length} questions a patient might type into ChatGPT or Perplexity. ${SAMPLE_BRAND} is named in ${named} of ${vr.prompts.length} answers and its website is never used as a source${leader ? `, while ${leader} shows up most` : ""}. The answers below are made up for this sample; the detection and scoring are the real code.`;
  vr.insights = vr.insights.map((s) => stripPrefix(s, "Sample insight: "));
  vr.prompts.forEach((p) => (p.brand_context = stripPrefix(p.brand_context, "Sample: ")));

  content.result.summary = `Six post ideas for Instagram and TikTok, written to stay inside the advertising rules for clinics in ${m.inPhrase}. Each one has the hook word for word, a shot list, a caption and hashtags to paste, and a slot in a two-week calendar at three posts a week. With live research on, ideas also use what is trending in your niche this month.`;

  const ar = ads.result as AgentResult & { sample?: boolean };
  ar.summary = `${ar.summary}`.replace(/This is sample data, not [^.]*\. Upload [^.]*\./, "").trim();

  const cr = compliance.result as AgentResult & { issues: { rule: string }[]; rewritten_copy: string };
  const FAMILY_WORDS: Record<string, string> = {
    Superlative: "a ranking claim",
    "Guarantee / absolute claim": "a guarantee",
    "Testimonial / endorsement": "a patient testimonial",
    "Before and after": "before-and-after photos",
    "Inducement / discount": "a discount",
    "Urgency / pressure": "a pressure line",
    "Comparative claim": "a comparison with other clinics",
    "Personal attributes": "a line about the reader's body",
    "Unsupported health claim": "an unsupported health claim",
  };
  const families = [...new Set(cr.issues.map((i) => FAMILY_WORDS[i.rule] ?? i.rule.toLowerCase()))];
  const listed = families.length > 1 ? `${families.slice(0, -1).join(", ")} and ${families.at(-1)}` : families[0];
  cr.summary = `We checked a draft Meta ad against the rules for clinics in ${m.inPhrase}. ${cr.issues.length} lines need another look${listed ? `, covering ${listed}` : ""}. The suggested rewrite keeps the call to book and drops the claims. Compliance Check is a review aid, not legal advice.`;
  // The rules-only rewrite is a word swap. Show the kind of rewrite the full review writes.
  cr.rewritten_copy = `Pico laser treatment for pigmentation in ${area}. Your doctor will assess your skin, explain the results you can expect and any downtime, and give you a treatment plan with fees at your consultation. Book a consultation online or message us with your questions.`;

  return [
    { agent: "site", result: site, run: { id: SAMPLE_RUN_ID, agent: "site", title: site.title, created_at: ws.created_at, input: { url: ws.website } } },
    keywords,
    visibility,
    content,
    ads,
    compliance,
  ];
}
