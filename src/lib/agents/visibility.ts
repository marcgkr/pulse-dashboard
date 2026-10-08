import { z } from "zod";
import { businessContext, normalizePrescription, pick, PrescriptionSchema, research, structured, type Prescription } from "../ai";
import type { WorkspaceRow } from "../db";
import type { AgentContext, AgentDef, AgentResult } from "./types";

// ---------- Types ----------

type Input = {
  prompts: string[];
  brand: string;
  aliases: string[];
  domain: string;
  competitors: string[];
};

export type VisibilitySource = { title: string; url: string };

export type VisibilityPrompt = {
  prompt: string;
  answer: string;
  mentioned: boolean;
  position: number | null;
  cited: boolean;
  businesses: string[];
  competitors_found: string[];
  sources: VisibilitySource[];
  sentiment: "positive" | "neutral" | "negative" | "not mentioned";
  brand_context: string;
  error?: string;
};

export type VisibilityResult = AgentResult & {
  brand: string;
  brand_terms: string[];
  domain: string;
  location: string;
  prompts: VisibilityPrompt[];
  share_of_voice: { name: string; mentions: number; is_brand: boolean }[];
  cited_domains: { domain: string; count: number; kind: string }[];
  insights: string[];
};

export const MAX_PROMPTS = 8;
const ANSWER_CHARS = 1500;

// ---------- Text matching (shared by live and demo) ----------

const LEGAL_SUFFIX = /\b(pte\.?\s*ltd\.?|private\s+limited|sdn\.?\s*bhd\.?|ltd\.?|llp|llc|inc\.?|limited|co\.)\s*$/i;

/** Lowercase, strip accents, apostrophes and punctuation, collapse spaces. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitList(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(/[\n,;|]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const v = item.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    const key = normalizeText(v);
    if (!v || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function cleanDomain(raw: string): string {
  let s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  return s.split(/[/?#:]/)[0] ?? "";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** All the ways a name might be written: as given, without legal suffix, without leading "the". */
function nameVariants(name: string): string[] {
  const base = name.trim();
  const noSuffix = base.replace(LEGAL_SUFFIX, "").trim();
  const noThe = noSuffix.replace(/^the\s+/i, "").trim();
  return [base, noSuffix, noThe].filter(Boolean);
}

/** Normalised match terms for the brand: name, aliases, and the domain's first label. */
export function brandTerms(brand: string, aliases: string[], domain: string): string[] {
  const terms = new Set<string>();
  for (const n of [brand, ...aliases]) for (const v of nameVariants(n)) terms.add(normalizeText(v));
  const d = cleanDomain(domain);
  if (d) {
    const root = d.split(".")[0] ?? "";
    if (root.length >= 4) terms.add(normalizeText(root));
  }
  return [...terms].filter((t) => t.replace(/ /g, "").length >= 3);
}

function termsFor(name: string): string[] {
  return [...new Set(nameVariants(name).map(normalizeText))].filter((t) => t.replace(/ /g, "").length >= 3);
}

/**
 * True when any term appears in the text as whole words. Matching is done on token windows with
 * spaces removed, so "Lash Lab", "LashLab" and "lash-lab" all match each other.
 */
export function mentions(text: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const tokens = normalizeText(text).split(" ").filter(Boolean);
  const compact = terms.map((t) => t.replace(/ /g, "")).filter((t) => t.length >= 3);
  if (!compact.length) return false;
  const set = new Set(compact);
  const maxLen = Math.max(...compact.map((t) => t.length));
  for (let i = 0; i < tokens.length; i++) {
    let acc = "";
    for (let j = i; j < tokens.length && j < i + 6; j++) {
      acc += tokens[j];
      if (set.has(acc)) return true;
      if (acc.length >= maxLen) break;
    }
  }
  return false;
}

/** Top-level list items in an answer (numbered items preferred, bullets otherwise). */
export function listItems(answer: string): string[] {
  const numbered: string[] = [];
  const bullets: string[] = [];
  for (const rawLine of answer.split("\n")) {
    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
    const line = rawLine.replace(/^\s*#{1,6}\s*/, "").replace(/\*\*|__/g, "").trim();
    const num = line.match(/^\d{1,2}[.)]\s+(.+)/);
    if (num) {
      numbered.push(num[1]);
      continue;
    }
    const bul = line.match(/^[-*•]\s+(.+)/);
    if (bul && indent < 2) bullets.push(bul[1]);
  }
  return numbered.length ? numbered : bullets;
}

/** Business name at the start of a list item, e.g. "Zion Aesthetics: known for..." -> "Zion Aesthetics". */
function itemName(item: string): string {
  const cleaned = item.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const name = cleaned.split(/\s+[-\u2013\u2014]\s+|:\s|\s\(|,\s/)[0] ?? "";
  return name.replace(/[*_`#]/g, "").trim().slice(0, 80);
}

export function businessesFromList(answer: string): string[] {
  return listItems(answer)
    .map(itemName)
    .filter((n) => n.length >= 2 && n.split(" ").length <= 8);
}

function positionIn(names: string[], terms: string[]): number | null {
  const i = names.findIndex((n) => mentions(n, terms));
  return i >= 0 ? i + 1 : null;
}

export function trimAnswer(answer: string, max = ANSWER_CHARS): string {
  const a = answer.trim();
  if (a.length <= max) return a;
  const cut = a.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return (lastBreak > max * 0.6 ? cut.slice(0, lastBreak + 1) : cut).trim() + " ...";
}

type Detection = {
  mentioned: boolean;
  cited: boolean;
  position: number | null;
  competitors_found: string[];
  list_businesses: string[];
};

/** Deterministic detection on one answer. */
export function detect(answer: string, sources: VisibilitySource[], input: Input, terms: string[]): Detection {
  const domain = cleanDomain(input.domain);
  const mentioned = mentions(answer, terms) || (!!domain && answer.toLowerCase().includes(domain));
  const cited =
    !!domain &&
    (sources.some((s) => {
      const h = hostOf(s.url);
      return h === domain || h.endsWith("." + domain);
    }) ||
      answer.toLowerCase().includes(domain));
  const list_businesses = businessesFromList(answer);
  const position = mentioned ? positionIn(listItems(answer), terms) : null;
  const competitors_found = input.competitors.filter((c) => mentions(answer, termsFor(c)));
  return { mentioned, cited, position, competitors_found, list_businesses };
}

export function promptScore(p: { mentioned: boolean; cited: boolean }): number {
  return p.mentioned && p.cited ? 100 : p.mentioned ? 70 : 0;
}

export function visibilityScore(prompts: { mentioned: boolean; cited: boolean; error?: string }[]): number {
  const counted = prompts.filter((p) => !p.error);
  if (!counted.length) return 0;
  return Math.round(counted.reduce((s, p) => s + promptScore(p), 0) / counted.length);
}

export function shareOfVoice(prompts: VisibilityPrompt[], input: Input, terms: string[]) {
  const counts = new Map<string, { name: string; hits: Set<number>; is_brand: boolean }>();
  const brandKey = normalizeText(input.brand);
  counts.set(brandKey, { name: input.brand, hits: new Set(), is_brand: true });
  const compTerms = input.competitors.map((c) => ({ name: c, terms: termsFor(c) }));
  prompts.forEach((p, i) => {
    if (p.mentioned) counts.get(brandKey)!.hits.add(i);
    const add = (name: string) => {
      if (mentions(name, terms)) {
        counts.get(brandKey)!.hits.add(i);
        return;
      }
      const comp = compTerms.find((c) => mentions(name, c.terms) || mentions(c.name, termsFor(name)));
      const display = comp ? comp.name : name;
      const key = normalizeText(display);
      if (!key) return;
      if (!counts.has(key)) counts.set(key, { name: display, hits: new Set(), is_brand: false });
      counts.get(key)!.hits.add(i);
    };
    p.competitors_found.forEach(add);
    p.businesses.forEach(add);
  });
  const rows = [...counts.values()].map((c) => ({ name: c.name, mentions: c.hits.size, is_brand: c.is_brand }));
  const brandRow = rows.find((r) => r.is_brand)!;
  const others = rows.filter((r) => !r.is_brand && r.mentions > 0).sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
  return [brandRow, ...others.slice(0, 9)].sort((a, b) => b.mentions - a.mentions || (a.is_brand ? -1 : b.is_brand ? 1 : 0));
}

const KIND_RULES: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$|maps\.app\.goo\.gl|g\.page/, "Google Maps / Business Profile"],
  [/reddit\.com|quora\.com|hardwarezone\.com|forums?\./, "Reddit / forum"],
  [/tripadvisor|yelp\.|trustpilot|foursquare|wanderlog/, "Review site"],
  [/facebook\.com|instagram\.com|tiktok\.com|youtube\.com|xiaohongshu|lemon8/, "Social / video"],
  [/fresha|booksy|treatwell|vaniday|klook|myfave|fave\.co|groupon|chope|shopback|calendly/, "Booking / deal platform"],
  [/yellowpages|streetdirectory|sgdirectory|hotfrog|cybo|yably|healthhub|doctoruna|practo|sgdoctor|lawyers?\.(com|sg)|singaporelegaladvice/, "Directory"],
  [/sethlui|thesmartlocal|honeycombers|timeout|eatbook|ladyironchef|danielfooddiary|misstamchiak|herworld|harpersbazaar|vogue|cleo|womensweekly|femalemag|theasianparent|mothership|straitstimes|channelnewsasia|cna\.|todayonline|vulcanpost|goodyfeed|expatliving|sassymamasg|littledayout|beautyinsider|bestinsingapore|thebestsingapore|thesmartlocal|propertyguru|moneysmart|seedly|dollarsandsense|guide\.|best[a-z]*\./, "Listicle / media"],
  [/wikipedia\.org/, "Wikipedia"],
];

export function domainKind(host: string, brandDomain: string): string {
  const d = cleanDomain(brandDomain);
  if (d && (host === d || host.endsWith("." + d))) return "Your website";
  for (const [re, kind] of KIND_RULES) if (re.test(host)) return kind;
  return "Business or other website";
}

export function citedDomains(prompts: VisibilityPrompt[], brandDomain: string) {
  const counts = new Map<string, number>();
  for (const p of prompts) {
    const hosts = new Set(p.sources.map((s) => hostOf(s.url)).filter(Boolean));
    for (const h of hosts) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return [...counts]
    .map(([domain, count]) => ({ domain, count, kind: domainKind(domain, brandDomain) }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 15);
}

// ---------- Input ----------

function defaultDomain(ws: WorkspaceRow): string {
  return cleanDomain(ws.website || "");
}

function parse(raw: unknown, ws: WorkspaceRow): Input {
  const r = (raw ?? {}) as Record<string, unknown>;
  const promptsRaw = Array.isArray(r.prompts) ? r.prompts.map(String) : String(r.prompts ?? "").split("\n");
  const seen = new Set<string>();
  const prompts: string[] = [];
  for (const p of promptsRaw) {
    const v = p.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").replace(/\s+/g, " ").trim().slice(0, 200);
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    prompts.push(v);
  }
  if (!prompts.length) throw new Error("Add at least one question a customer might ask an AI assistant.");
  if (prompts.length > MAX_PROMPTS) throw new Error(`Use up to ${MAX_PROMPTS} questions per check. You have ${prompts.length}.`);
  const brand = String(r.brand ?? "").trim() || ws.name;
  if (!brand) throw new Error("Add your brand name.");
  const brandKey = normalizeText(brand);
  return {
    prompts,
    brand,
    aliases: splitList(r.aliases).filter((a) => normalizeText(a) !== brandKey).slice(0, 6),
    domain: cleanDomain(String(r.domain ?? "")) || defaultDomain(ws),
    competitors: splitList(r.competitors ?? ws.competitors).filter((c) => normalizeText(c) !== brandKey).slice(0, 10),
  };
}

// ---------- Live run ----------

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const ASSISTANT_SYSTEM = `For this task you are NOT acting as a MarketingRx agent and you are not prescribing anything.
You are simulating a general-purpose AI assistant (like ChatGPT, Perplexity, Gemini or Google AI Mode) answering a real customer's question.
- Search the web first, then answer the way a helpful assistant would for someone in the stated location.
- Name specific, real businesses. Give a short numbered list (3 to 7 businesses), each starting with the business name, then one line on why it fits and what sources say about it.
- After the list, add 1 to 3 short tips on how to choose.
- Only name businesses you found in your search results. Never invent businesses, prices or ratings.
- Do not mention MarketingRx or PULSE Digital. Do not favour any business for any reason other than what your sources say.`;

const VisAI = z.object({
  summary: z
    .string()
    .describe("2-4 sentences for the owner: how visible the brand is in AI answers, who shows up instead, and the single most useful next step."),
  prompts: z
    .array(
      z.object({
        number: z.number().describe("The prompt number exactly as given (1-based)"),
        businesses: z
          .array(z.string())
          .describe("Every business named in that answer, in the order they first appear. Business names only, as written in the answer. Empty array if none."),
        brand_sentiment: z.string().describe("Exactly one of: positive, neutral, negative, not mentioned"),
        brand_context: z
          .string()
          .describe("If the brand is mentioned: one sentence on how the answer describes it. Otherwise an empty string."),
      }),
    )
    .describe("One entry per prompt, same order as given"),
  domains: z
    .array(
      z.object({
        domain: z.string().describe("Domain exactly as listed under CITED DOMAINS"),
        kind: z
          .string()
          .describe(
            "Exactly one of: Directory, Review site, Listicle / media, Reddit / forum, Google Maps / Business Profile, Social / video, Booking / deal platform, Wikipedia, Your website, Business or other website",
          ),
      }),
    )
    .describe("Classify each domain listed under CITED DOMAINS"),
  insights: z
    .array(z.string())
    .describe(
      "3-6 short observations on WHY the named businesses get recommended: which kinds of sources the answers drew from (directories, review sites, listicles, Reddit, Google Business Profile, their own sites) and what those sources have that the brand lacks. Refer to actual domains and businesses from the data.",
    ),
  prescriptions: z
    .array(PrescriptionSchema)
    .describe(
      "5-8 fixes to get the brand named and cited, most valuable first. Be specific: name the exact listicles, directories or review sites from the data to get listed on, the FAQ questions to add (matching the prompts), schema to add, how to earn Google reviews. Category 'AI Visibility' unless clearly another.",
    ),
});

async function runLive(input: Input, ctx: AgentContext): Promise<VisibilityResult> {
  const terms = brandTerms(input.brand, input.aliases, input.domain);
  const location = ctx.ws.location || "Singapore";
  const n = input.prompts.length;
  const raw = await pool(input.prompts, 2, async (prompt, i) => {
    ctx.progress(`Asking an AI assistant: "${prompt}" (${i + 1} of ${n})`);
    try {
      const r = await research({
        system: ASSISTANT_SYSTEM,
        prompt: `A customer in ${location} asks you:\n\n"${prompt}"\n\nSearch the web and answer them.`,
        maxSearches: 3,
        effort: "low",
      });
      return { prompt, text: r.text, sources: r.sources.slice(0, 20), error: undefined as string | undefined };
    } catch (e) {
      return { prompt, text: "", sources: [] as VisibilitySource[], error: (e as Error).message || "This question failed." };
    }
  });
  if (raw.every((r) => r.error)) throw new Error(raw[0]?.error || "The AI assistant could not answer any of the questions.");

  ctx.progress("Checking each answer for your brand");
  const detections = raw.map((r) => detect(r.text, r.sources, input, terms));
  const preliminary: VisibilityPrompt[] = raw.map((r, i) => ({
    prompt: r.prompt,
    answer: trimAnswer(r.text),
    mentioned: detections[i].mentioned,
    position: detections[i].position,
    cited: detections[i].cited,
    businesses: detections[i].list_businesses,
    competitors_found: detections[i].competitors_found,
    sources: r.sources,
    sentiment: detections[i].mentioned ? "neutral" : "not mentioned",
    brand_context: "",
    ...(r.error ? { error: r.error } : {}),
  }));
  const domains = citedDomains(preliminary, input.domain);

  ctx.progress("Working out why competitors get named");
  const ai = await structured({
    system:
      "You are AI Visibility, a specialist in getting local businesses recommended and cited by AI assistants (answer engine and generative engine optimisation). You receive real AI assistant answers to customer questions and turn them into a diagnosis and fix list. AI assistants pull recommendations mostly from third-party sources: 'best of' listicles, directories, review sites, Reddit and forums, Google Business Profile reviews, and well-structured business websites with clear FAQ and schema.",
    prompt: `BUSINESS PROFILE
${businessContext(ctx.ws)}

BRAND WE ARE TRACKING: ${input.brand}${input.aliases.length ? ` (also written as: ${input.aliases.join(", ")})` : ""}
BRAND WEBSITE: ${input.domain || "not given"}
KNOWN COMPETITORS: ${input.competitors.join(", ") || "none given"}

${raw
  .map((r, i) => {
    const d = detections[i];
    if (r.error) return `PROMPT ${i + 1}: "${r.prompt}"\n(This question failed to run. Return an empty businesses list.)`;
    return `PROMPT ${i + 1}: "${r.prompt}"
Code check: brand mentioned=${d.mentioned ? "yes" : "no"}, brand website among sources=${d.cited ? "yes" : "no"}, competitors named=${d.competitors_found.join(", ") || "none"}
ANSWER:
${r.text.slice(0, 3500)}
SOURCES THE ASSISTANT FOUND:
${r.sources.slice(0, 10).map((s) => `- ${s.title} | ${s.url}`).join("\n") || "- none"}`;
  })
  .join("\n\n---\n\n")}

CITED DOMAINS (number of prompts each domain was a source for)
${domains.map((d) => `- ${d.domain}: ${d.count}`).join("\n") || "- none"}

Extract the businesses per prompt, classify the domains, explain why the businesses that got named got named, and prescribe how ${input.brand} gets named and cited for these questions. Do not invent review counts, ratings or rankings that are not in the answers.`,
    schema: VisAI,
    effort: "medium",
  });

  const byNumber = new Map(ai.prompts.map((p) => [Math.round(Number(p.number)), p]));
  const prompts: VisibilityPrompt[] = preliminary.map((p, i) => {
    const x = byNumber.get(i + 1) ?? ai.prompts[i];
    if (!x || p.error) return p;
    const businesses = x.businesses.map((b) => b.trim()).filter(Boolean);
    const position = p.mentioned ? (positionIn(businesses, terms) ?? p.position) : null;
    return {
      ...p,
      businesses: businesses.length ? businesses : p.businesses,
      position,
      sentiment: p.mentioned
        ? (pick(x.brand_sentiment, ["positive", "neutral", "negative"] as const, "neutral") as VisibilityPrompt["sentiment"])
        : "not mentioned",
      brand_context: p.mentioned ? x.brand_context.trim() : "",
    };
  });

  const kinds = new Map(ai.domains.map((d) => [cleanDomain(d.domain), d.kind.trim()]));
  const cited = domains.map((d) => ({ ...d, kind: d.kind === "Your website" ? d.kind : kinds.get(d.domain) || d.kind }));
  const score = visibilityScore(prompts);

  return {
    title: runTitle(input),
    score,
    summary: ai.summary,
    brand: input.brand,
    brand_terms: [input.brand, ...input.aliases],
    domain: input.domain,
    location,
    prompts,
    share_of_voice: shareOfVoice(prompts, input, terms),
    cited_domains: cited,
    insights: ai.insights,
    prescriptions: ai.prescriptions.map(normalizePrescription),
  };
}

// ---------- Demo (no API key) ----------

function sampleCompetitors(input: Input): string[] {
  if (input.competitors.length >= 2) return input.competitors.slice(0, 5);
  return [...input.competitors, "Sample Competitor A", "Sample Competitor B", "Sample Competitor C"].slice(0, 4);
}

const SAMPLE_SOURCES: VisibilitySource[] = [
  { title: "Sample source: Google Maps listings", url: "https://www.google.com/maps" },
  { title: "Sample source: r/singapore threads", url: "https://www.reddit.com/r/singapore/" },
  { title: "Sample source: 'best of' listicle site", url: "https://thesmartlocal.com/" },
  { title: "Sample source: lifestyle guide", url: "https://www.honeycombers.com/singapore/" },
  { title: "Sample source: review site", url: "https://www.tripadvisor.com.sg/" },
];

function sampleAnswer(prompt: string, names: string[], location: string): string {
  const reasons = [
    "appears in several 'best of' roundups and has many recent Google reviews",
    "often recommended in Reddit threads for being consistent and transparent on pricing",
    "has a detailed services page with an FAQ, so it is easy to tell what to expect",
    "well rated on Google Maps, with reviewers mentioning friendly staff",
    "listed on a popular local guide for this service",
  ];
  const lines = names.map((n, i) => `${i + 1}. **${n}**: ${reasons[i % reasons.length]}.`);
  return `Here are some places people in ${location} often recommend for "${prompt}":

${lines.join("\n")}

Tips: compare recent Google reviews, check that prices are listed up front, and book a consultation before committing to a package.`;
}

async function runDemo(input: Input, ctx: AgentContext): Promise<VisibilityResult> {
  const terms = brandTerms(input.brand, input.aliases, input.domain);
  const location = ctx.ws.location || "Singapore";
  const comps = sampleCompetitors(input);
  ctx.progress("Building sample answers");

  const prompts: VisibilityPrompt[] = input.prompts.map((prompt, i) => {
    const rotated = comps.map((_, k) => comps[(k + i) % comps.length]).slice(0, Math.min(4, comps.length));
    // Sample pattern: the brand shows up in one prompt in three, low in the list and never cited.
    const includeBrand = i % 3 === 1;
    const names = includeBrand ? [...rotated.slice(0, 2), input.brand, ...rotated.slice(2)] : rotated;
    const sources = SAMPLE_SOURCES.filter((_, k) => (k + i) % 2 === 0 || k === 0);
    const answer = sampleAnswer(prompt, names, location);
    const d = detect(answer, sources, input, terms);
    return {
      prompt,
      answer: trimAnswer(answer),
      mentioned: d.mentioned,
      position: d.position,
      cited: d.cited,
      businesses: d.list_businesses,
      competitors_found: d.competitors_found,
      sources,
      sentiment: d.mentioned ? "neutral" : "not mentioned",
      brand_context: d.mentioned ? "Sample: listed briefly with a one-line description, below better-reviewed competitors." : "",
    };
  });

  const score = visibilityScore(prompts);
  const mentionedCount = prompts.filter((p) => p.mentioned).length;
  const sov = shareOfVoice(prompts, input, terms);
  const leader = sov.find((s) => !s.is_brand);
  const domains = citedDomains(prompts, input.domain);

  return {
    title: runTitle(input),
    score,
    summary: `This is sample output (no AI key is connected), so the answers below are made up to show the report. In this sample, ${input.brand} is named in ${mentionedCount} of ${prompts.length} answers and its website is never a source, while ${leader?.name ?? "competitors"} shows up most. The detection and scoring are the real code; connect the AI to ask real questions.`,
    brand: input.brand,
    brand_terms: [input.brand, ...input.aliases],
    domain: input.domain,
    location,
    prompts,
    share_of_voice: sov,
    cited_domains: domains,
    insights: [
      "Sample insight: the businesses that get named appear in local 'best of' listicles and lifestyle guides, which AI assistants read and quote.",
      "Sample insight: answers lean on Google Maps reviews. Businesses with many recent reviews that mention the service by name get recommended more.",
      "Sample insight: Reddit threads are a common source. A business that real customers mention there gets picked up.",
      `Sample insight: ${input.domain || "your website"} was never used as a source, which usually means service pages do not answer the question directly (no FAQ, no prices, no location details).`,
    ],
    prescriptions: demoPrescriptions(input, domains, location),
    demo: true,
  };
}

function demoPrescriptions(input: Input, domains: { domain: string; kind: string }[], location: string): Prescription[] {
  const third = domains.filter((d) => !["Your website", "Business or other website"].includes(d.kind)).slice(0, 4).map((d) => d.domain);
  const site = input.domain || "your website";
  return [
    {
      title: "Get listed on the guides and directories AI assistants are reading",
      diagnosis: `The answers drew on third-party sites${third.length ? ` such as ${third.join(", ")}` : ""}. AI assistants recommend businesses those sites already mention.`,
      steps: [
        "Open each site in the 'most cited domains' list and find the article or category page for your service.",
        "For listicles: email the writer or editor with a short pitch (what you do, what makes you different, your address, photos, price range).",
        "For directories and booking platforms: create or claim your free listing and fill in every field, including services and prices.",
        "Keep a simple list of where you pitched and follow up after two weeks.",
      ],
      where: "Email and each site's 'add a business' or contact page",
      priority: "high", impact: "high", effort: "project", category: "AI Visibility", recheck_days: 45,
    },
    {
      title: "Ask every happy customer for a Google review that names the service",
      diagnosis: "AI answers lean on Google Maps reviews. Reviews that mention the service and area help assistants match you to questions like these.",
      steps: [
        "In Google Business Profile, click 'Ask for reviews' and copy your review link.",
        "Send it on WhatsApp after each visit: 'Thanks for coming in today! If you were happy with your [service], a short Google review would really help us.'",
        "Reply to every review within a few days.",
        "Check your categories and services in Google Business Profile match the questions you are tracking.",
      ],
      where: "Google Business Profile > Ask for reviews",
      priority: "high", impact: "high", effort: "quick", category: "Local SEO", recheck_days: 30,
    },
    {
      title: "Add an FAQ to each service page that answers these exact questions",
      diagnosis: `${site} was not used as a source. Assistants quote pages that answer the question directly in a few sentences.`,
      steps: [
        "For each question you tracked, write a 40 to 60 word answer that names your service, your area and what to expect.",
        `Put it on the matching service page under a heading that repeats the question (for example 'Where can I get this in ${location}?').`,
        "Include price ranges, opening hours and how to book where it fits.",
        "Mark the section up as FAQPage schema (most SEO plugins have an FAQ block that does this).",
      ],
      where: "Website service pages",
      priority: "high", impact: "medium", effort: "half-day", category: "AI Visibility", recheck_days: 30,
    },
    {
      title: "Add LocalBusiness schema with your name, address and services",
      diagnosis: "Structured data helps assistants connect your brand name to your services and location.",
      steps: [
        "Use the LocalBusiness type that fits (for example MedicalClinic, BeautySalon or LegalService).",
        "Include name, address, phone, opening hours, website, and sameAs links to your Google Business Profile and social pages.",
        "Test it at search.google.com/test/rich-results.",
      ],
      where: "Homepage <head> or your SEO plugin's schema settings",
      priority: "medium", impact: "medium", effort: "quick", category: "AI Visibility", recheck_days: 30,
    },
    {
      title: "Re-run this check every month with the same questions",
      diagnosis: "AI answers change over time and between assistants. Tracking the same questions shows whether your fixes are working.",
      steps: [
        "Keep the same list of questions so results are comparable.",
        "Also try two or three of them yourself in ChatGPT, Perplexity and Google, and note who gets named.",
      ],
      where: "MarketingRx > AI Visibility",
      priority: "low", impact: "medium", effort: "quick", category: "AI Visibility", recheck_days: 30,
    },
  ];
}

// ---------- Agent ----------

function runTitle(input: Input): string {
  return `AI visibility: ${input.brand} (${input.prompts.length} question${input.prompts.length === 1 ? "" : "s"})`;
}

export const visibilityAgent: AgentDef<Input> = {
  id: "visibility",
  name: "AI Visibility",
  blurb: "Checks whether AI assistants recommend you, and who they name instead.",
  description:
    "Asks an AI assistant with web search the questions your customers ask, like 'best lash extension salon in Orchard'. Checks whether your business is named, where it ranks, whether your website is a source, and which competitors show up. Then shows which sites the AI is reading so you know where to get listed.",
  parseInput: parse,
  runTitle: (input) => runTitle(input),
  run: runLive,
  demo: runDemo,
};
