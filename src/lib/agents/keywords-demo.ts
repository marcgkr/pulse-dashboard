// Pure helpers for Keyword Lab: pasted-data parsing, quick wins, visibility score and sample output.
// No server-only imports here: the report (a client component) imports isQuickWinRow from this file.

import type { WorkspaceRow } from "../db";
import type { Prescription } from "../ai";
import { marketFor } from "../markets";
import type { ArticleBrief } from "./article-format";

// ---------- Shared types ----------

export type Intent = "buy" | "compare" | "learn" | "local";
export type Level = "high" | "medium" | "low";
export type Difficulty = "easy" | "medium" | "hard";

export type KeywordCluster = {
  name: string;
  intent: Intent;
  priority: Level;
  /** Estimate relative to the other clusters. Never a search volume. */
  relative_demand: Level;
  difficulty: Difficulty;
  keywords: string[];
  target_page: { action: "optimise" | "create"; page: string; slug: string };
  why: string;
};

export type AeoQuestion = { question: string; answer_angle: string; where_to_answer: string; format: string };

export type ContentBrief = {
  title: string;
  slug: string;
  h1: string;
  outline: string[];
  must_include: string[];
  internal_links: string[];
};

export type DataRow = {
  query: string;
  clicks: number | null;
  impressions: number | null;
  /** Percent, e.g. 3.4 means 3.4% */
  ctr: number | null;
  position: number | null;
  /** Avg. monthly searches when the export gives a plain number. */
  searches: number | null;
  /** Raw searches text when it is a range like "1K - 10K". */
  searches_label: string | null;
  competition: string | null;
  /** Page that gets the most clicks for this query (connected Search Console only). */
  page?: string;
};

export type DataColumn = "clicks" | "impressions" | "ctr" | "position" | "searches" | "competition";

export type ParsedData = {
  source: "search_console" | "keyword_planner" | "list";
  columns: DataColumn[];
  rows: DataRow[];
  /** Rows found before the display cap. */
  total_rows: number;
  /** Lines we could not read as a keyword row. */
  skipped: number;
  totals: { clicks: number; impressions: number; ctr: number | null; avg_position: number | null } | null;
};

export type KeywordsInput = {
  seeds: string[];
  location: string;
  focus: "discover" | "expand" | "article";
  /** Keyword to drill into. Empty string when not expanding. */
  expand: string;
  /** Raw pasted CSV / text from Search Console or Keyword Planner. */
  data: string;
  /** Read the connected Search Console property (last 90 days) at run time instead of pasted data. */
  gsc?: boolean;
  /** Article mode: write a blog article or website page from this brief instead of a keyword map. */
  article?: ArticleBrief;
};

// ---------- Small text helpers ----------

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Turns "Services/Hydrafacial Price" or a full URL into "/services/hydrafacial-price". */
export function normalizeSlug(s: string): string {
  let path = String(s ?? "").trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      /* keep as is */
    }
  }
  const parts = path.split("/").map(slugify).filter(Boolean);
  return "/" + parts.join("/");
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "with"]);

export function titleCase(s: string): string {
  let first = true;
  return s.replace(/\b([a-z])([a-z]*)/g, (word: string, a: string, b: string) => {
    const keep = !first && SMALL_WORDS.has(word);
    first = false;
    return keep ? word : a.toUpperCase() + b;
  });
}

export function cleanKeyword(s: string): string {
  return String(s ?? "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 90);
}

export function uniqueKeywords(list: string[], cap = 15): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of list.map(cleanKeyword)) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= cap) break;
  }
  return out;
}

/** Splits the seed textarea (one per line) or a comma list from the profile. */
export function splitSeeds(raw: unknown): string[] {
  const text = Array.isArray(raw) ? raw.map(String).join("\n") : String(raw ?? "");
  let parts = text.split(/[\n;]+/);
  if (parts.filter((p) => p.trim()).length <= 1) parts = text.split(/[,\n]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const s = p.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim().slice(0, 80);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 12) break;
  }
  return out;
}

/** Guesses a country code from free-text location. Null when nothing matches. */
export function countryCode(location: string): string | null {
  const l = location.toLowerCase();
  const table: [RegExp, string][] = [
    [/singapore/, "SG"],
    [/malaysia|kuala lumpur|johor|penang/, "MY"],
    [/australia|sydney|melbourne|brisbane|perth/, "AU"],
    [/new zealand|auckland|wellington|christchurch/, "NZ"],
    [/hong kong/, "HK"],
    [/united kingdom|\buk\b|london|manchester/, "GB"],
    [/united states|\busa\b|new york|california/, "US"],
    [/united arab emirates|\buae\b|dubai|abu dhabi/, "AE"],
    [/indonesia|jakarta|bali/, "ID"],
    [/philippines|manila/, "PH"],
    [/thailand|bangkok/, "TH"],
    [/vietnam|ho chi minh|hanoi/, "VN"],
  ];
  return table.find(([re]) => re.test(l))?.[1] ?? null;
}

/**
 * Web search location for a workspace. The workspace's country is the source of truth; only a business
 * set to "Anywhere else" falls back to a guess from its location text (or no location at all).
 */
export function searchCountryFor(country: string | null | undefined, location: string): string | null {
  const m = marketFor(country);
  return m.code === "INTL" ? countryCode(location) : m.searchCountry;
}

// ---------- Pasted data parsing ----------

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 15);
  if (sample.some((l) => l.includes("\t"))) return "\t";
  const count = (ch: string) => sample.reduce((n, l) => n + l.split(ch).length - 1, 0);
  const commas = count(",");
  const semis = count(";");
  if (semis > commas && semis > 0) return ";";
  if (commas > 0) return ",";
  return null;
}

/** Minimal CSV reader that handles quoted fields, doubled quotes and quoted newlines. */
function readRows(text: string, delim: string | null): string[][] {
  if (!delim) return text.split(/\r?\n/).map((l) => [l]);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  // Whitespace-only so far (tracked instead of cell.trim() per character, which was quadratic).
  let blank = true;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      blank = false;
      continue;
    }
    if (ch === '"' && blank) {
      quoted = true;
      cell = "";
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
      blank = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      blank = true;
    } else {
      cell += ch;
      if (ch !== " " && ch !== "\t") blank = false;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const COLS: { key: "query" | DataColumn; re: RegExp }[] = [
  { key: "query", re: /^(top )?(queries|query)$|^keywords?$|^search (terms?|query|queries)$|^keyword text$/ },
  { key: "clicks", re: /^(url )?clicks?$/ },
  { key: "impressions", re: /^(url )?impr(essions|\.)?$/ },
  { key: "ctr", re: /^(url )?ctr$|click.?through rate/ },
  { key: "position", re: /^(avg\.? |average )?(position|pos\.?)$|^average position$|^avg\.? pos/ },
  { key: "searches", re: /avg\.? monthly searches|^monthly searches|^search volume|^(avg\.? )?volume$|^searches$/ },
  { key: "competition", re: /^competition$/ },
];

function normHeader(h: string): string {
  return h.replace(/^﻿/, "").replace(/["']/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNum(raw: string | undefined, delim: string | null): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/ /g, " ");
  if (!s || s === "--" || s === "-" || /^n\/?a$/i.test(s)) return null;
  s = s.replace(/[%<>\s]/g, "");
  if (delim === ";") s = s.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const m = /^(-?\d+(?:\.\d+)?)([km])?$/i.exec(s);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2]?.toLowerCase() === "k") n *= 1000;
  if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

const MAX_ROWS = 300;

/**
 * Tolerant parser for pasted Google Search Console (Queries) or Keyword Planner exports.
 * Falls back to a plain keyword list when no recognisable header is found.
 * Returns null when there is nothing usable.
 */
export function parsePastedData(text: string): ParsedData | null {
  const clean = String(text ?? "").replace(/^﻿/, "").trim();
  if (!clean) return null;
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  const delim = detectDelimiter(lines);
  const rows = readRows(clean, delim).filter((r) => r.some((c) => c.trim()));

  // Find the header row (Keyword Planner puts two title lines above it).
  let headerIdx = -1;
  let map: Partial<Record<"query" | DataColumn, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(normHeader);
    const m: typeof map = {};
    cells.forEach((c, idx) => {
      for (const col of COLS) if (m[col.key] == null && col.re.test(c)) m[col.key] = idx;
    });
    if (m.query != null) {
      headerIdx = i;
      map = m;
      break;
    }
  }

  const out: DataRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  const empty = { clicks: null, impressions: null, ctr: null, position: null, searches: null, searches_label: null, competition: null };

  if (headerIdx === -1) {
    // Plain list: first cell of each line is a keyword.
    for (const r of rows) {
      const q = cleanKeyword(r[0] ?? "");
      if (!q || parseNum(q, delim) != null) {
        skipped++;
        continue;
      }
      if (seen.has(q)) continue;
      seen.add(q);
      out.push({ query: q, ...empty });
    }
    if (!out.length) return null;
    return { source: "list", columns: [], rows: out.slice(0, MAX_ROWS), total_rows: out.length, skipped, totals: null };
  }

  const get = (r: string[], k: DataColumn) => (map[k] != null ? r[map[k]!] : undefined);
  for (const r of rows.slice(headerIdx + 1)) {
    const q = cleanKeyword(r[map.query!] ?? "");
    if (!q || /^(total|grand total)$/i.test(q)) {
      skipped++;
      continue;
    }
    if (seen.has(q)) continue;
    seen.add(q);
    const clicks = parseNum(get(r, "clicks"), delim);
    const impressions = parseNum(get(r, "impressions"), delim);
    let ctr = parseNum(get(r, "ctr"), delim);
    const ctrRaw = get(r, "ctr") ?? "";
    if (ctr != null && !ctrRaw.includes("%") && ctr <= 1) ctr = ctr * 100;
    if (ctr == null && clicks != null && impressions) ctr = (clicks / impressions) * 100;
    const searchesRaw = (get(r, "searches") ?? "").trim();
    const searches = parseNum(searchesRaw, delim);
    out.push({
      query: q,
      clicks,
      impressions,
      ctr: ctr == null ? null : Math.round(ctr * 100) / 100,
      position: (() => {
        const p = parseNum(get(r, "position"), delim);
        return p == null ? null : Math.round(p * 10) / 10;
      })(),
      searches,
      searches_label: searches == null && searchesRaw ? searchesRaw : null,
      competition: (get(r, "competition") ?? "").trim() || null,
    });
  }
  return toParsedData(out, skipped);
}

/** Sorts rows, works out the source and Search Console totals, and caps the rows. Shared by pasted and connected data. */
export function toParsedData(rows: DataRow[], skipped = 0): ParsedData | null {
  let out = rows;
  if (!out.length) return null;

  const columns = (["clicks", "impressions", "ctr", "position", "searches", "competition"] as DataColumn[]).filter((c) =>
    c === "searches" ? out.some((r) => r.searches != null || r.searches_label) : out.some((r) => r[c] != null),
  );
  const isGsc = columns.includes("impressions") || columns.includes("clicks") || columns.includes("position");
  const source: ParsedData["source"] = isGsc ? "search_console" : columns.includes("searches") ? "keyword_planner" : "list";

  out = [...out].sort((a, b) => (b.impressions ?? -1) - (a.impressions ?? -1) || (b.searches ?? -1) - (a.searches ?? -1) || (b.clicks ?? -1) - (a.clicks ?? -1));

  let totals: ParsedData["totals"] = null;
  if (isGsc) {
    const clicks = out.reduce((n, r) => n + (r.clicks ?? 0), 0);
    const impressions = out.reduce((n, r) => n + (r.impressions ?? 0), 0);
    const withPos = out.filter((r) => r.position != null && r.impressions);
    const posWeight = withPos.reduce((n, r) => n + r.impressions!, 0);
    totals = {
      clicks,
      impressions,
      ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : null,
      avg_position: posWeight ? Math.round((withPos.reduce((n, r) => n + r.position! * r.impressions!, 0) / posWeight) * 10) / 10 : null,
    };
  }

  return { source, columns, rows: out.slice(0, MAX_ROWS), total_rows: out.length, skipped, totals };
}

/** A query sitting at positions 5-15: close enough to page one that a page refresh can move it. */
export function isQuickWinRow(r: Pick<DataRow, "position" | "impressions">): boolean {
  return r.position != null && r.position >= 4.5 && r.position < 15.5 && (r.impressions == null || r.impressions >= 10);
}

const fmt = (n: number) => n.toLocaleString("en-SG");

/** Quick wins computed straight from the pasted Search Console data. */
export function dataQuickWins(data: ParsedData | null, limit = 6): string[] {
  if (!data || data.source !== "search_console") return [];
  const out: string[] = [];
  const near = data.rows.filter(isQuickWinRow).slice(0, limit);
  for (const r of near) {
    out.push(
      `"${r.query}" sits at position ${r.position}${r.impressions != null ? ` with ${fmt(r.impressions)} impressions` : ""}${
        r.clicks != null ? ` and ${fmt(r.clicks)} clicks` : ""
      }. Strengthen the page that ranks for it${r.page ? ` (${r.page})` : ""}: put the phrase in the title and H1, answer the question directly in the first paragraph, and link to it from your homepage.`,
    );
  }
  const avgCtr = data.totals?.ctr;
  if (avgCtr != null) {
    const lowCtr = data.rows
      .filter((r) => r.position != null && r.position <= 3 && r.ctr != null && (r.impressions ?? 0) >= 20 && r.ctr < avgCtr / 2)
      .slice(0, 3);
    for (const r of lowCtr)
      out.push(
        `"${r.query}" already ranks at position ${r.position} but only ${r.ctr}% of searchers click, against ${avgCtr}% across all your queries. Rewrite that page's title tag and meta description so they match the search and give a reason to click.`,
      );
  }
  return out;
}

/**
 * Visibility score from pasted Search Console data. Explainable on purpose:
 * the share of impressions on page one, weighted by position.
 */
export function visibilityScore(data: ParsedData | null): { score: number; note: string } | null {
  if (!data || data.source !== "search_console") return null;
  const rows = data.rows.filter((r) => r.position != null && r.impressions != null && r.impressions > 0);
  const total = rows.reduce((n, r) => n + r.impressions!, 0);
  if (rows.length < 3 || total === 0) return null;
  const w = (p: number) => (p <= 3 ? 1 : p <= 10 ? 0.6 : p <= 20 ? 0.25 : 0.05);
  const score = Math.round((100 * rows.reduce((n, r) => n + w(r.position!) * r.impressions!, 0)) / total);
  const share = (lo: number, hi: number) =>
    Math.round((100 * rows.filter((r) => r.position! > lo && r.position! <= hi).reduce((n, r) => n + r.impressions!, 0)) / total);
  return {
    score,
    note: `Visibility score ${score}/100, worked out from the ${rows.length} queries in your Search Console data. Each impression counts in full when the query ranks in the top 3, 60% at positions 4 to 10, 25% at 11 to 20 and 5% below that. Right now ${share(0, 3)}% of your impressions are top 3, ${share(3, 10)}% are positions 4 to 10 and ${share(10, 1000)}% are below page one.`,
  };
}

/** Compact text table of the pasted data for the AI prompt. */
export function dataForPrompt(data: ParsedData | null, limit = 80): string {
  if (!data) return "None pasted.";
  const head = ["query", ...data.columns];
  const lines = data.rows.slice(0, limit).map((r) =>
    [
      r.query,
      ...data.columns.map((c) => {
        if (c === "searches") return r.searches ?? r.searches_label ?? "";
        if (c === "ctr") return r.ctr == null ? "" : `${r.ctr}%`;
        return r[c] ?? "";
      }),
    ].join(" | "),
  );
  const src = data.source === "search_console" ? "Google Search Console" : data.source === "keyword_planner" ? "Google Keyword Planner" : "Plain keyword list";
  const totals = data.totals
    ? `\nTotals: ${data.totals.clicks} clicks, ${data.totals.impressions} impressions, CTR ${data.totals.ctr ?? "?"}%, impression-weighted avg position ${data.totals.avg_position ?? "?"}`
    : "";
  return `Source: ${src}. ${data.total_rows} rows (showing ${lines.length}).${totals}\n${head.join(" | ")}\n${lines.join("\n")}`;
}

// ---------- Sample output (no API key) ----------

type Place = { area: string; region: string; areaTitle: string; regionTitle: string };

/** Strips location words and "near me" from a keyword so sample variants don't repeat the area. */
function coreKeyword(kw: string, p: Place): string {
  const drop = new Set([...p.area.split(" "), ...p.region.split(" ")]);
  const core = kw
    .replace(/\bnear me\b/g, " ")
    .split(/\s+/)
    .filter((w) => w && !drop.has(w))
    .join(" ")
    .replace(/\s+(in|at|near)$/, "")
    .trim();
  return core || kw;
}

const related = (a: string, b: string) => a.includes(b) || b.includes(a);

/**
 * Turns a free-text location into one area + one region.
 * "Singapore (Tampines and Orchard)" -> tampines / singapore; "Tampines, Singapore" -> tampines / singapore.
 */
function place(location: string): Place {
  const raw = (location || "Singapore").toLowerCase();
  const inner = raw.match(/\(([^)]*)\)/)?.[1] ?? "";
  const outer = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const split = (t: string) => t.split(/,|\/|&|\band\b|;/).map((x) => x.trim()).filter(Boolean);
  const outerParts = split(outer);
  const innerParts = split(inner).filter((x) => !/^(east|west|north|south|central|north-east|islandwide)$/.test(x));
  const region = outerParts[outerParts.length - 1] || "singapore";
  const area = innerParts[0] || (outerParts.length > 1 ? outerParts[0] : region);
  return { area, region, areaTitle: titleCase(area), regionTitle: titleCase(region) };
}

export function sampleClusters(input: KeywordsInput, ws: WorkspaceRow): KeywordCluster[] {
  const p = place(input.location);
  const regulated = Boolean(ws.regulated);
  const loc = (kw: string) => uniqueKeywords([`${kw} ${p.area}`, `${kw} near me`, p.area !== p.region ? `${kw} ${p.region}` : "", `best ${kw} ${p.area}`, `${kw} ${p.area} reviews`, regulated ? `${kw} clinic ${p.area}` : `affordable ${kw} ${p.area}`]);
  const bestNote = regulated ? " Do not call yourself 'the best' on the page (healthcare advertising rules); answer the search with facts, credentials and reviews instead." : "";

  if (input.expand) {
    const full = cleanKeyword(input.expand);
    const kw = coreKeyword(full, p);
    const others = input.seeds.map(cleanKeyword).filter((s) => s && !related(s, kw)).slice(0, 3);
    const sg = p.region === "singapore";
    return [
      {
        name: `${titleCase(kw)}: price and cost`,
        intent: "buy",
        priority: "high",
        relative_demand: "high",
        difficulty: "medium",
        keywords: uniqueKeywords([`${kw} price`, `${kw} price ${p.region}`, `${kw} cost`, `how much is ${kw}`, `${kw} package`, `${kw} price range`, regulated ? "" : `cheapest ${kw} ${p.region}`]),
        target_page: { action: "create", page: `${titleCase(kw)} prices`, slug: `/${slugify(kw)}-price` },
        why: `People typing a price into the search box are close to booking. A page that states a price or price range, and what is included, is what Google and AI assistants quote for these searches.`,
      },
      {
        name: `${titleCase(kw)} near you`,
        intent: "local",
        priority: "high",
        relative_demand: "medium",
        difficulty: "easy",
        keywords: uniqueKeywords([full, `${kw} near me`, `${kw} ${p.area}`, `${kw} ${p.region}`, sg && p.area !== p.region ? `${kw} near ${p.area} mrt` : "", `${kw} open sunday`, `${kw} walk in`, `same day ${kw}`]),
        target_page: { action: "optimise", page: `${titleCase(kw)} service page`, slug: `/${slugify(kw)}` },
        why: `"Near me" searches are won by your Google Business Profile plus a service page that names ${p.areaTitle}. These are usually easier to win than citywide searches.`,
      },
      {
        name: `Best ${kw} and reviews`,
        intent: "compare",
        priority: "medium",
        relative_demand: "medium",
        difficulty: "hard",
        keywords: uniqueKeywords([`best ${kw} ${p.region}`, `${kw} reviews`, `${kw} review ${p.region}`, `top ${kw} ${p.area}`, `${kw} reddit`, `${kw} recommendations`]),
        target_page: { action: "optimise", page: `${titleCase(kw)} service page (reviews section)`, slug: `/${slugify(kw)}#reviews` },
        why: `These lists are usually won by directories and review sites, so the realistic play is to get listed on them and show real reviews on your page.${bestNote}`,
      },
      {
        name: `${titleCase(kw)} compared`,
        intent: "compare",
        priority: "medium",
        relative_demand: "low",
        difficulty: "easy",
        keywords: uniqueKeywords([...others.map((o) => `${kw} vs ${o}`), `${kw} alternatives`, ...others.slice(0, 2).map((o) => `difference between ${kw} and ${o}`), `is ${kw} worth it`]),
        target_page: { action: "create", page: others[0] ? `${titleCase(kw)} vs ${titleCase(others[0])}` : `Is ${kw} worth it?`, slug: others[0] ? `/blog/${slugify(kw)}-vs-${slugify(others[0])}` : `/blog/is-${slugify(kw)}-worth-it` },
        why: `Comparison questions are what people ask ChatGPT and Google AI Overviews before choosing. A fair comparison table is one of the formats AI answers quote most.`,
      },
      {
        name: `${titleCase(kw)} for specific people`,
        intent: "learn",
        priority: "low",
        relative_demand: "low",
        difficulty: "easy",
        keywords: uniqueKeywords([`${kw} for first timers`, `${kw} for beginners`, `${kw} for men`, `${kw} for women`, `${kw} for busy professionals`, `${kw} for seniors`]),
        target_page: { action: "optimise", page: `${titleCase(kw)} service page (who it suits section)`, slug: `/${slugify(kw)}#who-it-suits` },
        why: `Long-tail searches with an audience attached have little competition. A short "who it suits" section with a line for each group can pick them up.`,
      },
      {
        name: `Questions about ${kw}`,
        intent: "learn",
        priority: "medium",
        relative_demand: "medium",
        difficulty: "easy",
        keywords: uniqueKeywords([`what is ${kw}`, `is ${kw} worth it`, `how long does ${kw} take`, `how often should i get ${kw}`, `${kw} what to expect`, `${kw} pros and cons`]),
        target_page: { action: "optimise", page: `${titleCase(kw)} FAQ block`, slug: `/${slugify(kw)}#faq` },
        why: `These are the questions people type into AI assistants. Short, direct answers in an FAQ block (with FAQPage schema) make your page easy to quote.`,
      },
    ];
  }

  const seeds = input.seeds.map(cleanKeyword).filter(Boolean);
  const main = seeds[0] || cleanKeyword(ws.industry) || "your service";
  const clusters: KeywordCluster[] = seeds.slice(0, 3).map((s, i) => ({
    name: `${titleCase(s)} in ${p.areaTitle}`,
    intent: "local",
    priority: i < 2 ? "high" : "medium",
    relative_demand: i === 0 ? "high" : "medium",
    difficulty: "medium",
    keywords: loc(s),
    target_page: { action: "optimise", page: `${titleCase(s)} service page`, slug: `/${slugify(s)}` },
    why: `People searching "${s} near me" are ready to book. One page per service that names ${p.areaTitle} in the title, H1 and first paragraph is how you show up here and in the Google Maps results.${i === 0 ? bestNote : ""}`,
  }));
  clusters.push({
    name: `${titleCase(main)} prices`,
    intent: "buy",
    priority: "high",
    relative_demand: "medium",
    difficulty: "easy",
    keywords: uniqueKeywords([`${main} price ${p.region}`, `${main} cost`, `how much is ${main}`, `${main} package`, `${main} price range`, regulated ? "" : `${main} promotion`]),
    target_page: { action: "create", page: `${titleCase(main)} prices`, slug: `/${slugify(main)}-price` },
    why: `Price searches come from people comparing options before they book. If you do not show a price or range, Google and AI assistants send them to someone who does.`,
  });
  const pairs = seeds.length > 1 ? [`${seeds[0]} vs ${seeds[1]}`, seeds[2] ? `${seeds[0]} vs ${seeds[2]}` : ""] : [];
  clusters.push({
    name: "Comparisons and reviews",
    intent: "compare",
    priority: "medium",
    relative_demand: "medium",
    difficulty: "medium",
    keywords: uniqueKeywords([...pairs, `${main} reviews`, `is ${main} worth it`, `best ${main} ${p.region}`, ...seeds.slice(1, 3).map((s) => `${s} reviews`)]),
    target_page:
      seeds.length > 1
        ? { action: "create", page: `${titleCase(seeds[0])} vs ${titleCase(seeds[1])}`, slug: `/blog/${slugify(seeds[0])}-vs-${slugify(seeds[1])}` }
        : { action: "create", page: `Is ${main} worth it?`, slug: `/blog/is-${slugify(main)}-worth-it` },
    why: `Comparison questions are what people ask ChatGPT and Google AI Overviews before choosing. A balanced comparison table is one of the formats AI answers quote most.${bestNote}`,
  });
  clusters.push({
    name: "Questions before booking",
    intent: "learn",
    priority: "medium",
    relative_demand: "medium",
    difficulty: "easy",
    keywords: uniqueKeywords(seeds.slice(0, 3).flatMap((s) => [`what is ${s}`, `how long does ${s} take`, `${s} what to expect`]).concat([`is ${main} right for me`])),
    target_page: { action: "optimise", page: "FAQ block on each service page", slug: `/${slugify(main)}#faq` },
    why: `Answering these on your service pages builds trust before the first message, and gives AI assistants a clear answer to quote with your name on it.`,
  });
  return clusters;
}

export function sampleQuestions(input: KeywordsInput, ws: WorkspaceRow): AeoQuestion[] {
  const p = place(input.location);
  const seeds = input.expand ? [coreKeyword(cleanKeyword(input.expand), p)] : input.seeds.map(cleanKeyword).filter(Boolean).slice(0, 3);
  const main = seeds[0] || cleanKeyword(ws.industry) || "this service";
  const other = input.seeds.map(cleanKeyword).find((s) => s && !related(s, main));
  const qs: AeoQuestion[] = [
    { question: `How much does ${main} cost in ${p.regionTitle}?`, answer_angle: `Give your actual price or range, what is included, and what changes the price. Start the answer with the number.`, where_to_answer: `${titleCase(main)} prices page`, format: "FAQ block" },
    { question: `Where can I get ${main} near ${p.areaTitle}?`, answer_angle: `Your address, nearest ${marketFor(ws.country).code === "SG" ? "MRT" : "station"} or landmark, opening hours and how to book, in two or three sentences.`, where_to_answer: `${titleCase(main)} service page`, format: "FAQ block" },
    { question: `How do I choose a good ${main} provider in ${p.regionTitle}?`, answer_angle: `A short checklist: qualifications, reviews, clear pricing, consultation first. Show how you meet each point without claiming to be the best.`, where_to_answer: "Blog guide, linked from the service page", format: "how-to steps" },
    { question: `Is ${main} worth it?`, answer_angle: `Who it suits, who it does not, and what result to expect, in plain words. Honest answers get quoted more.`, where_to_answer: `${titleCase(main)} service page FAQ`, format: "FAQ block" },
    { question: `What should I expect at my first ${main} appointment?`, answer_angle: `Step by step from booking to aftercare or follow-up, with how long each step takes.`, where_to_answer: `${titleCase(main)} service page`, format: "how-to steps" },
  ];
  if (other)
    qs.push({ question: `${titleCase(main)} or ${other}: which one should I pick?`, answer_angle: `A side-by-side table: what each is for, time needed, price range, who it suits. End with "book a consult if unsure".`, where_to_answer: `Blog: ${titleCase(main)} vs ${titleCase(other)}`, format: "comparison table" });
  for (const s of seeds.slice(1, 3))
    qs.push({ question: `How long does ${s} take?`, answer_angle: `State the time first, then what affects it.`, where_to_answer: `${titleCase(s)} service page`, format: "FAQ block" });
  if (ws.regulated)
    qs.push({ question: `Is ${main} safe?`, answer_angle: `Who performs it, their registration, common side effects and who should avoid it. Have a registered professional check the wording.`, where_to_answer: `${titleCase(main)} service page FAQ`, format: "FAQ block" });
  return qs;
}

/** "WhatsApp button" or the market's equivalent. */
function chatButton(country: string): string {
  const m = marketFor(country);
  return m.messaging === "SMS" ? "tap-to-call button" : `${m.messaging} button`;
}

export function sampleBriefs(input: KeywordsInput, ws: WorkspaceRow): ContentBrief[] {
  const p = place(input.location);
  const market = marketFor(ws.country);
  const seeds = input.expand ? [coreKeyword(cleanKeyword(input.expand), p)] : input.seeds.map(cleanKeyword).filter(Boolean);
  const main = seeds[0] || cleanKeyword(ws.industry) || "service";
  const M = titleCase(main);
  const reg = ws.regulated
    ? ["Have a registered professional review the page before it goes live. No 'best', no guarantees, no before-and-after photos (healthcare advertising rules)."]
    : [];
  const briefs: ContentBrief[] = [
    {
      title: `${M} in ${p.areaTitle} | ${ws.name}`,
      slug: `/${slugify(main)}`,
      h1: `${M} in ${p.areaTitle}`,
      outline: [
        `Opening answer (40 to 60 words): what ${main} is, who it suits, where you are, how to book`,
        "Price or price range and what is included",
        "How it works, step by step",
        `Why people choose ${ws.name}: qualifications, experience, real reviews`,
        "Who it suits and who it does not",
        "FAQ: 5 or 6 questions from the AI search table, marked up with FAQPage schema",
        `Location, opening hours, map and ${chatButton(ws.country)}`,
      ],
      must_include: [`"${main} ${p.area}" in the title, H1 and first paragraph`, "A visible 'Last updated' date", "Real photos of your premises and team", "LocalBusiness schema with address and opening hours", ...reg],
      internal_links: ["Homepage (link to this page using the service name)", `${M} prices page`, "Contact or booking page"],
    },
    {
      title: `${M} Price in ${p.regionTitle}: What It Costs and What Is Included`,
      slug: `/${slugify(main)}-price`,
      h1: `How much does ${main} cost in ${p.regionTitle}?`,
      outline: [
        `Answer first: your price or range in ${market.code === "INTL" ? "your currency" : market.currency}, in the first sentence`,
        "What is included and what costs extra",
        "What changes the price (sessions, area, add-ons)",
        "Packages or payment options, if you offer them",
        "FAQ: 3 or 4 price questions",
        "Book a consultation call to action",
      ],
      must_include: ["Real prices from your price list (do not estimate)", "Date the prices were last checked", ...reg],
      internal_links: [`${M} service page`, "Contact or booking page"],
    },
  ];
  const other = input.seeds.map(cleanKeyword).find((s) => s && !related(s, main));
  if (other)
    briefs.push({
      title: `${M} vs ${titleCase(other)}: Which Is Right for You?`,
      slug: `/blog/${slugify(main)}-vs-${slugify(other)}`,
      h1: `${M} or ${other}: how to choose`,
      outline: [
        "Short answer in the first paragraph: who should pick which",
        "Comparison table: what it is for, time needed, price range, who it suits",
        `When ${main} is the better choice`,
        `When ${other} is the better choice`,
        "Can you combine them?",
        "Book a consult if you are unsure",
      ],
      must_include: ["Balanced, factual comparison (AI answers favour fair comparisons)", "Author name and role, plus a 'Last updated' date", ...reg],
      internal_links: [`${M} service page`, `${titleCase(other)} service page`],
    });
  return briefs;
}

export function samplePrescriptions(input: KeywordsInput, ws: WorkspaceRow, data: ParsedData | null): Prescription[] {
  const p = place(input.location);
  const main = (input.expand && coreKeyword(cleanKeyword(input.expand), p)) || input.seeds.map(cleanKeyword).find(Boolean) || cleanKeyword(ws.industry) || "your main service";
  const out: Prescription[] = [];
  if (data?.source === "search_console" && data.rows.some(isQuickWinRow))
    out.push({
      title: "Refresh the pages that rank just off the top of Google",
      diagnosis: `${data.rows.filter(isQuickWinRow).length} of your queries sit at positions 5 to 15. They are already close; small page changes usually move them up faster than a new page would.`,
      steps: [
        "Take the quick wins list above and find which page ranks for each query (Search Console > Performance > click the query > Pages tab).",
        "Put the exact phrase in that page's title tag and H1 if it fits naturally.",
        "Add a short paragraph that answers the search directly, near the top of the page.",
        "Link to the page from your homepage and one related page, using the phrase as link text.",
        "In Search Console, use URL Inspection > Request indexing on each page you changed.",
      ],
      where: "Your website pages and Google Search Console",
      priority: "high", impact: "high", effort: "half-day", category: "On-page SEO", recheck_days: 28,
    });
  out.push(
    {
      title: `Give each main service its own page that names ${p.areaTitle}`,
      diagnosis: `Google matches one page to one search. Without a page for "${main} ${p.area}", you rely on the homepage, which cannot rank for every service at once.`,
      steps: [
        "Make one page per service from the clusters above, using the suggested URL.",
        "Use the primary keyword (first chip in each cluster) in the title tag, H1 and first paragraph.",
        `Add price or price range, how it works, reviews and a ${chatButton(ws.country)}.`,
        "Link each service page from your homepage and main menu.",
      ],
      where: "Website > Pages",
      priority: "high", impact: "high", effort: "project", category: "Content", recheck_days: 45,
    },
    {
      title: "Answer the AI search questions on your service pages",
      diagnosis: "ChatGPT, Perplexity and Google AI Overviews quote short, direct answers. If your pages do not answer these questions, they quote someone else.",
      steps: [
        "Copy the questions from the AI search table above.",
        "Under each, write a 40 to 60 word answer that starts with the answer itself (price, time, who it suits).",
        "Add them as an FAQ block on the page listed in 'Where', and turn on FAQ schema (Yoast, Rank Math and most site builders have an FAQ block that does this).",
        "Add a 'Last updated' date to the page.",
      ],
      where: "Service pages > FAQ section",
      priority: "high", impact: "medium", effort: "half-day", category: "AI Visibility", recheck_days: 30,
    },
    {
      title: "Check real search demand in Google Keyword Planner before you write",
      diagnosis: "The demand and difficulty labels here are estimates, not search volumes. Keyword Planner shows the real monthly search ranges for free.",
      steps: [
        "Go to ads.google.com > Tools > Planning > Keyword Planner > Discover new keywords (a Google Ads account is free; you do not need to run ads).",
        `Paste the primary keywords from each cluster, set the location to ${p.regionTitle}, and click Get results.`,
        "Download the results (the download icon > .csv) and paste them into Keyword Lab on your next run.",
        "Drop clusters where every keyword shows almost no searches.",
      ],
      where: "Google Ads > Tools > Keyword Planner",
      priority: "medium", impact: "medium", effort: "quick", category: "Keyword research", recheck_days: 30,
    },
    {
      title: "Add these keywords to your Google Business Profile services",
      diagnosis: `Most "near me" and "${main} ${p.area}" searches show the map results first. Your profile's services and description help decide whether you appear there.`,
      steps: [
        "Open business.google.com and select your profile.",
        "Edit profile > Services: add each service using the plain words from the local clusters above, with a one-line description.",
        "Edit the business description so it names your main services and area in the first sentence.",
        "Ask your last 10 happy customers for a review that mentions the service they had.",
      ],
      where: "Google Business Profile > Edit profile > Services",
      priority: "medium", impact: "high", effort: "quick", category: "Local SEO", recheck_days: 30,
    },
  );
  if (!data || data.source !== "search_console")
    out.push({
      title: "Connect Google Search Console and paste your queries here",
      diagnosis: "Search Console shows the searches you already appear for, your position and clicks. With it, Keyword Lab can find pages that are one push away from page one.",
      steps: [
        "Go to search.google.com/search-console and add your website (Domain property, verify through your domain provider).",
        "Wait a few days for data, then open Performance > Search results.",
        "Set the date range to the last 3 months, open the Queries tab, click Export > Download CSV (or Google Sheets).",
        "Open the Queries file, copy everything, and paste it into the data box on this form.",
      ],
      where: "Google Search Console > Performance",
      priority: data ? "low" : "medium", impact: "medium", effort: "quick", category: "Tracking", recheck_days: 14,
    });
  return out;
}

export function sampleQuickWins(input: KeywordsInput, data: ParsedData | null): string[] {
  const fromData = dataQuickWins(data);
  if (fromData.length) return fromData;
  const p = place(input.location);
  const main = (input.expand && coreKeyword(cleanKeyword(input.expand), p)) || input.seeds.map(cleanKeyword).find(Boolean) || "your main service";
  return [
    `Put "${main} ${p.area}" in the title tag and H1 of your ${main} page.`,
    "Add the questions from the AI search table to the matching service page as an FAQ block.",
    "Add your main services, using the keywords above, to the Services section of your Google Business Profile.",
    "Link to each service page from your homepage using the service name as the link text.",
  ];
}
