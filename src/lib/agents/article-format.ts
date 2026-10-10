// Keyword Lab article mode: shared types, the JSON-LD schema, the best-practice checklist, and the
// HTML and Markdown the owner copies into their site.
// No server-only imports here: the report (a client component) imports from this file.

import type { ContentBrief } from "./keywords-demo";

/** What "Write this article" makes: a blog article, or a website page built to win an enquiry. */
export type PageType = "article" | "service" | "location" | "faq";

export const PAGE_TYPES: { id: PageType; label: string }[] = [
  { id: "article", label: "Blog article" },
  { id: "service", label: "Service page" },
  { id: "location", label: "Location page" },
  { id: "faq", label: "FAQ page" },
];

export const PAGE_TYPE_LABEL = Object.fromEntries(PAGE_TYPES.map((t) => [t.id, t.label])) as Record<PageType, string>;

/** Service and location pages are landing pages: a call to action near the top and scannable copy. */
export const isLandingPage = (t: PageType) => t === "service" || t === "location";

/** The page type a brief most likely wants, so the picker starts on a sensible choice. */
export function suggestPageType(b: Pick<ContentBrief, "title" | "h1" | "slug">): PageType {
  const text = `${b.title} ${b.h1}`;
  if (/\b(faqs?|frequently asked|questions)\b/i.test(text)) return "faq";
  if (/^\/blog\//i.test(b.slug) || /\?|\bvs\.?\s|\bhow (to|much|long)\b|\bwhat is\b|\bguide\b/i.test(text)) return "article";
  return "service";
}

/** The brief an article is written from, as the report sends it with "Write this article". */
export type ArticleBrief = {
  /** Missing on briefs saved before page types existed: those are blog articles. */
  page_type?: PageType;
  title: string;
  target_keyword: string;
  slug: string;
  h1: string;
  outline: string[];
  must_include: string[];
  internal_links: string[];
};

export type ArticleSubsection = { heading: string; paragraphs: string[] };

export type ArticleSection = {
  heading: string;
  paragraphs: string[];
  bullets: string[];
  /** H3s inside the section, like each step of a process. Missing on articles saved before H3s. */
  subsections?: ArticleSubsection[];
};

export type ArticleVideo = {
  url: string;
  platform: "instagram" | "youtube" | "tiktok" | "facebook";
  title: string;
  /** One sentence that introduces the video in the article. */
  intro: string;
  /** Heading of the section the video goes after. */
  after_heading: string;
};

/** A name, place or price the page states, for the owner to check before publishing. */
export type KeyFact = { label: string; value: string };

/** A link to add between this page and one of the owner's other pages. */
export type InternalLink = { anchor: string; target: string; why: string };

export type Article = {
  page_type: PageType;
  /** The title tag shown in search results. */
  seo_title: string;
  /** The H1. */
  title: string;
  meta_description: string;
  slug: string;
  /** Answer-first summary: 40 to 60 words that answer the main query, right under the H1. */
  answer: string;
  intro: string[];
  sections: ArticleSection[];
  faq: { question: string; answer: string }[];
  cta: { heading: string; text: string; button: string };
  videos: ArticleVideo[];
  key_facts: KeyFact[];
  internal_links: InternalLink[];
  /** JSON-LD built in code from the page content (see pageSchema). Null when there is none. */
  schema: Record<string, unknown> | null;
};

export const SEO_TITLE_MAX = 60;
export const META_MAX = 155;
export const ANSWER_WORDS = { min: 40, max: 60 };

/** The word count each page type should land in. */
export const WORD_RANGE: Record<PageType, { min: number; max: number }> = {
  article: { min: 800, max: 2500 },
  service: { min: 450, max: 1600 },
  location: { min: 400, max: 1400 },
  faq: { min: 500, max: 2200 },
};

export const PLATFORM_LABEL: Record<ArticleVideo["platform"], string> = { instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook" };

/** The primary keyword of a brief: the title tag leads with it ("Hydrafacial in Tampines | Lumen" -> "hydrafacial in tampines"). */
export function briefKeyword(b: Pick<ContentBrief, "title" | "h1">): string {
  const head = (b.title || b.h1 || "").split(/\s[|:–-]\s|[|:?]/)[0] ?? "";
  return head.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 80);
}

/**
 * Fills in what articles saved before page types existed don't have, so old reports still render.
 * Their first intro paragraph was written as the short answer, so it becomes one.
 */
export function upgradeArticle(raw: Article, brief?: ArticleBrief): Article {
  const a = raw as Partial<Article> & Pick<Article, "title" | "meta_description" | "slug" | "intro" | "sections" | "faq" | "cta" | "videos">;
  const intro = a.intro ?? [];
  const legacy = a.answer === undefined;
  return {
    ...a,
    page_type: a.page_type ?? brief?.page_type ?? "article",
    seo_title: a.seo_title ?? brief?.title ?? a.title,
    answer: legacy ? (intro[0] ?? "") : (a.answer ?? ""),
    intro: legacy ? intro.slice(1) : intro,
    key_facts: a.key_facts ?? [],
    internal_links: a.internal_links ?? [],
    schema: a.schema ?? null,
  };
}

/** The 11-character video id of a YouTube link, or null for anything else. */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;

/** Every piece of text a visitor sees on the page, in order. */
function visibleText(a: Article): string[] {
  return [
    a.title,
    a.answer,
    ...a.intro,
    ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...s.bullets, ...(s.subsections ?? []).flatMap((x) => [x.heading, ...x.paragraphs])]),
    ...a.faq.flatMap((f) => [f.question, f.answer]),
    a.cta.heading,
    a.cta.text,
    a.cta.button,
  ].filter(Boolean);
}

export const wordCount = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;

/** Placeholders the owner must fill in before publishing, like [your price]. */
export function articlePlaceholders(a: Article): string[] {
  const text = [a.seo_title, a.meta_description, ...visibleText(a), ...a.key_facts.map((f) => f.value)].join("\n");
  const seen = new Set<string>();
  for (const m of text.matchAll(/\[([^\[\]\n]{2,60})\]/g)) {
    const p = `[${m[1].trim()}]`;
    if (!/^\[sample text\]$/i.test(p)) seen.add(p);
  }
  return [...seen].slice(0, 20);
}

/** Videos grouped by the section they follow. Ones whose heading is gone go after the last section. */
export function videosBySection(a: Article): Map<number, ArticleVideo[]> {
  const out = new Map<number, ArticleVideo[]>();
  const key = (s: string) => s.trim().toLowerCase();
  for (const v of a.videos) {
    let i = a.sections.findIndex((s) => key(s.heading) === key(v.after_heading));
    if (i < 0) i = a.sections.length - 1;
    out.set(i, [...(out.get(i) ?? []), v]);
  }
  return out;
}

// ---------- Schema (JSON-LD) ----------

export type SchemaBusiness = {
  name: string;
  /** The owner's website as they typed it; only used when it is a real address. */
  website: string;
  /** Where the page is aimed, e.g. "Tampines, Singapore". */
  area: string;
  /** Clinics and other healthcare businesses are a MedicalBusiness rather than a LocalBusiness. */
  medical: boolean;
};

/** The page's full address on the owner's site, or null when the website isn't a real address. */
export function pageUrl(website: string, slug: string): string | null {
  const w = String(website ?? "").trim();
  if (!w) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`);
    if (!u.hostname.includes(".")) return null;
    return `${u.origin}${slug.startsWith("/") ? slug : `/${slug}`}`;
  } catch {
    return null;
  }
}

/** The schema type each page type is built around. */
const MAIN_SCHEMA: Record<PageType, string> = { article: "BlogPosting", service: "Service", location: "Service", faq: "FAQPage" };

/**
 * Schema.org JSON-LD for the page, built only from what the page says and the business profile:
 * no ratings, prices, dates or credentials the owner hasn't given. Null when there is nothing to describe.
 */
export function pageSchema(a: Article, biz: SchemaBusiness): Record<string, unknown> | null {
  const url = pageUrl(biz.website, a.slug);
  const home = url ? new URL(url).origin : null;
  const place = biz.area ? { "@type": "Place", name: biz.area } : null;
  const org = { "@type": "Organization", name: biz.name, ...(home && { url: home }) };
  const business = { "@type": biz.medical ? "MedicalBusiness" : "LocalBusiness", name: biz.name, ...(home && { url: home }), ...(place && { areaServed: place }) };
  const graph: Record<string, unknown>[] = [];
  if (a.page_type === "article")
    graph.push({ "@type": "BlogPosting", headline: a.title.slice(0, 110), description: a.meta_description, ...(url && { url, mainEntityOfPage: url }), author: org, publisher: org });
  if (isLandingPage(a.page_type)) {
    graph.push({ "@type": "Service", name: a.title, description: a.meta_description, ...(url && { url }), ...(place && { areaServed: place }), provider: business });
    // A location page is about the business in that area, so it gets its own entry too.
    if (a.page_type === "location") graph.push(business);
  }
  if (a.faq.length)
    graph.push({
      "@type": "FAQPage",
      ...(a.page_type === "faq" && { name: a.title, ...(url && { url }) }),
      mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    });
  return graph.length ? { "@context": "https://schema.org", "@graph": graph } : null;
}

/** The JSON-LD as it goes in the page. "<" is escaped so the text can't close the script tag. */
export const schemaJson = (schema: Record<string, unknown>) => JSON.stringify(schema, null, 2).replace(/</g, "\\u003c");

function schemaCheck(a: Article): { ok: boolean; detail: string } {
  if (!a.schema) return { ok: false, detail: "No schema on this page" };
  type Node = { "@type"?: unknown; mainEntity?: unknown };
  let parsed: { "@context"?: unknown; "@graph"?: unknown };
  try {
    parsed = JSON.parse(schemaJson(a.schema));
  } catch {
    return { ok: false, detail: "The schema is not valid JSON" };
  }
  const nodes = (Array.isArray(parsed["@graph"]) ? parsed["@graph"] : []) as Node[];
  const types = nodes.map((n) => (typeof n?.["@type"] === "string" ? n["@type"] : ""));
  if (!/schema\.org/.test(String(parsed["@context"])) || !nodes.length || types.some((t) => !t)) return { ok: false, detail: "The schema is missing @context or @type" };
  const want = MAIN_SCHEMA[a.page_type];
  if (!types.includes(want)) return { ok: false, detail: `No ${want} schema` };
  const faq = nodes.find((n) => n["@type"] === "FAQPage");
  if (a.faq.length && (!faq || !Array.isArray(faq.mainEntity) || faq.mainEntity.length !== a.faq.length))
    return { ok: false, detail: "The FAQPage schema doesn't match the FAQ on the page" };
  return { ok: true, detail: [...new Set(types)].join(", ") };
}

// ---------- Best-practice checklist ----------

export type CheckItem = { id: string; label: string; ok: boolean; detail: string };

const STOP_WORDS = new Set(["a", "an", "the", "in", "at", "on", "for", "of", "and", "to", "near", "me", "with", "your", "my", "is", "how", "what"]);

/** The keyword is on the text as a phrase, or every meaningful word of it is ("pico laser in tampines" matches "Pico laser, Tampines"). */
export function hasKeyword(text: string, keyword: string): boolean {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase().trim();
  if (!k || t.includes(k)) return true;
  const words = k.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return words.length > 0 && words.every((w) => t.includes(w));
}

const isQuestion = (h: string) => /\?\s*$/.test(h) || /^(how|what|why|when|where|which|who|can|do|does|is|are|should|will)\b/i.test(h.trim());

/** Words the owner never wants in their copy. */
const FILLER = /\b(leverag\w*|transformative|seamless(?:ly)?|unlock\w*|streamlin\w*|robust|synerg\w*|plain english|generic)\b/gi;

/** Claims healthcare advertising rules don't allow. */
const RISKY_CLAIMS = /\b(the best|best (?:clinic|doctor|treatment|results?|price)|no\.\s?1|number one|guarantee[sd]?|risk[- ]free|pain[- ]free|permanent(?:ly)? (?:results?|removal)|100% (?:safe|effective)|before[- ]and[- ]after|miracle)\b/gi;

const joinList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const n = (x: number) => x.toLocaleString("en");

/** SEO, answer-engine and AI-citation checks on the finished page. Computed from the output, never from the model's say-so. */
export function pageChecklist(a: Article, o: { keyword: string; regulated?: boolean }): CheckItem[] {
  const out: CheckItem[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) => out.push({ id, label, ok, detail });
  const t = a.page_type;

  const st = a.seo_title.length;
  add("seo_title", "SEO title fits in search results", st >= 20 && st <= SEO_TITLE_MAX, `${st}/${SEO_TITLE_MAX} characters${st > SEO_TITLE_MAX ? ", so Google will cut it off" : st < 20 ? ", too short to say what the page is" : ""}`);

  const ml = a.meta_description.length;
  add("meta", "Meta description length", ml >= 70 && ml <= META_MAX, `${ml}/${META_MAX} characters${ml < 70 ? ", add a reason to click" : ""}`);

  add("slug", "Short, readable URL", /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(a.slug) && a.slug.length <= 75, a.slug || "No URL");

  const h1s = (articleHtml(a).match(/<h1[\s>]/g) ?? []).length;
  add("h1", "Exactly one H1", h1s === 1 && Boolean(a.title.trim()), `${h1s} H1 on the page`);

  const aw = wordCount(a.answer);
  add(
    "answer",
    "Answer-first summary under the H1",
    aw >= ANSWER_WORDS.min && aw <= ANSWER_WORDS.max,
    aw ? `${aw} words (aim for ${ANSWER_WORDS.min} to ${ANSWER_WORDS.max})` : `Missing: add a ${ANSWER_WORDS.min} to ${ANSWER_WORDS.max} word answer right under the H1`,
  );

  if (o.keyword) {
    const missing = (
      [
        ["SEO title", a.seo_title],
        ["H1", a.title],
        ["first paragraph", a.answer || a.intro[0] || ""],
      ] as const
    )
      .filter(([, s]) => !hasKeyword(s, o.keyword))
      .map(([w]) => w);
    add("keyword", "Keyword in the title, H1 and first paragraph", !missing.length, missing.length ? `"${o.keyword}" is missing from the ${joinList([...missing])}` : `"${o.keyword}" is in all three`);
  }

  const qs = a.sections.filter((s) => isQuestion(s.heading)).length;
  const needQs = Math.min(isLandingPage(t) ? 1 : 2, a.sections.length);
  add("questions", "Headings phrased as real questions", a.sections.length > 0 && qs >= needQs, `${qs} of ${a.sections.length} H2s are questions`);

  const needFaq = t === "faq" ? 6 : 3;
  add("faq", "FAQ block", a.faq.length >= needFaq, a.faq.length ? `${a.faq.length} questions${a.faq.length < needFaq ? ` (aim for ${needFaq} or more)` : ""}` : "No FAQ yet");

  const sc = schemaCheck(a);
  add("schema", "Schema (JSON-LD) present and valid", sc.ok, sc.detail);

  const words = wordCount(visibleText(a).join(" "));
  const r = WORD_RANGE[t];
  add("length", `Length suits a ${PAGE_TYPE_LABEL[t].toLowerCase()}`, words >= r.min && words <= r.max, `${n(words)} words (aim for ${n(r.min)} to ${n(r.max)})`);

  add("cta", "Clear call to action", Boolean(a.cta.button && (a.cta.heading || a.cta.text)), a.cta.button ? `"${a.cta.button}"` : "No button text");

  add("links", "Internal links planned", a.internal_links.length >= 2, `${a.internal_links.length} link${a.internal_links.length === 1 ? "" : "s"} suggested`);

  const text = visibleText(a).join("\n");
  const filler = [...new Set([...text.matchAll(FILLER)].map((m) => m[0].toLowerCase()))];
  const dashes = /—/.test(text);
  add("words", "No filler words or em dashes", !filler.length && !dashes, filler.length || dashes ? `Rewrite: ${joinList([...filler, ...(dashes ? ["em dashes"] : [])])}` : "Clean");

  if (o.regulated) {
    const claims = [...new Set([...text.matchAll(RISKY_CLAIMS)].map((m) => m[0].toLowerCase()))];
    add("claims", "No claims advertising rules forbid", !claims.length, claims.length ? `Check: ${joinList(claims.map((c) => `"${c}"`))}` : "No superlatives, guarantees or before-and-after wording");
  }
  return out;
}

// ---------- Copy as HTML / Markdown ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function videoHtml(v: ArticleVideo): string {
  const id = v.platform === "youtube" ? youtubeId(v.url) : null;
  if (id) {
    return [
      "<figure>",
      `  <iframe width="560" height="315" src="${youtubeEmbedUrl(id)}" title="${esc(v.title || "YouTube video")}" loading="lazy" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
      v.intro ? `  <figcaption>${esc(v.intro)}</figcaption>` : "",
      "</figure>",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const label = v.title || `Watch on ${PLATFORM_LABEL[v.platform]}`;
  return `<p>${v.intro ? `${esc(v.intro)} ` : ""}<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(label)}</a> (${PLATFORM_LABEL[v.platform]})</p>`;
}

export function articleHtml(a: Article): string {
  const vids = videosBySection(a);
  const out: string[] = [`<h1>${esc(a.title)}</h1>`, ...[a.answer, ...a.intro].filter(Boolean).map((p) => `<p>${esc(p)}</p>`)];
  if (isLandingPage(a.page_type) && a.cta.button) out.push(`<p><strong>${esc(a.cta.button)}</strong></p>`);
  a.sections.forEach((s, i) => {
    out.push(`<h2>${esc(s.heading)}</h2>`, ...s.paragraphs.map((p) => `<p>${esc(p)}</p>`));
    if (s.bullets.length) out.push(`<ul>\n${s.bullets.map((b) => `  <li>${esc(b)}</li>`).join("\n")}\n</ul>`);
    for (const x of s.subsections ?? []) out.push(`<h3>${esc(x.heading)}</h3>`, ...x.paragraphs.map((p) => `<p>${esc(p)}</p>`));
    for (const v of vids.get(i) ?? []) out.push(videoHtml(v));
  });
  if (!a.sections.length) for (const v of a.videos) out.push(videoHtml(v));
  if (a.faq.length) {
    out.push("<h2>Frequently asked questions</h2>");
    for (const f of a.faq) out.push(`<h3>${esc(f.question)}</h3>`, `<p>${esc(f.answer)}</p>`);
  }
  if (a.cta.heading || a.cta.text) {
    if (a.cta.heading) out.push(`<h2>${esc(a.cta.heading)}</h2>`);
    if (a.cta.text) out.push(`<p>${esc(a.cta.text)}</p>`);
    if (a.cta.button) out.push(`<p><strong>${esc(a.cta.button)}</strong></p>`);
  }
  if (a.schema) out.push(`<script type="application/ld+json">\n${schemaJson(a.schema)}\n</script>`);
  return out.join("\n\n");
}

const mdEsc = (s: string) => s.replace(/([\\`*_])/g, "\\$1");

function videoMd(v: ArticleVideo): string {
  const label = v.title || `Watch on ${PLATFORM_LABEL[v.platform]}`;
  return `${v.intro ? `${mdEsc(v.intro)}\n\n` : ""}**Watch: [${mdEsc(label).replace(/[[\]]/g, "")}](${v.url})** (${PLATFORM_LABEL[v.platform]})`;
}

export function articleMarkdown(a: Article): string {
  const vids = videosBySection(a);
  const out: string[] = [`# ${mdEsc(a.title)}`, ...[a.answer, ...a.intro].filter(Boolean).map(mdEsc)];
  if (isLandingPage(a.page_type) && a.cta.button) out.push(`**${mdEsc(a.cta.button)}**`);
  a.sections.forEach((s, i) => {
    out.push(`## ${mdEsc(s.heading)}`, ...s.paragraphs.map(mdEsc));
    if (s.bullets.length) out.push(s.bullets.map((b) => `- ${mdEsc(b)}`).join("\n"));
    for (const x of s.subsections ?? []) out.push(`### ${mdEsc(x.heading)}`, ...x.paragraphs.map(mdEsc));
    for (const v of vids.get(i) ?? []) out.push(videoMd(v));
  });
  if (!a.sections.length) for (const v of a.videos) out.push(videoMd(v));
  if (a.faq.length) {
    out.push("## Frequently asked questions");
    for (const f of a.faq) out.push(`### ${mdEsc(f.question)}`, mdEsc(f.answer));
  }
  if (a.cta.heading) out.push(`## ${mdEsc(a.cta.heading)}`);
  if (a.cta.text) out.push(mdEsc(a.cta.text));
  if (a.cta.button) out.push(`**${mdEsc(a.cta.button)}**`);
  return out.join("\n\n") + "\n";
}
