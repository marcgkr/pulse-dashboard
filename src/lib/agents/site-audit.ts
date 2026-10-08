import * as cheerio from "cheerio";
import { normalizeUrl, safeFetch } from "../safe-fetch";

// Deterministic website checkup. Runs without AI, so it powers the free public checkup too.

export type CheckStatus = "pass" | "warn" | "fail";
export type CheckGroup = "Technical" | "On-page" | "Conversion" | "Tracking" | "AI search";

export type Check = {
  id: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  detail: string;
  weight: number;
};

export type PageSnapshot = {
  url: string;
  status: number;
  ms: number;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  canonical: string;
  noindex: boolean;
  bytes: number;
};

export type SiteAudit = {
  url: string;
  finalUrl: string;
  host: string;
  platform: string;
  home: PageSnapshot & {
    lang: string;
    viewport: boolean;
    ogTitle: string;
    ogImage: string;
    schemaTypes: string[];
    imagesTotal: number;
    imagesMissingAlt: number;
    internalLinks: number;
    phoneLinks: number;
    whatsappLinks: number;
    emailLinks: number;
    forms: number;
    bookingWidget: string;
    trackers: string[];
    textSample: string;
  };
  pages: PageSnapshot[];
  robotsTxt: boolean;
  sitemap: boolean;
  llmsTxt: boolean;
  https: boolean;
  pageSpeed: { performance: number | null; lcp: string | null; cls: string | null } | null;
  checks: Check[];
  score: number;
  groupScores: Record<CheckGroup, number>;
};

function detectPlatform(html: string, headers: Headers): string {
  const h = html.slice(0, 200000);
  if (/wp-content|wp-includes/i.test(h)) return "WordPress";
  if (/cdn\.shopify\.com|Shopify\.theme/i.test(h)) return "Shopify";
  if (/static\.wixstatic\.com|_wixCssImports|wix-warmup-data/i.test(h)) return "Wix";
  if (/squarespace\.com|static1\.squarespace/i.test(h)) return "Squarespace";
  if (/webflow\.(com|io)|data-wf-page/i.test(h)) return "Webflow";
  if (/framerusercontent|framer\.com\/m\//i.test(h)) return "Framer";
  if (/__NEXT_DATA__|\/_next\/static/i.test(h)) return "Next.js (custom)";
  if (/ghost\.org|ghost-(?:portal|sdk)/i.test(h)) return "Ghost";
  if (headers.get("x-powered-by")?.toLowerCase().includes("php")) return "Custom PHP";
  return "Custom / unknown";
}

function detectTrackers(html: string): string[] {
  const t: string[] = [];
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/.test(html)) t.push("Google Tag Manager");
  if (/gtag\(|googletagmanager\.com\/gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/.test(html)) t.push("Google Analytics 4");
  if (/AW-\d{6,}/.test(html)) t.push("Google Ads tag");
  if (/connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/.test(html)) t.push("Meta Pixel");
  if (/analytics\.tiktok\.com|ttq\.load/.test(html)) t.push("TikTok Pixel");
  if (/static\.hotjar\.com|clarity\.ms/.test(html)) t.push("Heatmaps (Hotjar/Clarity)");
  return t;
}

function detectBooking(html: string): string {
  const known: [RegExp, string][] = [
    [/calendly\.com/i, "Calendly"],
    [/fresha\.com/i, "Fresha"],
    [/vagaro\.com/i, "Vagaro"],
    [/setmore\.com/i, "Setmore"],
    [/acuityscheduling\.com/i, "Acuity"],
    [/simplybook\.(me|it)/i, "SimplyBook"],
    [/zocdoc|doctoranywhere|healthbeats/i, "Clinic booking"],
    [/booksy\.com/i, "Booksy"],
    [/opentable\.|chope\.co/i, "Restaurant booking"],
  ];
  return known.find(([re]) => re.test(html))?.[1] ?? "";
}

function snapshot(url: string, status: number, ms: number, html: string): PageSnapshot {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return {
    url,
    status,
    ms,
    title: $("title").first().text().trim(),
    description: $('meta[name="description"]').attr("content")?.trim() ?? "",
    h1: $("h1").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean),
    h2: $("h2").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean).slice(0, 20),
    wordCount: text ? text.split(" ").length : 0,
    canonical: $('link[rel="canonical"]').attr("href") ?? "",
    noindex: /noindex/i.test($('meta[name="robots"]').attr("content") ?? ""),
    bytes: Buffer.byteLength(html),
  };
}

async function exists(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await safeFetch(url, { timeoutMs: 8000, maxBytes: 200_000, signal });
    if (!r.ok) return false;
    const type = r.headers.get("content-type") ?? "";
    // Some sites return their homepage with 200 for every path.
    return !type.includes("text/html") || !/<html/i.test(r.body.slice(0, 500));
  } catch {
    return false;
  }
}

async function pageSpeed(url: string) {
  const key = process.env.GOOGLE_PSI_KEY;
  if (!key) return null;
  try {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${key}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(api, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: Record<string, { displayValue?: string }>;
      };
    };
    const lr = data.lighthouseResult;
    const perf = lr?.categories?.performance?.score;
    return {
      performance: typeof perf === "number" ? Math.round(perf * 100) : null,
      lcp: lr?.audits?.["largest-contentful-paint"]?.displayValue ?? null,
      cls: lr?.audits?.["cumulative-layout-shift"]?.displayValue ?? null,
    };
  } catch {
    return null;
  }
}

export async function auditSite(
  input: string,
  opts: { maxPages?: number; onProgress?: (m: string) => void; signal?: AbortSignal } = {},
): Promise<SiteAudit> {
  const signal = opts.signal;
  const progress = opts.onProgress ?? (() => {});
  const start = normalizeUrl(input);
  progress(`Opening ${start.hostname}`);
  const res = await safeFetch(start, { signal });
  if (!res.ok) throw new Error(`${start.hostname} returned an error (HTTP ${res.status}).`);
  const html = res.body;
  const final = new URL(res.finalUrl);
  const $ = cheerio.load(html);

  const home = snapshot(res.finalUrl, res.status, res.ms, html);

  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const walk = (n: unknown) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          const t = o["@type"];
          if (typeof t === "string") schemaTypes.add(t);
          if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaTypes.add(x));
          if (o["@graph"]) walk(o["@graph"]);
        }
      };
      walk(data);
    } catch {
      /* ignore invalid JSON-LD */
    }
  });

  const links = $("a[href]").map((_, el) => $(el).attr("href") ?? "").get();
  const internal = new Set<string>();
  for (const href of links) {
    try {
      const u = new URL(href, final);
      if (u.hostname.replace(/^www\./, "") === final.hostname.replace(/^www\./, "") && /^https?:$/.test(u.protocol)) {
        u.hash = "";
        if (!/\.(jpg|jpeg|png|gif|webp|pdf|zip|svg|mp4)$/i.test(u.pathname)) internal.add(u.toString());
      }
    } catch {
      /* skip bad href */
    }
  }

  const images = $("img");
  const imagesMissingAlt = images.filter((_, el) => !($(el).attr("alt") ?? "").trim()).length;
  const bodyText = $("body").clone().find("script,style,noscript,svg").remove().end().text().replace(/\s+/g, " ").trim();

  const homeFull = {
    ...home,
    lang: $("html").attr("lang") ?? "",
    viewport: $('meta[name="viewport"]').length > 0,
    ogTitle: $('meta[property="og:title"]').attr("content") ?? "",
    ogImage: $('meta[property="og:image"]').attr("content") ?? "",
    schemaTypes: [...schemaTypes],
    imagesTotal: images.length,
    imagesMissingAlt,
    internalLinks: internal.size,
    phoneLinks: links.filter((h) => h.startsWith("tel:")).length,
    whatsappLinks: links.filter((h) => /wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(h)).length,
    emailLinks: links.filter((h) => h.startsWith("mailto:")).length,
    forms: $("form").length,
    bookingWidget: detectBooking(html),
    trackers: detectTrackers(html),
    textSample: bodyText.slice(0, 6000),
  };

  // Inner pages: prefer short, nav-like paths.
  const maxPages = opts.maxPages ?? 6;
  const candidates = [...internal]
    .filter((u) => new URL(u).pathname !== "/" && u !== res.finalUrl)
    .sort((a, b) => new URL(a).pathname.length - new URL(b).pathname.length)
    .slice(0, maxPages);
  progress(`Reading ${candidates.length} inner pages`);
  const pages: PageSnapshot[] = [];
  await Promise.all(
    candidates.map(async (u) => {
      try {
        const r = await safeFetch(u, { timeoutMs: 12000, signal });
        pages.push(snapshot(r.finalUrl, r.status, r.ms, r.body));
      } catch {
        pages.push({ url: u, status: 0, ms: 0, title: "", description: "", h1: [], h2: [], wordCount: 0, canonical: "", noindex: false, bytes: 0 });
      }
    }),
  );

  progress("Checking robots.txt, sitemap and llms.txt");
  const origin = final.origin;
  const [robotsTxt, sitemap, llmsTxt, psi] = await Promise.all([
    exists(origin + "/robots.txt", signal),
    exists(origin + "/sitemap.xml", signal).then(async (ok) => ok || (await exists(origin + "/sitemap_index.xml", signal))),
    exists(origin + "/llms.txt", signal),
    (progress("Measuring mobile speed"), pageSpeed(res.finalUrl)),
  ]);

  const platform = detectPlatform(html, res.headers);
  const checks = buildChecks({ home: homeFull, pages, robotsTxt, sitemap, llmsTxt, https: final.protocol === "https:", psi, redirects: res.redirects });
  const { score, groupScores } = scoreChecks(checks);

  return {
    url: start.toString(),
    finalUrl: res.finalUrl,
    host: final.hostname,
    platform,
    home: homeFull,
    pages: pages.sort((a, b) => a.url.localeCompare(b.url)),
    robotsTxt,
    sitemap,
    llmsTxt,
    https: final.protocol === "https:",
    pageSpeed: psi,
    checks,
    score,
    groupScores,
  };
}

function buildChecks(a: {
  home: SiteAudit["home"];
  pages: PageSnapshot[];
  robotsTxt: boolean;
  sitemap: boolean;
  llmsTxt: boolean;
  https: boolean;
  psi: SiteAudit["pageSpeed"];
  redirects: string[];
}): Check[] {
  const c: Check[] = [];
  const add = (id: string, group: CheckGroup, label: string, status: CheckStatus, detail: string, weight = 1) =>
    c.push({ id, group, label, status, detail, weight });
  const h = a.home;

  // Technical
  add("https", "Technical", "Secure connection (HTTPS)", a.https ? "pass" : "fail", a.https ? "Site loads over HTTPS." : "Site does not load over HTTPS. Browsers mark it 'Not secure'.", 3);
  add("viewport", "Technical", "Mobile-friendly viewport", h.viewport ? "pass" : "fail", h.viewport ? "Viewport tag present." : "No viewport tag, so phones show a zoomed-out desktop page.", 3);
  add(
    "speed",
    "Technical",
    "Server response time",
    h.ms < 1200 ? "pass" : h.ms < 3000 ? "warn" : "fail",
    `Homepage HTML arrived in ${(h.ms / 1000).toFixed(1)}s from our server.`,
    2,
  );
  add(
    "weight",
    "Technical",
    "Page weight",
    h.bytes < 400_000 ? "pass" : h.bytes < 1_000_000 ? "warn" : "fail",
    `Homepage HTML is ${Math.round(h.bytes / 1024)} KB before images and scripts.`,
    1,
  );
  if (a.psi?.performance != null) {
    add(
      "psi",
      "Technical",
      "Google mobile speed score",
      a.psi.performance >= 80 ? "pass" : a.psi.performance >= 50 ? "warn" : "fail",
      `PageSpeed Insights mobile score ${a.psi.performance}/100${a.psi.lcp ? `, largest content paint ${a.psi.lcp}` : ""}.`,
      3,
    );
  }
  add("robots", "Technical", "robots.txt", a.robotsTxt ? "pass" : "warn", a.robotsTxt ? "Found." : "No robots.txt file found.", 1);
  add("sitemap", "Technical", "XML sitemap", a.sitemap ? "pass" : "fail", a.sitemap ? "Found." : "No sitemap.xml found, so Google has to discover pages on its own.", 2);
  add("noindex", "Technical", "Homepage is indexable", h.noindex ? "fail" : "pass", h.noindex ? "Homepage tells search engines NOT to index it (noindex)." : "No noindex tag on the homepage.", 4);
  const broken = a.pages.filter((p) => p.status === 0 || p.status >= 400);
  add(
    "broken",
    "Technical",
    "Inner pages load",
    broken.length === 0 ? "pass" : "fail",
    broken.length === 0 ? `All ${a.pages.length} inner pages we opened loaded.` : `${broken.length} page(s) failed: ${broken.map((p) => p.url).join(", ")}`,
    2,
  );
  add("lang", "Technical", "Language declared", h.lang ? "pass" : "warn", h.lang ? `lang="${h.lang}"` : "The page doesn't declare its language.", 1);

  // On-page
  const tl = h.title.length;
  add(
    "title",
    "On-page",
    "Homepage title",
    !h.title ? "fail" : tl < 25 || tl > 65 ? "warn" : "pass",
    h.title ? `"${h.title}" (${tl} characters; 30 to 60 reads best in Google).` : "No title tag.",
    3,
  );
  const dl = h.description.length;
  add(
    "description",
    "On-page",
    "Meta description",
    !h.description ? "fail" : dl < 70 || dl > 165 ? "warn" : "pass",
    h.description ? `${dl} characters.` : "No meta description, so Google picks a random snippet.",
    2,
  );
  add(
    "h1",
    "On-page",
    "One clear H1 headline",
    h.h1.length === 1 ? "pass" : h.h1.length === 0 ? "fail" : "warn",
    h.h1.length === 0 ? "No H1 on the homepage." : h.h1.length === 1 ? `"${h.h1[0]}"` : `${h.h1.length} H1 tags found.`,
    2,
  );
  add(
    "content",
    "On-page",
    "Enough words on the homepage",
    h.wordCount >= 400 ? "pass" : h.wordCount >= 200 ? "warn" : "fail",
    `About ${h.wordCount} words of readable text.`,
    2,
  );
  add(
    "alt",
    "On-page",
    "Image alt text",
    h.imagesTotal === 0 || h.imagesMissingAlt === 0 ? "pass" : h.imagesMissingAlt / h.imagesTotal > 0.3 ? "fail" : "warn",
    h.imagesTotal === 0 ? "No images on the homepage." : `${h.imagesMissingAlt} of ${h.imagesTotal} images have no alt text.`,
    1,
  );
  const titles = a.pages.filter((p) => p.title).map((p) => p.title.toLowerCase());
  const dupTitles = titles.length - new Set(titles).size;
  const missingMeta = a.pages.filter((p) => p.status > 0 && p.status < 400 && !p.description).length;
  add(
    "inner-meta",
    "On-page",
    "Inner page titles and descriptions",
    dupTitles === 0 && missingMeta === 0 ? "pass" : dupTitles + missingMeta > 2 ? "fail" : "warn",
    `${dupTitles} duplicate title(s), ${missingMeta} page(s) missing a meta description, out of ${a.pages.length} checked.`,
    2,
  );
  add("og", "On-page", "Social share preview", h.ogTitle && h.ogImage ? "pass" : "warn", h.ogTitle && h.ogImage ? "Open Graph title and image set." : "Links shared on WhatsApp and Facebook won't show a proper preview.", 1);
  add("canonical", "On-page", "Canonical tag", h.canonical ? "pass" : "warn", h.canonical ? "Set." : "No canonical tag on the homepage.", 1);

  // Conversion
  const contactPaths = h.phoneLinks + h.whatsappLinks + h.forms + (h.bookingWidget ? 1 : 0);
  add(
    "contact",
    "Conversion",
    "Easy ways to get in touch",
    contactPaths >= 2 ? "pass" : contactPaths === 1 ? "warn" : "fail",
    `Tap-to-call links: ${h.phoneLinks}, WhatsApp links: ${h.whatsappLinks}, forms: ${h.forms}${h.bookingWidget ? `, booking: ${h.bookingWidget}` : ""}.`,
    4,
  );
  add(
    "whatsapp",
    "Conversion",
    "WhatsApp click-to-chat",
    h.whatsappLinks > 0 ? "pass" : "warn",
    h.whatsappLinks > 0 ? "WhatsApp link found." : "No WhatsApp link. In Singapore this is often the fastest way customers enquire.",
    2,
  );
  add(
    "booking",
    "Conversion",
    "Online booking or enquiry form",
    h.bookingWidget || h.forms > 0 ? "pass" : "warn",
    h.bookingWidget ? `${h.bookingWidget} detected.` : h.forms > 0 ? "Enquiry form found." : "No booking tool or form on the homepage.",
    2,
  );

  // Tracking
  const hasAnalytics = h.trackers.some((t) => t.includes("Analytics") || t.includes("Tag Manager"));
  add("analytics", "Tracking", "Website analytics", hasAnalytics ? "pass" : "fail", hasAnalytics ? h.trackers.join(", ") : "No Google Analytics or Tag Manager found. You can't see where customers come from.", 3);
  const hasAdsTag = h.trackers.some((t) => t === "Meta Pixel" || t === "Google Ads tag" || t === "Google Tag Manager");
  add("ad-pixels", "Tracking", "Ad conversion tracking", hasAdsTag ? "pass" : "warn", hasAdsTag ? "Ad tracking present." : "No Meta Pixel or Google Ads tag found. Ads can't learn who converts.", 2);

  // AI search (AEO / GEO)
  const st = h.schemaTypes;
  const hasBizSchema = st.some((t) => /LocalBusiness|Organization|MedicalBusiness|MedicalClinic|Physician|Dentist|BeautySalon|HealthAndBeautyBusiness|LegalService|Attorney|Store|Restaurant|ProfessionalService/i.test(t));
  add("schema-biz", "AI search", "Business schema markup", hasBizSchema ? "pass" : "fail", st.length ? `Schema types: ${st.join(", ")}` : "No structured data. AI assistants and Google have to guess what you are.", 3);
  const hasFaq = st.includes("FAQPage") || h.h2.some((x) => /faq|frequently asked|questions/i.test(x));
  add("faq", "AI search", "Answers to common questions", hasFaq ? "pass" : "warn", hasFaq ? "FAQ content found." : "No FAQ section. Question-and-answer content is what AI assistants quote.", 2);
  add("llms", "AI search", "llms.txt file", a.llmsTxt ? "pass" : "warn", a.llmsTxt ? "Found." : "No /llms.txt. It's a simple file that tells AI assistants what your business does.", 1);

  return c;
}

export function scoreChecks(checks: Check[]) {
  const val = (s: CheckStatus) => (s === "pass" ? 1 : s === "warn" ? 0.5 : 0);
  const total = checks.reduce((n, c) => n + c.weight, 0);
  const got = checks.reduce((n, c) => n + c.weight * val(c.status), 0);
  const groups: CheckGroup[] = ["Technical", "On-page", "Conversion", "Tracking", "AI search"];
  const groupScores = Object.fromEntries(
    groups.map((g) => {
      const gc = checks.filter((c) => c.group === g);
      const t = gc.reduce((n, c) => n + c.weight, 0);
      const s = gc.reduce((n, c) => n + c.weight * val(c.status), 0);
      return [g, t ? Math.round((s / t) * 100) : 100];
    }),
  ) as Record<CheckGroup, number>;
  return { score: total ? Math.round((got / total) * 100) : 0, groupScores };
}
