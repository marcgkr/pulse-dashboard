// Keyword Lab article mode: shared types plus the HTML and Markdown the owner copies into their site.
// No server-only imports here: the report (a client component) imports from this file.

import type { ContentBrief } from "./keywords-demo";

/** The brief an article is written from, as the report sends it with "Write this article". */
export type ArticleBrief = {
  title: string;
  target_keyword: string;
  slug: string;
  h1: string;
  outline: string[];
  must_include: string[];
  internal_links: string[];
};

export type ArticleSection = { heading: string; paragraphs: string[]; bullets: string[] };

export type ArticleVideo = {
  url: string;
  platform: "instagram" | "youtube" | "tiktok" | "facebook";
  title: string;
  /** One sentence that introduces the video in the article. */
  intro: string;
  /** Heading of the section the video goes after. */
  after_heading: string;
};

export type Article = {
  title: string;
  meta_description: string;
  slug: string;
  intro: string[];
  sections: ArticleSection[];
  faq: { question: string; answer: string }[];
  cta: { heading: string; text: string; button: string };
  videos: ArticleVideo[];
};

export const META_MAX = 155;

export const PLATFORM_LABEL: Record<ArticleVideo["platform"], string> = { instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook" };

/** The primary keyword of a brief: the title tag leads with it ("Hydrafacial in Tampines | Lumen" -> "hydrafacial in tampines"). */
export function briefKeyword(b: Pick<ContentBrief, "title" | "h1">): string {
  const head = (b.title || b.h1 || "").split(/\s[|:–-]\s|[|:?]/)[0] ?? "";
  return head.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 80);
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

/** Placeholders the owner must fill in before publishing, like [your price]. */
export function articlePlaceholders(a: Article): string[] {
  const text = [a.title, a.meta_description, ...a.intro, ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...s.bullets]), ...a.faq.flatMap((f) => [f.question, f.answer]), a.cta.heading, a.cta.text, a.cta.button].join("\n");
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
  const out: string[] = [`<h1>${esc(a.title)}</h1>`, ...a.intro.map((p) => `<p>${esc(p)}</p>`)];
  a.sections.forEach((s, i) => {
    out.push(`<h2>${esc(s.heading)}</h2>`, ...s.paragraphs.map((p) => `<p>${esc(p)}</p>`));
    if (s.bullets.length) out.push(`<ul>\n${s.bullets.map((b) => `  <li>${esc(b)}</li>`).join("\n")}\n</ul>`);
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
  return out.join("\n\n");
}

const mdEsc = (s: string) => s.replace(/([\\`*_])/g, "\\$1");

function videoMd(v: ArticleVideo): string {
  const label = v.title || `Watch on ${PLATFORM_LABEL[v.platform]}`;
  return `${v.intro ? `${mdEsc(v.intro)}\n\n` : ""}**Watch: [${mdEsc(label).replace(/[[\]]/g, "")}](${v.url})** (${PLATFORM_LABEL[v.platform]})`;
}

export function articleMarkdown(a: Article): string {
  const vids = videosBySection(a);
  const out: string[] = [`# ${mdEsc(a.title)}`, ...a.intro.map(mdEsc)];
  a.sections.forEach((s, i) => {
    out.push(`## ${mdEsc(s.heading)}`, ...s.paragraphs.map(mdEsc));
    if (s.bullets.length) out.push(s.bullets.map((b) => `- ${mdEsc(b)}`).join("\n"));
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
