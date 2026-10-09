import * as cheerio from "cheerio";
import { z } from "zod";
import { businessContext, normalizePrescription, pick, PrescriptionSchema, structured, type Prescription } from "../ai";
import { normalizeUrl, safeFetch } from "../safe-fetch";
import type { WorkspaceRow } from "../db";
import { marketFor, type Market } from "../markets";
import type { AgentContext, AgentDef, AgentResult } from "./types";

// ---------- Types ----------

export const CHANNELS = ["Meta ad", "Google ad", "Instagram post", "TikTok", "Website", "Other"] as const;
export const CATEGORIES = [
  "Medical clinic",
  "Aesthetic clinic",
  "Dental",
  "Beauty salon / non-medical",
  "Health supplements",
  "Legal",
  "Financial",
  "Other",
] as const;
type Channel = (typeof CHANNELS)[number];
type Category = (typeof CATEGORIES)[number];
export type Severity = "high" | "medium" | "low";
export type Verdict = "looks fine" | "needs edits" | "high risk";

type Input = { text: string; url: string; channel: Channel; category: Category };

export type Family =
  | "Superlative"
  | "Guarantee / absolute claim"
  | "Testimonial / endorsement"
  | "Before and after"
  | "Urgency / pressure"
  | "Inducement / discount"
  | "Comparative claim"
  | "Personal attributes"
  | "Unsupported health claim";

export type Flag = {
  rule_id: string;
  family: Family;
  phrase: string;
  snippet: string;
  sentence: string;
  severity: Severity;
  why: string;
};

export type ComplianceIssue = {
  quote: string;
  highlight: string;
  rule: string;
  framework: string;
  why: string;
  severity: Severity;
  fix: string;
};

export type ComplianceResult = AgentResult & {
  verdict: Verdict;
  channel: Channel;
  category: Category;
  source: { url: string | null; chars: number; image_notes: string[] };
  checked_text: string;
  flags: Flag[];
  issues: ComplianceIssue[];
  rewritten_copy: string;
  checklist: string[];
  disclaimer: string;
};

export const DISCLAIMER =
  "This is an automated pre-check, not legal advice. For anything you're unsure about, check the official MOH and ASAS guidance or ask a professional.";

/** Disclaimer naming the official guidance for the business's market. */
export function disclaimerFor(m: Market): string {
  if (m.code === "SG") return DISCLAIMER;
  const who = m.code === "INTL" ? "your local health regulator and advertising standards body" : `the health regulator and advertising standards body in ${m.inPhrase}`;
  return `This is an automated pre-check, not legal advice. For anything you're unsure about, check the official guidance from ${who} or ask a professional.`;
}

const SG_MARKET = marketFor("SG");

const MEDICAL: Category[] = ["Medical clinic", "Aesthetic clinic", "Dental"];
const isMedical = (c: Category) => MEDICAL.includes(c);
const isMetaChannel = (ch: Channel) => ch === "Meta ad" || ch === "Instagram post";

const MAX_TEXT = 15000;

// ---------- Category default ----------

export function categoryFromIndustry(industry: string, regulated: boolean): Category {
  const s = (industry || "").toLowerCase();
  if (/aesthetic|botox|filler|laser|dermatolog|skin clinic|medispa|med spa/.test(s)) return "Aesthetic clinic";
  if (/dental|dentist|orthodont/.test(s)) return "Dental";
  if (/clinic|medical|doctor|gp\b|physio|chiropract|tcm|health ?care|hospital|specialist/.test(s)) return "Medical clinic";
  if (/supplement|vitamin|nutrition/.test(s)) return "Health supplements";
  if (/law|legal|lawyer|attorney|solicitor/.test(s)) return "Legal";
  if (/financ|insur|invest|wealth|loan|mortgage|bank|accounting/.test(s)) return "Financial";
  if (/salon|lash|brow|nail|beauty|spa|facial|hair|massage|wax/.test(s)) return "Beauty salon / non-medical";
  return regulated ? "Medical clinic" : "Other";
}

// ---------- Deterministic pre-scan ----------

type Rule = {
  id: string;
  family: Family;
  re: RegExp;
  /** A function when the wording depends on the market. */
  why: string | ((m: Market) => string);
  severity: (cat: Category, ch: Channel) => Severity | null; // null = rule does not apply
};

const CONDITIONS =
  "acne|pimples|wrinkles|fine lines|fat|belly fat|stubborn fat|double chin|weight|eye bags|pigmentation|melasma|hair loss|thinning hair|bald(?:ness)?|scars?|acne scars|cellulite|debt|sagging skin|dark circles|eczema|psoriasis|diabetes|depression|anxiety|insomnia|erectile dysfunction|ed|infertility|condition|skin problems?|bad skin|varicose veins|snoring|sweating|body odou?r";

const sevMedHigh = (cat: Category): Severity => (isMedical(cat) || cat === "Legal" ? "high" : cat === "Health supplements" || cat === "Financial" ? "medium" : "low");

const RULES: Rule[] = [
  {
    id: "superlative",
    family: "Superlative",
    re: /\b(?:the\s+)?(?:best|no\.?\s?1|number\s+one|#\s?1|leading|top[- ](?:rated|notch)|finest|premier|world[- ]class|most\s+(?:trusted|experienced|advanced|popular|effective)|unrivall?ed|unmatched|award[- ]winning|first\s+and\s+only)\b|#1\b|(?<!\bon\s)\btop(?![- ]?up\b)(?=\s+\w)/gi,
    why: (m) =>
      m.code === "SG"
        ? "Superlatives and ranking claims ('best', 'No. 1', 'leading') can't be proven and are not allowed in healthcare or legal advertising in Singapore. For other businesses they still need proof under the advertising code."
        : `Superlatives and ranking claims ('best', 'No. 1', 'leading') can't be proven. Healthcare and legal advertising rules in many countries don't allow them, so check what applies in ${m.inPhrase}. Other businesses still need proof under the advertising code.`,
    severity: (cat) => sevMedHigh(cat),
  },
  {
    id: "guarantee",
    family: "Guarantee / absolute claim",
    re: /\b(?:guarantee[sd]?|100\s?%|permanent(?:ly)?|risk[- ]free|pain[- ]?(?:less|free)|no\s+(?:side[- ]effects?|downtime|pain|risks?|scarring)|zero\s+(?:downtime|pain|risks?)|completely\s+safe|100%\s+safe|safe\s+and\s+effective|lasts?\s+forever)/gi,
    why: "Absolute promises about results, safety or comfort can mislead. Results and side effects vary by person, so healthcare ads should not promise them.",
    severity: (cat) => (isMedical(cat) || cat === "Health supplements" || cat === "Legal" || cat === "Financial" ? "high" : "medium"),
  },
  {
    id: "testimonial",
    family: "Testimonial / endorsement",
    re: /\b(?:testimonials?|reviews|review\s+(?:from|by)|google\s+review|rated\s+\d(?:\.\d)?\s*stars?|\d(?:\.\d)?\s*stars?|5[- ]star|our\s+(?:clients|patients|customers)\s+(?:say|love|rave)|as\s+seen\s+on|recommended\s+by|endorsed\s+by|celebrity|influencers?|loved\s+by\s+[\d,]+|trusted\s+by\s+[\d,]+|[\d,]+\+?\s+(?:happy|satisfied)\s+(?:clients|patients|customers))\b/gi,
    why: (m) =>
      m.code === "SG"
        ? "Healthcare advertising in Singapore should not use patient testimonials, reviews or endorsements. Other businesses can use them only if they are genuine and typical."
        : `Healthcare advertising rules often restrict patient testimonials, reviews and endorsements, so check what applies in ${m.inPhrase}. Other businesses can use them only if they are genuine and typical.`,
    severity: (cat) => (isMedical(cat) ? "high" : cat === "Legal" ? "medium" : "low"),
  },
  {
    id: "before-after",
    family: "Before and after",
    re: /\b(?:before[- ]and[- ]after|before\s*(?:&|\/|\+)\s*after|before\s*vs\.?\s*after|transformations?|see\s+the\s+difference|results?\s+photos?)\b/gi,
    why: "Before-and-after images are restricted for healthcare services, and Meta limits them for health and weight-loss ads. Treat them as high risk in public ads.",
    severity: (cat, ch) => (isMedical(cat) ? "high" : isMetaChannel(ch) || cat === "Health supplements" ? "medium" : "low"),
  },
  {
    id: "urgency",
    family: "Urgency / pressure",
    re: /\b(?:limited[- ]time|only\s+today|today\s+only|hurry|last\s+chance|while\s+(?:stocks|slots)\s+last|ends?\s+(?:soon|tonight|today)|only\s+\d+\s+(?:slots|spots|seats)\s+left|don'?t\s+miss\s+out|act\s+now|flash\s+sale|book\s+now\s+before)\b/gi,
    why: "Pressure tactics push people to decide quickly. For medical treatment that is not allowed in spirit; for everyone else it must be true (a real deadline).",
    severity: (cat) => (isMedical(cat) ? "high" : cat === "Financial" || cat === "Health supplements" ? "medium" : "low"),
  },
  {
    id: "inducement",
    family: "Inducement / discount",
    re: /\b(?:\d{1,2}\s?%\s?off|free\s+(?:consult(?:ation)?s?|trial|session|treatment|gift)|discount(?:ed)?|promo(?:tion)?(?:\s+code)?|first[- ]trial|trial\s+(?:price|offer|session)|1[- ]for[- ]1|buy\s+\d+\s+get\s+\d+|package\s+deal|voucher|giveaway|lucky\s+draw)\b/gi,
    why: "Discounts, free gifts and trial offers for medical treatment are treated as inducements that may push people into treatment they don't need.",
    severity: (cat) => (isMedical(cat) ? "high" : cat === "Health supplements" ? "low" : null),
  },
  {
    id: "comparative",
    family: "Comparative claim",
    re: /\b(?:better\s+than|superior\s+to|more\s+effective\s+than|unlike\s+other|compared\s+to\s+other|cheaper\s+than|outperforms?|beats?\s+(?:any|all|other))\b/gi,
    why: "Comparing yourself favourably with other providers is not allowed for healthcare and law firms, and needs solid proof for everyone else.",
    severity: (cat) => sevMedHigh(cat) === "low" ? "medium" : sevMedHigh(cat),
  },
  {
    id: "personal-question",
    family: "Personal attributes",
    re: new RegExp(`\\b(?:are\\s+you\\s+(?:overweight|fat|obese|depressed|anxious|balding|insecure|in\\s+debt|diabetic|suffering|struggling)|(?:do|did)\\s+you\\s+(?:have|suffer\\s+from|struggle\\s+with)\\s+(?:${CONDITIONS}))\\b`, "gi"),
    why: "Meta does not allow ads that assert or imply someone's personal attributes, including health conditions, weight or finances. Talk about the service, not the viewer's body.",
    severity: (_cat, ch) => (isMetaChannel(ch) ? "high" : ch === "TikTok" || ch === "Google ad" ? "medium" : "low"),
  },
  {
    id: "personal-your",
    family: "Personal attributes",
    re: new RegExp(`\\b(?:your\\s+(?:${CONDITIONS})|you\\s+(?:have|suffer\\s+from|are\\s+suffering\\s+from|struggle\\s+with|'re\\s+struggling\\s+with)\\s+(?:${CONDITIONS}))\\b`, "gi"),
    why: "Phrases like 'your acne' or 'you have hair loss' imply the viewer has the condition, which Meta's personal attributes policy does not allow.",
    severity: (_cat, ch) => (isMetaChannel(ch) ? "high" : ch === "TikTok" ? "medium" : "low"),
  },
  {
    id: "health-claim",
    family: "Unsupported health claim",
    re: /\b(?:cures?|cured|miracle|instant(?:ly)?\s+results?|clinically\s+proven|scientifically\s+proven|doctor[- ]approved|fda[- ]approved|hsa[- ]approved|reverses?\s+(?:aging|ageing)|detox(?:ify)?|melts?\s+(?:away\s+)?fat|lose\s+\d+\s?kg)\b/gi,
    why: "Health and results claims need solid evidence. 'Cure', 'miracle' or 'clinically proven' wording is high risk unless you can show the proof.",
    severity: (cat) => (isMedical(cat) || cat === "Health supplements" ? "high" : "medium"),
  },
];

function sentenceAround(text: string, index: number, length: number): string {
  const startCandidates = [text.lastIndexOf("\n", index), text.lastIndexOf(". ", index), text.lastIndexOf("! ", index), text.lastIndexOf("? ", index)];
  const start = Math.max(...startCandidates);
  const from = start < 0 ? 0 : start + (text[start] === "\n" ? 1 : 2);
  const ends = ["\n", ". ", "! ", "? "].map((t) => text.indexOf(t, index + length)).filter((i) => i >= 0);
  const to = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(from, to).trim();
}

function snippetAround(text: string, index: number, length: number): string {
  const from = Math.max(0, index - 60);
  const to = Math.min(text.length, index + length + 60);
  return (from > 0 ? "..." : "") + text.slice(from, to).replace(/\s+/g, " ").trim() + (to < text.length ? "..." : "");
}

/** Regex pre-scan. Runs in demo and live. */
export function preScan(text: string, category: Category, channel: Channel, market: Market = SG_MARKET): Flag[] {
  const flags: Flag[] = [];
  const seen = new Map<string, number>();
  for (const rule of RULES) {
    const severity = rule.severity(category, channel);
    if (!severity) continue;
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      const phrase = m[0].trim();
      if (!phrase) continue;
      const key = `${rule.family}|${phrase.toLowerCase()}`;
      const n = seen.get(key) ?? 0;
      if (n >= 2) continue;
      seen.set(key, n + 1);
      const idx = m.index ?? 0;
      // A free consultation is a softer inducement than a discount or free treatment.
      const sev: Severity = rule.id === "inducement" && /consult/i.test(phrase) && severity === "high" ? "medium" : severity;
      flags.push({
        rule_id: rule.id,
        family: rule.family,
        phrase,
        snippet: snippetAround(text, idx, m[0].length),
        sentence: sentenceAround(text, idx, m[0].length).slice(0, 400),
        severity: sev,
        why: typeof rule.why === "function" ? rule.why(market) : rule.why,
      });
      if (flags.length >= 60) return flags;
    }
  }
  return flags;
}

// ---------- Naive rule-based rewrite (demo) ----------

const ATTR_TOPIC: [RegExp, string][] = [
  [/overweight|fat|obese|weight/i, "weight management"],
  [/bald|hair/i, "hair loss treatment"],
  [/depress|anxi|insomnia/i, "mental wellness support"],
  [/debt/i, "debt management"],
  [/acne|pimple|scar|skin|pigment|melasma|eczema|psoriasis/i, "skin treatment"],
  [/wrinkle|fine lines|sagging/i, "skin rejuvenation"],
];
function topicFor(s: string): string {
  return ATTR_TOPIC.find(([re]) => re.test(s))?.[1] ?? "treatment";
}

const REPLACEMENTS: [RegExp, string | ((m: string) => string)][] = [
  [/\bare\s+you\s+(?:overweight|fat|obese|depressed|anxious|balding|insecure|in\s+debt|diabetic|suffering|struggling)[^?.!\n]*\?/gi, (m) => `Exploring ${topicFor(m)} options?`],
  [new RegExp(`\\b(?:do|did)\\s+you\\s+(?:have|suffer\\s+from|struggle\\s+with)\\s+(${CONDITIONS})\\s*\\?`, "gi"), (m) => `Looking into ${topicFor(m)}?`],
  [new RegExp(`\\byou\\s+(?:have|suffer\\s+from|are\\s+suffering\\s+from|struggle\\s+with|'re\\s+struggling\\s+with)\\s+(${CONDITIONS})\\b`, "gi"), "$1"],
  [new RegExp(`\\byour\\s+(${CONDITIONS})\\b`, "gi"), "$1"],
  [/\b(?:best|no\.?\s?1|number\s+one|leading|top[- ](?:rated|notch)|finest|premier|world[- ]class|most\s+(?:trusted|experienced|advanced|popular|effective)|unrivall?ed|unmatched|award[- ]winning|first\s+and\s+only)\b\s*/gi, ""],
  [/#\s?1\b\s*/g, ""],
  [/(?<!\bon\s)\btop(?![- ]?up\b)\s+(?=\w)/gi, ""],
  [/\b(?:completely|100\s?%)\s+safe\b/gi, "carried out by trained professionals"],
  [/\bguaranteed\s+results?\b/gi, "results that vary from person to person"],
  [/(?:,\s*)?\bguarantee[sd]?\b\s*/gi, " "],
  [/(?:,\s*)?\b100\s?%\s*/gi, " "],
  [/\bpermanently\b/gi, "for longer"],
  [/\bpermanent\b/gi, "long-lasting"],
  [/\brisk[- ]free\b\s*/gi, ""],
  [/\bpain[- ]?(?:less|free)\b/gi, "gentle"],
  [/\bno\s+side[- ]effects?\b/gi, "side effects explained at your consultation"],
  [/\b(?:no|zero)\s+downtime\b/gi, "minimal downtime for most people"],
  [/\b(?:no|zero)\s+(?:pain|risks?|scarring)\b/gi, "risks explained at your consultation"],
  [/\bsafe\s+and\s+effective\b/gi, "carried out by trained professionals"],
  [/\b(?:limited[- ]time(?:\s+only)?|only\s+today|today\s+only|hurry(?:\s+now)?|last\s+chance|while\s+(?:stocks|slots)\s+last|ends?\s+(?:soon|tonight|today)|only\s+\d+\s+(?:slots|spots|seats)\s+left|don'?t\s+miss\s+out|act\s+now|flash\s+sale)\b[!:,]?\s*/gi, ""],
  [/\bbetter\s+than\s+(?:other|any|all)\s+\w+/gi, ""],
  [/\bunlike\s+(?:other|many|most)\s+\w+,?\s*/gi, ""],
  [/\b(?:cures?|cured)\b/gi, "helps with"],
  [/\bmiracle\b\s*/gi, ""],
  [/\binstant(?:ly)?\s+results?\b/gi, "results over time"],
  [/\b(?:clinically|scientifically)\s+proven\b\s*/gi, ""],
];

const DROP_MEDICAL = /\b(?:testimonials?|reviews|review\s+(?:from|by)|google\s+review|rated\s+\d|\d(?:\.\d)?\s*stars?|5[- ]star|our\s+(?:clients|patients|customers)\s+(?:say|love|rave)|as\s+seen\s+on|recommended\s+by|endorsed\s+by|celebrity|influencers?|loved\s+by|trusted\s+by|happy\s+(?:clients|patients|customers)|satisfied\s+(?:clients|patients|customers)|before[- ]and[- ]after|before\s*(?:&|\/|\+)\s*after|transformations?|see\s+the\s+difference|results?\s+photos?)\b/i;
const DROP_MEDICAL_PROMO = /\b(?:\d{1,2}\s?%\s?off|free\s+(?:trial|session|treatment|gift)|discount(?:ed)?|promo(?:tion)?|first[- ]trial|trial\s+(?:price|offer|session)|1[- ]for[- ]1|buy\s+\d+\s+get\s+\d+|package\s+deal|voucher|giveaway|lucky\s+draw)\b/i;

function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,;:])\1+/g, "$1")
    .replace(/[,;:]\s*([.!?])/g, "$1")
    .replace(/^[\s,;:.!-]+/, "")
    .replace(/\b(a|an|the|our|your)\s+(?=[,.!?]|$)/gi, "")
    .replace(/\(\s*\)/g, "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Rewrites one sentence. Returns "" when the sentence should be removed. */
export function rewriteSentence(sentence: string, category: Category): string {
  const medical = isMedical(category);
  if (medical && (DROP_MEDICAL.test(sentence) || DROP_MEDICAL_PROMO.test(sentence))) return "";
  let s = sentence;
  for (const [re, rep] of REPLACEMENTS) {
    re.lastIndex = 0;
    s = typeof rep === "string" ? s.replace(re, rep) : s.replace(re, rep);
  }
  if (medical) s = s.replace(/\bfree\s+(consult(?:ation)?s?)\b/gi, "$1");
  const out = tidy(s);
  // A sentence left dangling by a removed word ("our doctors are.") is dropped instead.
  if (/\b(?:are|is|was|were|be|our|the|a|an|with|of|for|and|to)[.!?]?$/i.test(out)) return "";
  return /[a-z0-9]/i.test(out) && out.split(/\s+/).length >= 2 ? out : "";
}

export function naiveRewrite(text: string, category: Category): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      const bullet = line.match(/^(\s*(?:[-*•]|\d+[.)])\s+)/)?.[1] ?? "";
      const body = line.slice(bullet.length);
      const sentences = body.split(/(?<=[.!?])\s+/);
      const kept = sentences.map((s) => rewriteSentence(s, category)).filter(Boolean);
      return kept.length ? bullet + kept.join(" ") : null;
    })
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Scoring ----------

const WEIGHT: Record<Severity, number> = { high: 25, medium: 12, low: 5 };
export function complianceScore(issues: { severity: Severity }[]): number {
  return Math.max(0, 100 - issues.reduce((s, i) => s + WEIGHT[i.severity], 0));
}

function verdictFrom(issues: { severity: Severity }[]): Verdict {
  if (issues.some((i) => i.severity === "high")) return "high risk";
  if (issues.length) return "needs edits";
  return "looks fine";
}

/** Framework badge labels. Singapore names its bodies; other markets get neutral labels. */
function frameworkLabels(m: Market) {
  return m.code === "SG"
    ? { health: "MOH / HCSA", legal: "Legal Profession (Publicity) Rules", financial: "MAS / financial", products: "HSA", general: "ASAS (SCAP)", extra: ["SMC Ethical Code"] }
    : { health: "Health ad rules", legal: "Legal advertising rules", financial: "Financial ad rules", products: "Health product rules", general: "Advertising standards", extra: [] as string[] };
}

function frameworkFor(family: Family, category: Category, channel: Channel, m: Market): string {
  const L = frameworkLabels(m);
  if (family === "Personal attributes") return isMetaChannel(channel) ? "Meta ads policy" : channel === "TikTok" ? "TikTok ads policy" : "Meta ads policy";
  if (family === "Before and after" && !isMedical(category) && isMetaChannel(channel)) return "Meta ads policy";
  if (isMedical(category)) return L.health;
  if (category === "Legal") return L.legal;
  if (category === "Financial") return L.financial;
  if (category === "Health supplements" && family === "Unsupported health claim") return L.products;
  return L.general;
}

// ---------- Page fetch ----------

async function fetchPageText(url: string): Promise<{ url: string; text: string; image_notes: string[] }> {
  const res = await safeFetch(normalizeUrl(url), { timeoutMs: 15000, maxBytes: 2_000_000 });
  if (!res.ok) throw new Error(`${new URL(res.finalUrl).hostname} returned an error (HTTP ${res.status}).`);
  const $ = cheerio.load(res.body);
  const image_notes: string[] = [];
  $("img").each((_, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    const src = $(el).attr("src") ?? "";
    if (/before|after|transformation|result/i.test(alt + " " + src) && image_notes.length < 8) {
      image_notes.push(alt ? `Image with alt text "${alt.slice(0, 100)}"` : `Image file ${src.split("/").pop()?.slice(0, 80)}`);
    }
  });
  $("script,style,noscript,svg,iframe,template").remove();
  const parts: string[] = [];
  const title = $("title").first().text().trim();
  const desc = ($('meta[name="description"]').attr("content") ?? "").trim();
  if (title) parts.push(title);
  if (desc) parts.push(desc);
  const seen = new Set<string>();
  $("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,dt,dd,button,a.button,.btn").each((_, el) => {
    const $el = $(el);
    if ($el.find("p,li,h1,h2,h3,h4,td").length) return; // only leaf-ish blocks
    const t = $el.text().replace(/\s+/g, " ").trim();
    if (t.length < 3 || seen.has(t)) return;
    seen.add(t);
    parts.push(t);
  });
  let text = parts.join("\n");
  if (text.length < 200) text = $("body").text().replace(/\s+/g, " ").trim();
  return { url: res.finalUrl, text: text.slice(0, MAX_TEXT), image_notes };
}

async function gatherText(input: Input, ctx: AgentContext) {
  let text = input.text;
  let url: string | null = null;
  let image_notes: string[] = [];
  if (input.url) {
    ctx.progress(`Reading ${new URL(input.url).hostname}`);
    const page = await fetchPageText(input.url);
    url = page.url;
    image_notes = page.image_notes;
    text = [input.text, page.text].filter(Boolean).join("\n\n").slice(0, MAX_TEXT);
  }
  if (!text.trim()) throw new Error("There was no text to check on that page. Paste the copy instead.");
  return { text, url, image_notes };
}

function baseChecklist(category: Category, channel: Channel, image_notes: string[], m: Market): string[] {
  const sg = m.code === "SG";
  const out: string[] = [];
  if (image_notes.length) out.push(`Check the images we spotted that look like before-and-after or results photos: ${image_notes.slice(0, 3).join("; ")}.`);
  out.push("Check every image and video in the ad or page. This check only reads text.");
  if (isMedical(category)) {
    out.push("Make sure no images show before-and-after results, patients' faces or bodies as proof of results, or doctors endorsing products.");
    out.push(
      sg
        ? "Confirm doctors' names, qualifications and titles match what is registered with the SMC (or SDC for dentists)."
        : "Confirm practitioners' names, qualifications and titles match their official registration.",
    );
    out.push("Check your Google reviews widget, Instagram highlights and website for patient testimonials. Those count as advertising too.");
    out.push("Make sure prices shown are accurate and not framed as a promotion.");
  }
  if (category === "Beauty salon / non-medical") out.push("Make sure you don't describe treatments in medical terms (e.g. 'treats acne', 'medical-grade') unless a licensed practitioner does them.");
  if (category === "Health supplements")
    out.push(
      sg
        ? "Check product claims against what HSA allows for health supplements: no claims to treat, cure or prevent disease."
        : "Check product claims against what your health products regulator allows: no claims to treat, cure or prevent disease unless the product is approved for it.",
    );
  if (category === "Legal") out.push("Check that any mention of past cases, results or awards is accurate and doesn't suggest you are better than other firms.");
  if (category === "Financial")
    out.push(
      sg
        ? "Check returns, rates and risk wording against the MAS rules for your product type. Include the required risk warnings."
        : "Check returns, rates and risk wording against your financial regulator's rules for your product type. Include any required risk warnings.",
    );
  if (isMetaChannel(channel)) out.push("In Meta, check the image doesn't zoom in on body parts or show weight or skin 'problems' in a negative way.");
  if (channel === "Google ad") out.push("Check Google Ads policy status in Ads Manager after you submit. Some healthcare terms need certification.");
  out.push("If the landing page and the ad say different things, fix both. Platforms and regulators look at the page the ad sends people to.");
  return out;
}

// ---------- Live run ----------

const PLATFORM_RULES = `Platforms:
- Meta Advertising Standards: personal attributes policy (ads must not assert or imply a person's health, weight, medical condition, financial status and other personal attributes, e.g. "Are you overweight?", "your acne"); restrictions on before-and-after images and on content that promotes negative body image for health, cosmetic and weight-loss ads; health claims must not be misleading.
- Google Ads healthcare and medicines policy, plus misrepresentation policy (no unrealistic or misleading claims).
- TikTok advertising policies are similar to Meta's for health, weight and cosmetic claims.`;

const SG_FRAMEWORKS = `FRAMEWORKS (describe them only at this level; do not cite section, regulation or paragraph numbers unless you are certain they are correct)

Singapore healthcare (medical clinics, aesthetic clinics, dental):
- Healthcare Services Act (HCSA) and its advertising regulations, plus MOH guidance for licensed healthcare services. Advertising must be factual, accurate, verifiable and not sensational or exaggerated. No testimonials or endorsements (including patient reviews and celebrity or influencer endorsements). No superlatives ("best", "No. 1", "leading") and no comparisons with other providers. Before-and-after images are restricted: treat them as high risk in public ads. No misleading claims about results, safety or pain. No inducements such as discounts, free treatments, gifts or time-limited offers that encourage people to undergo treatment.
- SMC Ethical Code and Ethical Guidelines for doctors (and the SDC equivalent for dentists): information about doctors and their services must be factual, not laudatory, not misleading, no claims of superiority, no testimonials; doctors should not endorse commercial products.

Everyone in Singapore:
- Singapore Code of Advertising Practice (SCAP), administered by ASAS: ads must be legal, decent, honest and truthful; claims must be substantiated; testimonials must be genuine; must not exploit fear or lack of knowledge; comparisons must be fair.

Health supplements: HSA guidance. Supplements must not claim to treat, cure or prevent disease.

Legal services: Legal Profession (Publicity) Rules in Singapore. Publicity must not be false or misleading, must not claim superiority over or compare with other lawyers or firms, and must be in good taste.

Financial: MAS rules and guidelines on advertising financial products. Ads must be fair, balanced and not misleading, with prominent risk disclosure.

${PLATFORM_RULES}`;

/** Regulatory framing for the business's market. Singapore keeps its detailed notes; other markets are described only at the level markets.ts gives. */
function frameworksFor(m: Market): string {
  if (m.code === "SG") return SG_FRAMEWORKS;
  const where = m.code === "INTL" ? "the business's country" : m.inPhrase;
  return `FRAMEWORKS (describe them only at this level; do not cite section, regulation or paragraph numbers unless you are certain they are correct)

Healthcare in ${where} (medical clinics, aesthetic clinics, dental):
- ${m.healthAdRules[0].toUpperCase() + m.healthAdRules.slice(1)}.
- Healthcare advertising is generally expected to be factual, accurate and not misleading. Many countries also restrict testimonials and reviews, superlatives, before-and-after images, comparisons with other providers and offers that push people into treatment. If you are not sure how ${where} treats one of these, flag the line as a risk to check (not a definite breach) and point the owner to the official source.

Everyone in ${where}:
- ${m.adStandards[0].toUpperCase() + m.adStandards.slice(1)}. Ads must be honest and not misleading, and claims must be backed up.

Health supplements and health products: the health products regulator's rules in ${where}. Products should not claim to treat, cure or prevent disease unless approved to.

Legal services: the professional conduct and publicity rules for lawyers in ${where}. Publicity must not be false or misleading.

Financial: the financial regulator's advertising rules in ${where}. Ads must be fair, balanced and not misleading, with clear risk information.

${PLATFORM_RULES}`;
}

const complianceSchema = (m: Market) => z.object({
  summary: z.string().describe("2-4 sentence verdict for the owner. Lead with the biggest risk. Plain language."),
  verdict: z.string().describe("Exactly one of: looks fine, needs edits, high risk"),
  issues: z
    .array(
      z.object({
        quote: z.string().describe("The exact problem text copied from the copy, word for word (a phrase or one sentence)"),
        rule: z.string().describe("Short rule label, e.g. 'No testimonials', 'No superlatives', 'Personal attributes', 'Unsubstantiated claim'"),
        framework: z
          .string()
          .describe(
            `Exactly one of: ${frameworkList(m)}`,
          ),
        why: z.string().describe("1-2 sentences on why this is a problem, in plain words. No section numbers unless certain."),
        severity: z.string().describe("Exactly one of: high, medium, low"),
        fix: z.string().describe("Rewritten compliant version of the quoted text, ready to paste. Empty string if it should simply be deleted."),
      }),
    )
    .describe("Every problem found, most serious first. Include real problems from the pre-scan, drop pre-scan false positives, add anything the pre-scan missed."),
  rewritten_copy: z
    .string()
    .describe("The full copy rewritten to be compliant for this channel and category, keeping the owner's voice, structure and call to action. Plain text with line breaks."),
  checklist: z.array(z.string()).describe("4-8 things a human must still check that text alone can't show (images, video, landing page, qualifications, claims evidence)."),
  prescriptions: z
    .array(PrescriptionSchema)
    .describe("3-6 fixes, most important first. Category 'Compliance'. Steps must say exactly where to change the copy (e.g. Meta Ads Manager > Ad > Primary text)."),
});

function frameworkList(m: Market): string {
  const L = frameworkLabels(m);
  return [L.health, ...L.extra, L.general, L.products, L.legal, L.financial, "Meta ads policy", "Google Ads policy", "TikTok ads policy"].join(", ");
}

function systemFor(m: Market): string {
  const sg = m.code === "SG";
  const forWhom = sg
    ? "Singapore small businesses"
    : m.code === "INTL"
      ? "small businesses anywhere (use the rules of the country in the business profile; if it is unclear, keep to principles that apply almost everywhere)"
      : `small businesses in ${m.inPhrase}`;
  const generalRules = sg ? "ASAS" : "the general advertising standards";
  const checkSource = sg
    ? `say "check the current MOH (or ASAS) guidance"`
    : m.code === "INTL"
      ? `say "check the current guidance from your local health regulator or advertising standards body"`
      : `say "check the current official guidance" and name the body (${m.healthAdRules}; ${m.adStandards})`;
  return `You are Compliance Check, an advertising compliance reviewer for ${forWhom}, strongest in healthcare and aesthetics. You review ad copy and landing page text before it goes live and rewrite it so it is compliant but still persuasive.

${frameworksFor(m)}

How to work:
- Apply the healthcare rules only when the category is a medical clinic, aesthetic clinic or dental practice. A non-medical beauty salon follows ${generalRules} and platform rules, but flag any wording that makes it sound like a medical treatment.
- Apply platform rules for the channel given.
- Quote problem text exactly as it appears.
- Never cite specific section or regulation numbers unless you are certain. When a point depends on detail you are not sure of, ${checkSource}.
- Be practical: don't flag ordinary, factual statements (services, address, opening hours, qualifications, neutral price lists).`;
}

async function runLive(input: Input, ctx: AgentContext): Promise<ComplianceResult> {
  const m = marketFor(ctx.ws.country);
  const { text, url, image_notes } = await gatherText(input, ctx);
  ctx.progress("Scanning for risky phrases");
  const flags = preScan(text, input.category, input.channel, m);

  ctx.progress("Reviewing against the advertising rules");
  const ai = await structured({
    system: systemFor(m),
    prompt: `BUSINESS PROFILE
${businessContext(ctx.ws)}

CATEGORY: ${input.category}
CHANNEL: ${input.channel}
${url ? `PAGE: ${url}\n` : ""}${image_notes.length ? `IMAGES THAT MAY BE BEFORE/AFTER: ${image_notes.join("; ")}\n` : ""}
AUTOMATED PRE-SCAN FLAGS (regex, may include false positives)
${flags.map((f) => `- [${f.severity}] ${f.family}: "${f.phrase}" in: ${f.snippet}`).join("\n") || "- none"}

COPY TO CHECK
"""
${text}
"""

Review the copy and return the verdict, issues, full rewritten copy, human checklist and prescriptions.`,
    schema: complianceSchema(m),
    effort: "medium",
  });

  const issues: ComplianceIssue[] = ai.issues.map((i) => {
    const quote = i.quote.trim();
    const hit = flags.find((f) => quote.toLowerCase().includes(f.phrase.toLowerCase()));
    return {
      quote,
      highlight: hit?.phrase ?? "",
      rule: i.rule.trim(),
      framework: i.framework.trim(),
      why: i.why.trim(),
      severity: pick(i.severity, ["high", "medium", "low"] as const, "medium"),
      fix: i.fix.trim(),
    };
  });
  const order: Severity[] = ["high", "medium", "low"];
  issues.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const verdict = issues.length ? pick(ai.verdict, ["looks fine", "needs edits", "high risk"] as const, verdictFrom(issues)) : "looks fine";

  return {
    title: runTitle(input),
    score: complianceScore(issues),
    summary: ai.summary,
    verdict: issues.some((i) => i.severity === "high") && verdict === "looks fine" ? "high risk" : verdict,
    channel: input.channel,
    category: input.category,
    source: { url, chars: text.length, image_notes },
    checked_text: text,
    flags,
    issues,
    rewritten_copy: ai.rewritten_copy.trim(),
    checklist: ai.checklist,
    disclaimer: disclaimerFor(m),
    prescriptions: ai.prescriptions.map(normalizePrescription),
  };
}

// ---------- Demo ----------

function issuesFromFlags(flags: Flag[], category: Category, channel: Channel, m: Market): ComplianceIssue[] {
  const bySentence = new Map<string, ComplianceIssue>();
  const order: Severity[] = ["high", "medium", "low"];
  for (const f of flags) {
    const key = `${f.family}|${f.sentence}`;
    if (bySentence.has(key)) continue;
    const rewritten = rewriteSentence(f.sentence, category);
    bySentence.set(key, {
      quote: f.sentence,
      highlight: f.phrase,
      rule: f.family,
      framework: frameworkFor(f.family, category, channel, m),
      why: f.why,
      severity: f.severity,
      fix: rewritten && rewritten !== f.sentence ? rewritten : "",
    });
  }
  return [...bySentence.values()].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)).slice(0, 25);
}

const familyFix = (m: Market): Record<Family, { title: string; steps: string[] }> => ({
  Superlative: {
    title: "Remove 'best', 'No. 1' and other ranking words",
    steps: ["Delete superlatives and ranking claims from the copy.", "Replace them with facts you can prove: years in practice, qualifications, the exact treatments you offer."],
  },
  "Guarantee / absolute claim": {
    title: "Take out guarantees and absolute promises",
    steps: ["Remove 'guaranteed', '100%', 'permanent', 'painless' and 'no side effects'.", "Say what to expect in neutral terms and that results vary from person to person."],
  },
  "Testimonial / endorsement": {
    title: "Take testimonials and reviews out of the ad",
    steps: ["Remove patient quotes, star ratings and 'as seen on' lines from the ad and landing page.", "Check review widgets and Instagram highlights on the landing page too."],
  },
  "Before and after": {
    title: "Remove before-and-after references and images",
    steps: ["Delete before-and-after wording and images from the ad.", "Use a neutral image of your clinic, team or treatment room instead."],
  },
  "Urgency / pressure": {
    title: "Drop the pressure lines",
    steps: ["Remove 'limited time', 'hurry' and 'only today' lines.", "If a deadline is real, state the end date plainly."],
  },
  "Inducement / discount": {
    title: "Replace promotions with a plain price or consultation offer",
    steps: ["Remove discounts, free treatments, gifts and trial prices for medical treatments.", "If you show prices, show the regular fee in a neutral way."],
  },
  "Comparative claim": {
    title: "Stop comparing yourself with other providers",
    steps: ["Remove 'better than', 'unlike other clinics' and similar lines.", "Describe what you do, not what others don't."],
  },
  "Personal attributes": {
    title: "Rewrite lines that talk about the viewer's body or condition",
    steps: [`Change 'Are you overweight?' or 'your acne' into lines about the service, e.g. 'Acne treatment in ${m.code === "INTL" ? "[your area]" : m.exampleArea}'.`, "Re-read every sentence that starts with 'you' or 'your' before publishing."],
  },
  "Unsupported health claim": {
    title: "Back up or remove health and results claims",
    steps: ["Remove 'cure', 'miracle', 'instant results' and 'clinically proven' unless you hold the evidence.", "Describe what the treatment is and who it may suit instead."],
  },
});

function demoPrescriptions(issues: ComplianceIssue[], input: Input, m: Market): Prescription[] {
  const FAMILY_FIX = familyFix(m);
  const where =
    input.channel === "Meta ad" ? "Meta Ads Manager > Ad > Primary text and headline" :
    input.channel === "Google ad" ? "Google Ads > Ads & assets > Edit ad" :
    input.channel === "Instagram post" ? "Instagram > Post > Edit caption" :
    input.channel === "TikTok" ? "TikTok Ads Manager > Ad > Ad text" :
    input.channel === "Website" ? "Your website editor > the page you checked" : "Wherever this copy is published";
  const families = [...new Set(issues.map((i) => i.rule as Family))];
  const out: Prescription[] = families.slice(0, 5).map((fam) => {
    const items = issues.filter((i) => i.rule === fam);
    const sev = items.some((i) => i.severity === "high") ? "high" : items.some((i) => i.severity === "medium") ? "medium" : "low";
    const fix = FAMILY_FIX[fam];
    return {
      title: fix.title,
      diagnosis: `${items.length} line${items.length === 1 ? "" : "s"} flagged, e.g. "${items[0].highlight}". ${items[0].why}`,
      steps: [...fix.steps, "Paste the rewritten version from this report, then re-run Compliance Check."],
      where,
      priority: sev === "high" ? "urgent" : sev === "medium" ? "high" : "medium",
      impact: sev === "high" ? "high" : "medium",
      effort: "quick",
      category: "Compliance",
      recheck_days: 7,
    } satisfies Prescription;
  });
  if (isMedical(input.category))
    out.push({
      title: m.code === "SG" ? "Check your images and landing page against MOH advertising guidance" : "Check your images and landing page against the health advertising rules",
      diagnosis: "This check only reads text. Images, videos and pages linked from the ad count as advertising too.",
      steps: [
        m.code === "SG"
          ? "Open the official MOH guidance on advertising for licensed healthcare services and read the section on content."
          : m.code === "INTL"
            ? "Open your local health regulator's official advertising guidance and read the section on content."
            : `Open the official guidance on health advertising in ${m.inPhrase} and read the section on content. The main rules are: ${m.healthAdRules}.`,
        "Go through every image, video and review widget in the ad and on the landing page.",
        "Remove anything that shows results, testimonials or promotions.",
      ],
      where: "Ad creative and landing page",
      priority: "high", impact: "high", effort: "half-day", category: "Compliance", recheck_days: 14,
    });
  return out;
}

async function runDemo(input: Input, ctx: AgentContext): Promise<ComplianceResult> {
  const m = marketFor(ctx.ws.country);
  const { text, url, image_notes } = await gatherText(input, ctx);
  ctx.progress("Scanning for risky phrases");
  const flags = preScan(text, input.category, input.channel, m);
  const issues = issuesFromFlags(flags, input.category, input.channel, m);
  const verdict = verdictFrom(issues);
  const score = complianceScore(issues);
  const high = issues.filter((i) => i.severity === "high").length;
  const families = [...new Set(issues.map((i) => i.rule))];
  return {
    title: runTitle(input),
    score,
    summary: issues.length
      ? `Rules-only pre-check (no AI key is connected, so this is not the full review). We found ${issues.length} line${issues.length === 1 ? "" : "s"} to look at${high ? `, ${high} of them high risk` : ""}: ${families.slice(0, 3).join(", ").toLowerCase()}. The rewrite below is a simple automatic edit; read it before using it.`
      : "Rules-only pre-check (no AI key is connected, so this is not the full review). The phrase scan found nothing risky in the text. Still check images and the landing page before publishing.",
    verdict,
    channel: input.channel,
    category: input.category,
    source: { url, chars: text.length, image_notes },
    checked_text: text,
    flags,
    issues,
    rewritten_copy: issues.length ? naiveRewrite(text, input.category) : text,
    checklist: baseChecklist(input.category, input.channel, image_notes, m),
    disclaimer: disclaimerFor(m),
    prescriptions: demoPrescriptions(issues, input, m),
    demo: true,
  };
}

// ---------- Agent ----------

function runTitle(input: Input): string {
  const what = input.url ? new URL(input.url).hostname : input.text.replace(/\s+/g, " ").slice(0, 40) + (input.text.length > 40 ? "..." : "");
  return `Compliance check: ${input.channel} - ${what}`;
}

function parse(raw: unknown, ws: WorkspaceRow): Input {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = String(r.text ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT);
  const urlRaw = String(r.url ?? "").trim();
  if (!text && !urlRaw) throw new Error("Paste the copy to check, or add a page URL.");
  const url = urlRaw ? normalizeUrl(urlRaw).toString() : "";
  const channel = (CHANNELS as readonly string[]).includes(String(r.channel)) ? (r.channel as Channel) : "Other";
  const category = (CATEGORIES as readonly string[]).includes(String(r.category))
    ? (r.category as Category)
    : categoryFromIndustry(ws.industry, Boolean(ws.regulated));
  return { text, url, channel, category };
}

export const complianceAgent: AgentDef<Input> = {
  id: "compliance",
  name: "Compliance Check",
  blurb: "Checks your ad or page copy against your country's advertising rules before it goes live.",
  description:
    "Paste an ad, caption or landing page (or give a URL). We flag risky lines for your category and channel, like superlatives, testimonials, before-and-after claims, inducements and Meta's personal attributes rules, explain why, and give you a compliant rewrite to paste. Strongest for healthcare and aesthetics.",
  parseInput: parse,
  runTitle: (input) => runTitle(input),
  run: runLive,
  demo: runDemo,
};
