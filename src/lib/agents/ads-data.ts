// Ads Doctor data layer: CSV parsing, Windsor.ai fetch, and the deterministic metrics + flags.
// Pure module (no db / server-only imports) so the client form can reuse the report detector.

export type Platform = "google" | "meta";
export type Level = "campaign" | "adset" | "ad" | "keyword" | "search_term";

/** One normalised row from any export or API. Money is in the account currency. */
export type AdRow = {
  platform: Platform;
  level: Level;
  name: string;
  /** Ad group / ad set / campaign that contains this row ("" for campaigns). */
  parent: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conv_value: number;
  reach: number | null;
  frequency: number | null;
  /** False when this row has no conversion column, or (Meta) its result is not a conversion (e.g. link clicks). */
  conv_known: boolean;
  match_type?: string;
  status?: string;
  result_indicator?: string;
  excluded?: boolean;
  /** Search impression share as a fraction (0-1), Google only. */
  impr_share?: number | null;
};

export type ReportInput = { platform: "google" | "meta" | "auto"; filename: string; csv: string };

export type ParsedReport = {
  filename: string;
  platform: Platform | null;
  level: Level | null;
  currency: string | null;
  period: string | null;
  rows: AdRow[];
  skipped: number;
  warnings: string[];
  headers: string[];
};

// ---------------------------------------------------------------------------
// CSV parsing (no deps): quotes, escaped quotes, embedded commas/newlines, CRLF, BOM, tab or semicolon.
// ---------------------------------------------------------------------------

function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 15);
  // Google exports TSV with unquoted "1,234" numbers, so tabs win whenever a line has 2+ of them.
  if (lines.some((l) => (l.match(/\t/g)?.length ?? 0) >= 2)) return "\t";
  const count = (ch: string) => Math.max(0, ...lines.map((l) => l.split(ch).length - 1));
  return count(";") > count(",") ? ";" : ",";
}

export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  // True while the current field holds only spaces/tabs, so an opening quote is still allowed.
  // Tracked instead of calling field.trim() per character, which was quadratic on long fields.
  let fieldBlank = true;
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      fieldBlank = false;
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && fieldBlank) {
      field = "";
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = "";
      fieldBlank = true;
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldBlank = true;
      if (c === "\r" && text[i + 1] === "\n") i++;
      i++;
      continue;
    }
    field += c;
    if (c !== " " && c !== "\t") fieldBlank = false;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ""));
}

/** "S$1,234.50", "12.3%", "--", "< 10%", "1.234,5" -> number | null. Percent values stay as shown (12.3). */
export function parseNum(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s || /^(--|-|n\/a|na|null|none|\u2014)$/i.test(s)) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[^\d\-]/g, ""));
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever comes last is the decimal separator.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma > -1) {
    // "1,234" or "1,234,567" are thousands. "12,5" is a decimal comma.
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const norm = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");

type Cols = Record<string, number>;

const ALIASES: Record<string, (string | RegExp)[]> = {
  campaign: ["campaign", "campaign name"],
  adgroup: ["ad group", "ad group name"],
  adset: ["ad set name", "ad set"],
  ad: ["ad name"],
  search_term: ["search term", "search terms"],
  keyword: ["keyword", "search keyword", "keyword text"],
  match_type: ["match type", "search keyword match type", "search terms match type", "keyword match type"],
  added_excluded: ["added/excluded"],
  status: ["campaign status", "ad group status", "keyword status", "status", "campaign delivery", "ad set delivery", "delivery"],
  impressions: ["impr.", "impressions", "impr"],
  link_clicks: ["link clicks"],
  clicks: ["clicks", "clicks (all)", "interactions"],
  spend: ["cost", "spend", "amount spent", /^amount spent \(([a-z]{3})\)$/],
  conversions: ["conversions", "conv."],
  conv_value: [
    "conv. value",
    "conversion value",
    "total conv. value",
    /^purchases conversion value/,
    /^website purchases conversion value/,
    /^purchase conversion value/,
  ],
  results: ["results"],
  result_indicator: ["result indicator", "result type"],
  leads: ["leads", "website leads", "on-facebook leads", "meta leads"],
  purchases: ["purchases", "website purchases"],
  messaging: ["messaging conversations started"],
  reach: ["reach"],
  frequency: ["frequency"],
  currency: ["currency code", "currency"],
  impr_share: ["search impr. share", "impr. share", "search impression share"],
  starts: ["reporting starts"],
  ends: ["reporting ends"],
};

function findCols(headers: string[]): Cols {
  const n = headers.map(norm);
  const out: Cols = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      const idx = n.findIndex((h) => (typeof a === "string" ? h === a : a.test(h)));
      if (idx > -1) {
        out[key] = idx;
        break;
      }
    }
  }
  return out;
}

function headerScore(row: string[]): number {
  const c = findCols(row);
  return Object.keys(c).length;
}

function detectPlatformFromHeaders(headers: string[]): Platform | null {
  const n = headers.map(norm);
  const has = (s: string | RegExp) => n.some((h) => (typeof s === "string" ? h === s : s.test(h)));
  const meta =
    (has(/^amount spent/) ? 3 : 0) + (has("ad set name") ? 2 : 0) + (has("reporting starts") ? 2 : 0) + (has("result indicator") ? 2 : 0) + (has("link clicks") ? 1 : 0) + (has("campaign name") ? 1 : 0) + (has("frequency") ? 1 : 0);
  const google =
    (has("impr.") ? 3 : 0) + (has("cost / conv.") ? 2 : 0) + (has("avg. cpc") ? 2 : 0) + (has("search term") ? 2 : 0) + (has("ad group") ? 2 : 0) + (has("conv. rate") ? 1 : 0) + (has("cost") ? 1 : 0) + (has("search keyword") ? 2 : 0);
  if (meta === 0 && google === 0) return null;
  return meta > google ? "meta" : "google";
}

// Meta "Results" only count as conversions when the result indicator is a lead/purchase/message type.
const META_NON_CONVERSION = /link_click|landing_page_view|video_view|thruplay|post_engagement|page_engagement|post_reaction|\blike\b|reach|impressions|estimated_ad_recall|post_save|profile_visit|instagram_profile|follow/i;

export function isMetaConversionIndicator(indicator: string): boolean {
  if (!indicator) return true;
  return !META_NON_CONVERSION.test(indicator);
}

function periodFromTitleRows(rows: string[][]): string | null {
  for (const r of rows) {
    const t = r.filter(Boolean).join(" ").trim();
    if (/\b(19|20)\d{2}\b/.test(t) && t.length < 80) return t.replace(/^"|"$/g, "");
  }
  return null;
}

export function parseReport(input: ReportInput): ParsedReport {
  const filename = input.filename || "pasted report";
  const out: ParsedReport = { filename, platform: null, level: null, currency: null, period: null, rows: [], skipped: 0, warnings: [], headers: [] };
  const table = parseCsv(input.csv || "");
  if (table.length === 0) {
    out.warnings.push(`${filename}: the file is empty.`);
    return out;
  }

  // Google puts 1-2 title rows ("Campaign report", date range) above the header. Pick the most header-like row near the top.
  let headerIdx = -1;
  let best = 1;
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const s = headerScore(table[i]);
    if (s > best) {
      best = s;
      headerIdx = i;
    }
    if (s >= 5) break;
  }
  if (headerIdx < 0) {
    out.warnings.push(`${filename}: no header row found. Export as CSV with columns like Campaign, Cost, Impressions, Clicks.`);
    return out;
  }
  const headers = table[headerIdx];
  out.headers = headers;
  const cols = findCols(headers);
  const detected = detectPlatformFromHeaders(headers);
  const hint = input.platform === "auto" ? null : input.platform;
  const platform: Platform | null = detected ?? hint;
  if (hint && detected && hint !== detected) out.warnings.push(`${filename}: picked as ${label(hint)} but the columns look like ${label(detected)}, so we read it as ${label(detected)}.`);
  if (!platform) {
    out.warnings.push(`${filename}: couldn't tell if this is Google Ads or Meta Ads. Pick the platform and try again.`);
    return out;
  }
  out.platform = platform;
  out.period = periodFromTitleRows(table.slice(0, headerIdx));

  // Level and name columns.
  let level: Level;
  let nameCol: number | undefined;
  let parentCol: number | undefined;
  if (platform === "google") {
    if (cols.search_term != null) [level, nameCol, parentCol] = ["search_term", cols.search_term, cols.adgroup ?? cols.campaign];
    else if (cols.keyword != null) [level, nameCol, parentCol] = ["keyword", cols.keyword, cols.adgroup ?? cols.campaign];
    else if (cols.adgroup != null) [level, nameCol, parentCol] = ["adset", cols.adgroup, cols.campaign];
    else [level, nameCol, parentCol] = ["campaign", cols.campaign, undefined];
  } else {
    if (cols.ad != null) [level, nameCol, parentCol] = ["ad", cols.ad, cols.adset ?? cols.campaign];
    else if (cols.adset != null) [level, nameCol, parentCol] = ["adset", cols.adset, cols.campaign];
    else [level, nameCol, parentCol] = ["campaign", cols.campaign, undefined];
  }
  out.level = level;
  if (nameCol == null) {
    out.warnings.push(`${filename}: no Campaign column found, so rows can't be named.`);
    return out;
  }
  if (cols.spend == null) out.warnings.push(`${filename}: no Cost / Amount spent column. Spend-based checks will be empty.`);

  const spendHeader = cols.spend != null ? norm(headers[cols.spend]) : "";
  const curMatch = spendHeader.match(/\(([a-z]{3})\)/);
  if (curMatch) out.currency = curMatch[1].toUpperCase();

  const clickCol = platform === "meta" ? cols.link_clicks ?? cols.clicks : cols.clicks ?? cols.link_clicks;
  const hasConvColumn = platform === "google" ? cols.conversions != null : cols.results != null || cols.leads != null || cols.purchases != null || cols.messaging != null || cols.conversions != null;
  if (!hasConvColumn) out.warnings.push(`${filename}: no ${platform === "google" ? "Conversions" : "Results"} column, so cost per result can't be worked out from this file.`);

  const get = (r: string[], k: number | undefined) => (k == null ? "" : (r[k] ?? "").trim());
  const n0 = (r: string[], k: number | undefined) => parseNum(get(r, k)) ?? 0;
  let minStart = "";
  let maxEnd = "";

  for (const r of table.slice(headerIdx + 1)) {
    const name = get(r, nameCol);
    const first = (r[0] ?? "").trim();
    if (!name || /^total\b/i.test(first) || /^total\b/i.test(name) || /^(--)$/.test(name)) {
      out.skipped++;
      continue;
    }
    // A repeated header row (some exports concatenate sections).
    if (norm(name) === norm(headers[nameCol])) {
      out.skipped++;
      continue;
    }
    let conversions = 0;
    let convKnown = hasConvColumn;
    let indicator = "";
    if (platform === "google") {
      conversions = n0(r, cols.conversions);
    } else {
      indicator = get(r, cols.result_indicator);
      if (cols.results != null) {
        convKnown = isMetaConversionIndicator(indicator);
        conversions = convKnown ? n0(r, cols.results) : 0;
        if (!convKnown && (cols.leads != null || cols.purchases != null || cols.messaging != null)) {
          conversions = n0(r, cols.leads) + n0(r, cols.purchases) + n0(r, cols.messaging);
          convKnown = true;
        }
      } else if (cols.conversions != null) {
        conversions = n0(r, cols.conversions);
      } else {
        conversions = n0(r, cols.leads) + n0(r, cols.purchases) + n0(r, cols.messaging);
      }
    }
    const share = parseNum(get(r, cols.impr_share));
    const row: AdRow = {
      platform,
      level,
      name,
      parent: get(r, parentCol),
      campaign: level === "campaign" ? name : get(r, cols.campaign),
      spend: n0(r, cols.spend),
      impressions: n0(r, cols.impressions),
      clicks: n0(r, clickCol),
      conversions,
      conv_value: n0(r, cols.conv_value),
      reach: parseNum(get(r, cols.reach)),
      frequency: parseNum(get(r, cols.frequency)),
      conv_known: convKnown,
    };
    if (cols.match_type != null) row.match_type = get(r, cols.match_type);
    if (cols.status != null) row.status = get(r, cols.status);
    if (indicator) row.result_indicator = indicator;
    if (cols.added_excluded != null) row.excluded = /excluded/i.test(get(r, cols.added_excluded));
    if (share != null) row.impr_share = Math.min(1, share / 100);
    if (!out.currency && cols.currency != null) {
      const c = get(r, cols.currency);
      if (/^[A-Z]{3}$/i.test(c)) out.currency = c.toUpperCase();
    }
    const s = get(r, cols.starts);
    const e = get(r, cols.ends);
    if (s && (!minStart || s < minStart)) minStart = s;
    if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
    out.rows.push(row);
  }
  if (!out.period && minStart) out.period = maxEnd && maxEnd !== minStart ? `${minStart} to ${maxEnd}` : minStart;
  if (out.rows.length === 0) out.warnings.push(`${filename}: no data rows found under the header.`);
  return out;
}

function label(p: Platform) {
  return p === "google" ? "Google Ads" : "Meta Ads";
}

export function levelLabel(platform: Platform, level: Level): string {
  if (level === "adset") return platform === "google" ? "ad group" : "ad set";
  if (level === "search_term") return "search term";
  return level;
}

/** Quick description for the form ("Google Ads search terms report, 42 rows"). */
export function describeReport(input: ReportInput): { ok: boolean; text: string } {
  const p = parseReport(input);
  if (!p.platform || !p.level || p.rows.length === 0) return { ok: false, text: p.warnings[0] ?? "No rows found." };
  const kind = p.level === "search_term" ? "search terms" : p.level === "adset" ? (p.platform === "google" ? "ad groups" : "ad sets") : `${p.level}s`;
  return { ok: true, text: `${label(p.platform)} · ${kind} · ${p.rows.length} rows${p.period ? ` · ${p.period}` : ""}` };
}

// ---------------------------------------------------------------------------
// Windsor.ai (best effort)
// ---------------------------------------------------------------------------
// BEST EFFORT: field names below follow Windsor's documented connector fields but should be confirmed against
// the owner's account (Windsor field names vary by connector version). Kept deliberately conservative.
// Never log or echo the API key: errors are scrubbed before they leave this function.

export type SourceInfo = { source: "upload" | "windsor" | "sample"; label: string; platform: Platform | null; level: Level | null; rows: number; ok: boolean; error?: string };

const WINDSOR_FIELDS: Record<"google_ads" | "facebook", string> = {
  google_ads: "account_name,campaign,clicks,impressions,spend,conversions",
  facebook: "account_name,campaign,adset_name,ad_name,clicks,impressions,spend,reach,frequency,actions_lead,actions_purchase",
};

export async function fetchWindsor(apiKey: string, days: number): Promise<{ rows: AdRow[]; sources: SourceInfo[] }> {
  const rows: AdRow[] = [];
  const sources: SourceInfo[] = [];
  const scrub = (s: string) => (apiKey ? s.split(apiKey).join("***") : s);

  for (const connector of ["google_ads", "facebook"] as const) {
    const platform: Platform = connector === "google_ads" ? "google" : "meta";
    const info: SourceInfo = { source: "windsor", label: `Windsor.ai ${label(platform)}`, platform, level: connector === "google_ads" ? "campaign" : "ad", rows: 0, ok: false };
    try {
      const url = new URL(`https://connectors.windsor.ai/${connector}`);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("date_preset", `last_${days}d`);
      url.searchParams.set("fields", WINDSOR_FIELDS[connector]);
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } });
      if (!res.ok) {
        const body = scrub((await res.text().catch(() => "")).slice(0, 160));
        throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
      }
      const json = (await res.json()) as { data?: Record<string, unknown>[]; error?: unknown };
      if (!Array.isArray(json.data)) throw new Error(json.error ? scrub(String(json.error)).slice(0, 160) : "Unexpected response (no data array).");
      for (const d of json.data) {
        const s = (k: string) => (d[k] == null ? "" : String(d[k]).trim());
        const n = (k: string) => parseNum(d[k] as string | number | null) ?? 0;
        if (connector === "google_ads") {
          const name = s("campaign");
          if (!name) continue;
          rows.push({ platform, level: "campaign", name, parent: "", campaign: name, spend: n("spend"), impressions: n("impressions"), clicks: n("clicks"), conversions: n("conversions"), conv_value: 0, reach: null, frequency: null, conv_known: true });
        } else {
          const name = s("ad_name") || s("adset_name") || s("campaign");
          if (!name) continue;
          rows.push({
            platform,
            level: s("ad_name") ? "ad" : s("adset_name") ? "adset" : "campaign",
            name,
            parent: s("ad_name") ? s("adset_name") : s("adset_name") ? s("campaign") : "",
            campaign: s("campaign"),
            spend: n("spend"),
            impressions: n("impressions"),
            clicks: n("clicks"),
            conversions: n("actions_lead") + n("actions_purchase"),
            conv_value: 0,
            reach: parseNum(d.reach as string | number | null),
            frequency: parseNum(d.frequency as string | number | null),
            conv_known: true,
          });
        }
        info.rows++;
      }
      info.ok = true;
      if (info.rows === 0) info.error = "Connected but returned no rows for this period.";
    } catch (e) {
      const err = e as Error;
      info.error = err.name === "TimeoutError" || err.name === "AbortError" ? "Timed out after 30 seconds." : scrub(err.message || "Request failed.");
    }
    sources.push(info);
  }
  return { rows, sources };
}

// ---------------------------------------------------------------------------
// Metrics and flags
// ---------------------------------------------------------------------------

export type Metrics = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conv_value: number;
  reach: number | null;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  conv_rate: number | null;
  roas: number | null;
  frequency: number | null;
  conv_known: boolean;
};

export type Entity = Metrics & {
  platform: Platform;
  level: Level;
  name: string;
  parent: string;
  campaign: string;
  spend_share: number;
  impr_share: number | null;
  flags: FlagType[];
};

export type FlagType = "tracking" | "objective" | "zero_conv" | "high_cpa" | "low_ctr" | "high_frequency" | "concentration" | "conv_gt_clicks";

export type Flag = {
  type: FlagType;
  platform: Platform;
  level: Level | "account";
  name: string;
  parent: string;
  severity: "high" | "medium" | "low";
  spend: number;
  detail: string;
};

export type PlatformSummary = Metrics & {
  platform: Platform;
  currency: string;
  base_level: Level;
  campaigns: Entity[];
  adsets: Entity[];
  keywords: Entity[];
  campaign_count: number;
  adset_count: number;
  top_campaign_share: number | null;
  result_types: { indicator: string; rows: number; counts_as_conversion: boolean }[];
  score: number;
};

export type WastedTerm = { term: string; campaign: string; ad_group: string; match_type: string; clicks: number; impressions: number; spend: number; enough_data: boolean; is_brand: boolean };
export type ScaleCandidate = { platform: Platform; level: Level; name: string; parent: string; spend: number; conversions: number; cpa: number | null; roas: number | null; vs_account: number | null; budget_shift_pct: number; reason: string };
export type PauseCandidate = { platform: Platform; level: Level; name: string; parent: string; spend: number; conversions: number; cpa: number | null; action: "pause" | "reduce"; reduce_pct: number | null; reason: string };

export type AdsAnalysis = {
  platforms: { google?: PlatformSummary; meta?: PlatformSummary };
  flags: Flag[];
  wasted_search_terms: WastedTerm[];
  wasted_spend_total: number;
  negative_candidates: string[];
  scale_candidates: ScaleCandidate[];
  pause_candidates: PauseCandidate[];
  tracking: string[];
  score: number | null;
  total_spend: number;
};

const div = (a: number, b: number) => (b > 0 ? a / b : null);

function metrics(rows: Pick<AdRow, "spend" | "impressions" | "clicks" | "conversions" | "conv_value" | "reach" | "frequency" | "conv_known">[]): Metrics {
  let spend = 0, impressions = 0, clicks = 0, conversions = 0, conv_value = 0, reach = 0;
  let reachKnown = false, convKnown = false;
  let freqOnly: number | null = null;
  for (const r of rows) {
    spend += r.spend;
    impressions += r.impressions;
    clicks += r.clicks;
    conversions += r.conversions;
    conv_value += r.conv_value;
    if (r.reach != null) {
      reach += r.reach;
      reachKnown = true;
    }
    if (r.conv_known) convKnown = true;
    if (r.frequency != null && rows.length === 1) freqOnly = r.frequency;
  }
  // Summed reach double counts people across rows, so a rolled-up frequency is a lower bound.
  const frequency = freqOnly ?? (reachKnown && reach > 0 ? impressions / reach : null);
  return {
    spend,
    impressions,
    clicks,
    conversions,
    conv_value,
    reach: reachKnown ? reach : null,
    ctr: div(clicks, impressions),
    cpc: div(spend, clicks),
    cpa: convKnown && conversions > 0 ? spend / conversions : null,
    conv_rate: convKnown ? div(conversions, clicks) : null,
    roas: conv_value > 0 ? div(conv_value, spend) : null,
    frequency,
    conv_known: convKnown,
  };
}

function group(rows: AdRow[], key: (r: AdRow) => string, make: (r: AdRow) => Pick<Entity, "level" | "name" | "parent" | "campaign">, total: number): Entity[] {
  const m = new Map<string, AdRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return [...m.values()]
    .map((rs) => {
      const share = rs.filter((r) => r.impr_share != null);
      return {
        ...metrics(rs),
        ...make(rs[0]),
        platform: rs[0].platform,
        spend_share: total > 0 ? rs.reduce((n, r) => n + r.spend, 0) / total : 0,
        impr_share: share.length ? share.reduce((n, r) => n + (r.impr_share as number), 0) / share.length : null,
        flags: [] as FlagType[],
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

const lc = (s: string) => s.toLowerCase().trim();

/** Meta frequency above this is flagged as possible ad fatigue. A common rule of thumb, not a platform rule: adjust per account. */
export const DEFAULT_FREQUENCY_THRESHOLD = 3;

export function analyzeAds(
  rows: AdRow[],
  opts: {
    currency?: Partial<Record<Platform, string | null>>;
    /** Used when an export doesn't say its currency: the business's market currency. */
    defaultCurrency?: string;
    brandTerms?: string[];
    frequencyThreshold?: number;
  } = {},
): AdsAnalysis {
  const freqMax = opts.frequencyThreshold ?? DEFAULT_FREQUENCY_THRESHOLD;
  const flags: Flag[] = [];
  const tracking: string[] = [];
  const platforms: AdsAnalysis["platforms"] = {};
  const scale: ScaleCandidate[] = [];
  const pause: PauseCandidate[] = [];
  let wasted: WastedTerm[] = [];
  const brand = (opts.brandTerms ?? []).map(lc).filter((t) => t.length >= 3);

  for (const platform of ["google", "meta"] as const) {
    const prows = rows.filter((r) => r.platform === platform);
    if (prows.length === 0) continue;
    const has = (l: Level) => prows.some((r) => r.level === l);
    const base: Level = (["campaign", "adset", "ad", "keyword", "search_term"] as const).find(has)!;
    const baseRows = prows.filter((r) => r.level === base);
    const tot = metrics(baseRows);
    const P = platform === "google" ? "Google Ads" : "Meta Ads";

    const campaigns = has("campaign")
      ? group(prows.filter((r) => r.level === "campaign"), (r) => lc(r.name), (r) => ({ level: "campaign", name: r.name, parent: "", campaign: r.name }), tot.spend)
      : group(baseRows, (r) => lc(r.campaign || "(no campaign name)"), (r) => ({ level: "campaign", name: r.campaign || "(no campaign name)", parent: "", campaign: r.campaign }), tot.spend);
    const adsetSource = has("adset") ? prows.filter((r) => r.level === "adset") : has("ad") ? prows.filter((r) => r.level === "ad") : [];
    const adsets = has("adset")
      ? group(adsetSource, (r) => lc(`${r.parent}|${r.name}`), (r) => ({ level: "adset", name: r.name, parent: r.parent, campaign: r.campaign }), tot.spend)
      : group(adsetSource, (r) => lc(`${r.campaign}|${r.parent}`), (r) => ({ level: "adset", name: r.parent || "(no ad set name)", parent: r.campaign, campaign: r.campaign }), tot.spend);
    const keywords = group(prows.filter((r) => r.level === "keyword"), (r) => lc(`${r.parent}|${r.name}|${r.match_type ?? ""}`), (r) => ({ level: "keyword", name: r.name, parent: r.parent, campaign: r.campaign }), tot.spend);

    const flag = (e: Entity | null, type: FlagType, severity: Flag["severity"], detail: string, level?: Flag["level"]) => {
      if (e && !e.flags.includes(type)) e.flags.push(type);
      // Campaign rows still get the badge, but when ad sets / ad groups exist the flag list reports the finer level only.
      if (e && e.level === "campaign" && adsets.length > 0 && type !== "concentration") return;
      flags.push({ type, platform, level: level ?? e?.level ?? "account", name: e?.name ?? P, parent: e?.parent ?? "", severity, spend: e?.spend ?? tot.spend, detail });
    };

    // Tracking sanity.
    const metaIndicators = new Map<string, number>();
    for (const r of prows) if (r.result_indicator) metaIndicators.set(r.result_indicator, (metaIndicators.get(r.result_indicator) ?? 0) + 1);
    const nonConvSpend = baseRows.filter((r) => r.result_indicator && !isMetaConversionIndicator(r.result_indicator)).reduce((n, r) => n + r.spend, 0);
    let trackingBroken = false;
    if (tot.spend > 0 && tot.conv_known && tot.conversions === 0) {
      trackingBroken = true;
      const msg = `${P} spent money but recorded zero conversions in this period. Either conversion tracking is broken or no campaign is optimising for enquiries. Fix this before changing anything else: every other number depends on it.`;
      tracking.push(msg);
      flag(null, "tracking", "high", msg);
    } else if (tot.spend > 0 && !tot.conv_known && nonConvSpend > 0) {
      const msg = `Every ${P} campaign in this export reports results as clicks, reach or engagement, not leads or sales. Meta is optimising for cheap clicks, not customers.`;
      tracking.push(msg);
      flag(null, "objective", "high", msg);
    } else if (!tot.conv_known) {
      tracking.push(`This ${P} export has no conversions column, so we can't judge cost per enquiry. Add the Conversions${platform === "meta" ? " / Results" : ""} column and export again.`);
    }
    if (tot.conv_known && tot.clicks > 0 && tot.conversions > tot.clicks * 1.05) {
      const msg = `${P} reports more conversions than clicks. That usually means duplicate conversion actions (for example a page-view goal and a form goal both counted). Check which actions are set as Primary.`;
      tracking.push(msg);
      flag(null, "conv_gt_clicks", "medium", msg);
    }
    if (platform === "meta" && tot.conv_known && nonConvSpend > 0 && tot.spend > 0 && nonConvSpend / tot.spend >= 0.2) {
      flag(null, "objective", "medium", `${Math.round((nonConvSpend / tot.spend) * 100)}% of Meta spend goes to ad sets that optimise for clicks, reach or engagement rather than leads or sales.`);
    }

    // Entity flags. Score uses the finest structural level (ad set / ad group if present) to avoid double counting.
    const flagLevel = adsets.length ? adsets : campaigns;
    const cpa = tot.cpa;
    const ctr = tot.ctr;
    for (const e of [...campaigns, ...adsets, ...keywords]) {
      const what = levelLabel(platform, e.level);
      if (!trackingBroken && cpa && e.conv_known && e.spend > 0 && e.conversions === 0) {
        const sev: Flag["severity"] = e.spend >= cpa ? "high" : e.spend >= cpa * 0.5 ? "medium" : "low";
        flag(e, "zero_conv", sev, `This ${what} spent with no conversions. Your account average cost per conversion is the yardstick: ${sev === "high" ? "it has already spent more than that" : sev === "medium" ? "it has spent over half of that" : "it is still early, keep watching"}.`);
      }
      if (cpa && e.cpa && e.cpa > cpa * 1.5) {
        const x = e.cpa / cpa;
        flag(e, "high_cpa", x > 2.5 ? "high" : "medium", `Cost per conversion is ${x.toFixed(1)}x your account average.`);
      }
      if (ctr && e.ctr != null && e.impressions >= 1000 && e.ctr < ctr * 0.5 && e.level !== "keyword") {
        flag(e, "low_ctr", "medium", `Click-through rate is under half your account average, so the ad isn't matching what people want.`);
      }
      if (platform === "meta" && e.frequency != null && e.frequency > freqMax && e.level !== "keyword") {
        flag(e, "high_frequency", e.frequency > freqMax + 2 ? "high" : "medium", `Frequency ${e.frequency.toFixed(1)}: the same people see this about ${Math.round(e.frequency)} times. Above ${freqMax} is a common rule of thumb for ad fatigue (adjust for retargeting).`);
      }
    }
    const topShare = campaigns.length >= 2 ? campaigns[0].spend_share : null;
    if (topShare != null && topShare > 0.7 && campaigns.length >= 3) {
      const top = campaigns[0];
      const worse = cpa && top.cpa && top.cpa > cpa;
      flag(top, "concentration", worse ? "medium" : "low", `${Math.round(topShare * 100)}% of ${P} spend goes to this one campaign${worse ? ", and its cost per conversion is above your average" : ""}. One campaign failing would take most of your results with it.`);
    }

    // Scale and pause candidates (finest structural level, plus Google keywords for pause).
    if (cpa && !trackingBroken) {
      for (const e of flagLevel) {
        // Skip tired audiences: adding budget to a high-frequency ad set mostly raises frequency further.
        if (e.conversions >= 2 && e.cpa && e.spend_share >= 0.05 && !(e.frequency != null && e.frequency > freqMax)) {
          const ratio = e.cpa / cpa;
          const roasBetter = tot.roas && e.roas ? e.roas >= tot.roas * 1.25 : false;
          // Already showing for most eligible searches (typical of brand campaigns): more budget adds little.
          const saturated = e.impr_share != null && e.impr_share >= 0.85;
          if ((ratio <= 0.8 || roasBetter) && !saturated) {
            const shift = ratio <= 0.5 && e.conversions >= 5 ? 30 : 20;
            const limited = e.impr_share != null && e.impr_share < 0.6;
            scale.push({
              platform, level: e.level, name: e.name, parent: e.parent, spend: e.spend, conversions: e.conversions, cpa: e.cpa, roas: e.roas, vs_account: ratio, budget_shift_pct: shift,
              reason: `Cost per conversion is ${Math.round((1 - ratio) * 100)}% below your account average${roasBetter ? " with a better return on spend" : ""}${limited ? `, and it only shows for about ${Math.round((e.impr_share as number) * 100)}% of eligible searches` : ""}.`,
            });
          }
        }
      }
      for (const e of [...flagLevel, ...keywords]) {
        if (e.conv_known && e.conversions === 0 && e.spend >= cpa) {
          pause.push({ platform, level: e.level, name: e.name, parent: e.parent, spend: e.spend, conversions: 0, cpa: null, action: "pause", reduce_pct: null, reason: `Spent more than your average cost per conversion with nothing to show.` });
        } else if (e.conv_known && e.conversions === 0 && e.spend >= cpa * 0.5) {
          pause.push({ platform, level: e.level, name: e.name, parent: e.parent, spend: e.spend, conversions: 0, cpa: null, action: "reduce", reduce_pct: 50, reason: `Over half your average cost per conversion spent, no conversions yet.` });
        } else if (e.cpa && e.cpa > cpa * 2.5) {
          pause.push({ platform, level: e.level, name: e.name, parent: e.parent, spend: e.spend, conversions: e.conversions, cpa: e.cpa, action: "pause", reduce_pct: null, reason: `Cost per conversion is ${(e.cpa / cpa).toFixed(1)}x your average.` });
        } else if (e.cpa && e.cpa > cpa * 1.5) {
          pause.push({ platform, level: e.level, name: e.name, parent: e.parent, spend: e.spend, conversions: e.conversions, cpa: e.cpa, action: "reduce", reduce_pct: 25, reason: `Cost per conversion is ${(e.cpa / cpa).toFixed(1)}x your average.` });
        }
      }
    }

    // Search terms: spend with no conversions = negative keyword candidates.
    let wastedTermSpend = 0;
    if (platform === "google") {
      const terms = group(prows.filter((r) => r.level === "search_term" && !r.excluded), (r) => lc(r.name), (r) => ({ level: "search_term", name: r.name, parent: r.parent, campaign: r.campaign }), tot.spend);
      const src = prows.filter((r) => r.level === "search_term");
      const termCpa = cpa ?? metrics(src).cpa;
      for (const t of terms) {
        if (t.spend <= 0 || t.conversions > 0 || !t.conv_known) continue;
        const first = src.find((r) => lc(r.name) === lc(t.name));
        const enough = termCpa ? t.spend >= termCpa * 0.5 : t.clicks >= 5;
        wastedTermSpend += t.spend;
        wasted.push({ term: t.name, campaign: t.campaign, ad_group: first?.parent ?? "", match_type: first?.match_type ?? "", clicks: t.clicks, impressions: t.impressions, spend: t.spend, enough_data: enough, is_brand: brand.some((b) => lc(t.name).includes(b)) });
      }
    }

    // Platform score: 100 minus the share of spend going to flagged items.
    const s = tot.spend || 1;
    const shareOf = (types: FlagType[], weightFn?: (e: Entity) => number) =>
      flagLevel.filter((e) => e.flags.some((f) => types.includes(f))).reduce((n, e) => n + e.spend * (weightFn ? weightFn(e) : 1), 0) / s;
    const waste = shareOf(["zero_conv", "high_cpa"], (e) => (e.flags.includes("zero_conv") ? (e.spend >= (cpa ?? 0) * 0.5 ? 1 : 0.3) : 0.5));
    const lowCtr = shareOf(["low_ctr"]);
    const fatigue = shareOf(["high_frequency"]);
    const termWaste = platform === "google" && tot.spend > 0 ? Math.min(1, wastedTermSpend / tot.spend) : 0;
    const objectiveShare = tot.conv_known && tot.spend > 0 ? nonConvSpend / tot.spend : 0;
    let score = 100 - 60 * waste - 15 * lowCtr - 15 * fatigue - 25 * termWaste - 25 * objectiveShare;
    if (flags.some((f) => f.platform === platform && f.type === "concentration" && f.severity === "medium")) score -= 5;
    if (flags.some((f) => f.platform === platform && f.type === "conv_gt_clicks")) score -= 10;
    if (trackingBroken) score = Math.min(score, 20);
    else if (flags.some((f) => f.platform === platform && f.type === "objective" && f.severity === "high")) score = Math.min(score, 35);
    score = Math.max(0, Math.min(100, Math.round(score)));

    platforms[platform] = {
      ...tot,
      platform,
      currency: opts.currency?.[platform] || opts.defaultCurrency || "SGD",
      base_level: base,
      campaigns: campaigns.slice(0, 60),
      adsets: adsets.slice(0, 80),
      keywords: keywords.slice(0, 60),
      campaign_count: campaigns.length,
      adset_count: adsets.length,
      top_campaign_share: topShare,
      result_types: [...metaIndicators].map(([indicator, n]) => ({ indicator, rows: n, counts_as_conversion: isMetaConversionIndicator(indicator) })),
      score,
    };
  }

  wasted = wasted.sort((a, b) => b.spend - a.spend).slice(0, 100);
  const negatives = wasted.filter((w) => w.enough_data && !w.is_brand).slice(0, 40).map((w) => w.term);
  const all = Object.values(platforms) as PlatformSummary[];
  const total = all.reduce((n, p) => n + p.spend, 0);
  const score = all.length === 0 ? null : total > 0 ? Math.round(all.reduce((n, p) => n + p.score * p.spend, 0) / total) : Math.round(all.reduce((n, p) => n + p.score, 0) / all.length);
  const sevRank = { high: 0, medium: 1, low: 2 };

  return {
    platforms,
    flags: flags.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.spend - a.spend).slice(0, 120),
    wasted_search_terms: wasted,
    wasted_spend_total: wasted.reduce((n, w) => n + w.spend, 0),
    negative_candidates: negatives,
    scale_candidates: scale.sort((a, b) => (a.vs_account ?? 9) - (b.vs_account ?? 9)).slice(0, 8),
    pause_candidates: pause.sort((a, b) => (a.action === b.action ? b.spend - a.spend : a.action === "pause" ? -1 : 1)).slice(0, 15),
    tracking,
    score,
    total_spend: total,
  };
}

// ---------------------------------------------------------------------------
// Built-in sample data (used only when the owner provides nothing). Clearly labelled as sample in the result.
// ---------------------------------------------------------------------------

export function sampleReports(opts: { service?: string; location?: string; brand?: string; currency?: string }): ReportInput[] {
  const svc = (opts.service || "facial").toLowerCase().slice(0, 28);
  const loc = (opts.location || "singapore").toLowerCase();
  const brand = (opts.brand || "your brand").toLowerCase();
  const google = `Campaign report
"1 September 2026 - 30 September 2026"
Campaign status,Campaign,Campaign type,Impr.,Clicks,CTR,Currency code,Avg. CPC,Cost,Search impr. share,Conversions,Cost / conv.,Conv. rate
Enabled,Search - Brand,Search,"2,140",498,23.27%,SGD,0.38,189.24,88.20%,41.00,4.62,8.23%
Enabled,Search - ${cap(svc)},Search,"18,420",912,4.95%,SGD,2.40,"2,190.08",34.60%,80.00,27.38,8.77%
Enabled,Search - ${cap(svc)} Price,Search,"9,880",401,4.06%,SGD,3.12,"1,251.12",41.10%,9.00,139.01,2.24%
Enabled,Search - Competitors,Search,"6,310",122,1.93%,SGD,4.05,494.10,< 10%,0.00,0.00,0.00%
Enabled,Performance Max - All,Performance Max,"48,900",605,1.24%,SGD,1.71,"1,034.55",--,14.00,73.90,2.31%
Total: Account,--,--,"85,650","2,538",2.96%,SGD,2.03,"5,159.09",--,144.00,35.83,5.67%
`;
  const terms = `Search terms report
"1 September 2026 - 30 September 2026"
Search term,Match type,Added/Excluded,Campaign,Ad group,Clicks,Impr.,CTR,Currency code,Avg. CPC,Cost,Conversions,Cost / conv.
${svc} ${loc},Phrase match,None,Search - ${cap(svc)},Core,214,"3,980",5.38%,SGD,2.71,579.94,17.00,34.11
${svc} near me,Phrase match,None,Search - ${cap(svc)},Core,166,"2,710",6.13%,SGD,2.90,481.40,12.00,40.12
best ${svc} ${loc},Broad match,None,Search - ${cap(svc)},Core,88,"1,904",4.62%,SGD,3.10,272.80,4.00,68.20
${svc} price,Phrase match,None,Search - ${cap(svc)} Price,Price,121,"2,880",4.20%,SGD,3.05,369.05,3.00,123.02
cheap ${svc},Broad match,None,Search - ${cap(svc)} Price,Price,74,"1,610",4.60%,SGD,2.95,218.30,0.00,0.00
free ${svc},Broad match,None,Search - ${cap(svc)} Price,Price,41,"1,120",3.66%,SGD,2.40,98.40,0.00,0.00
${svc} course,Broad match,None,Search - ${cap(svc)},Core,37,980,3.78%,SGD,2.60,96.20,0.00,0.00
${svc} jobs,Broad match,None,Search - ${cap(svc)},Core,29,860,3.37%,SGD,2.20,63.80,0.00,0.00
how to do ${svc} at home,Broad match,None,Search - ${cap(svc)},Core,33,1240,2.66%,SGD,1.90,62.70,0.00,0.00
${svc} review,Broad match,None,Search - ${cap(svc)},Core,26,770,3.38%,SGD,2.85,74.10,1.00,74.10
${brand},Exact match,None,Search - Brand,Brand,301,"1,240",24.27%,SGD,0.35,105.35,29.00,3.63
${brand} reviews,Phrase match,None,Search - Brand,Brand,48,310,15.48%,SGD,0.52,24.96,0.00,0.00
Total: Search terms,--,--,--,--,"1,178","19,604",6.01%,SGD,2.07,"2,447.00",66.00,37.08
`;
  const meta = `"Reporting starts","Reporting ends","Campaign name","Ad set name","Ad set delivery","Results","Result indicator","Reach","Frequency","Cost per result","Amount spent (SGD)","Impressions","CPM (cost per 1,000 impressions) (SGD)","Link clicks","CPC (cost per link click) (SGD)","CTR (link click-through rate)"
"2026-09-01","2026-09-30","","","","","","","","","3,084.40","241,300","12.78","2,402","1.28","1.00"
"2026-09-01","2026-09-30","Leads - ${cap(svc)} Offer","Women 25-45 - Broad ${cap(loc)}","active","38","actions:onsite_conversion.lead_grouped","21,400","2.31","24.32","924.16","49,434","18.69","611","1.51","1.24"
"2026-09-01","2026-09-30","Leads - ${cap(svc)} Offer","Interests - Beauty & Wellness","active","9","actions:onsite_conversion.lead_grouped","9,850","4.12","61.57","554.13","40,582","13.65","402","1.38","0.99"
"2026-09-01","2026-09-30","Leads - ${cap(svc)} Offer","Lookalike 1% - Past customers","active","0","actions:onsite_conversion.lead_grouped","6,120","2.05","","286.40","12,546","22.83","98","2.92","0.78"
"2026-09-01","2026-09-30","WhatsApp - Consult Booking","Retargeting - Site visitors 30d","active","22","actions:onsite_conversion.messaging_conversation_started_7d","2,980","6.84","17.53","385.66","20,383","18.92","233","1.66","1.14"
"2026-09-01","2026-09-30","Traffic - Website","Broad ${cap(loc)} 18-65","active","1,058","actions:link_click","64,200","1.86","0.88","934.05","118,355","7.89","1,058","0.88","0.89"
`;
  // Sample figures are written in SGD; label them with the business's currency instead.
  const cur = /^[A-Z]{3}$/.test(opts.currency ?? "") ? opts.currency! : "SGD";
  const inCur = (csv: string) => csv.replace(/\bSGD\b/g, cur);
  return [
    { platform: "google", filename: "sample-google-campaigns.csv", csv: inCur(google) },
    { platform: "google", filename: "sample-google-search-terms.csv", csv: inCur(terms) },
    { platform: "meta", filename: "sample-meta-adsets.csv", csv: inCur(meta) },
  ];
}

function cap(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
