// Google Ads API (read-only GAQL over REST): accessible accounts and campaign, ad group, keyword and
// search term performance, mapped to the same AdRow shape the CSV parser produces.

import type { AdRow } from "../agents/ads-data";
import { ConnectorError, fetchJson, isoDay, num, numOrNull, retryDelayMs, scrub, sleep, type DiscoveredAccount, type FetchedAds } from "./http";
import { googleAdsVersion } from "./oauth";

const api = () => `https://googleads.googleapis.com/${googleAdsVersion()}`;
const MAX_RETRIES = 2;
const MAX_ACCOUNTS = 50;
/** searchStream can be large for big accounts; cap what we read. */
const MAX_BYTES = 25 * 1024 * 1024;

export type GoogleAdsAuth = { accessToken: string; developerToken: string; loginCustomerId?: string | null };

type GErr = { code?: number; message?: string; status?: string; details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[] };

function googleAdsError(body: unknown, status: number, token: string): ConnectorError {
  const raw = (Array.isArray(body) ? (body[0] as { error?: GErr })?.error : (body as { error?: GErr } | null)?.error) ?? {};
  const codes = (raw.details ?? []).flatMap((d) => d.errors ?? []).flatMap((e) => Object.values(e.errorCode ?? {}));
  const detail = (raw.details ?? []).flatMap((d) => d.errors ?? []).map((e) => e.message).find(Boolean);
  const msg = scrub(detail || raw.message || `HTTP ${status}`, [token]);
  if (codes.some((c) => /DEVELOPER_TOKEN_(NOT_APPROVED|PROHIBITED)/.test(c)))
    return new ConnectorError("Google hasn't approved live Google Ads access for this app yet. Upload your Google Ads exports for now.", "not_approved", status);
  if (status === 401 || raw.status === "UNAUTHENTICATED") return new ConnectorError("Google access has expired or was removed. Reconnect Google in Settings > Connected accounts.", "auth", status);
  if (status === 429 || raw.status === "RESOURCE_EXHAUSTED" || codes.includes("RESOURCE_EXHAUSTED"))
    return new ConnectorError("Google Ads is limiting requests right now. Try again in a few minutes.", "rate_limit", status);
  if (status === 403 || raw.status === "PERMISSION_DENIED" || codes.some((c) => /CUSTOMER_NOT_ENABLED|USER_PERMISSION_DENIED/.test(c)))
    return new ConnectorError("Google says this login can't read that Google Ads account, or the account isn't active.", "permission", status);
  return new ConnectorError(`Google Ads returned an error: ${msg}`, "api", status);
}

function headers(a: GoogleAdsAuth, loginCustomerId?: string | null): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${a.accessToken}`, "developer-token": a.developerToken, "content-type": "application/json", accept: "application/json" };
  // An explicit "" means no header; null/undefined falls back to GOOGLE_ADS_LOGIN_CUSTOMER_ID.
  const login = (loginCustomerId ?? a.loginCustomerId ?? "").replace(/\D/g, "");
  if (login) h["login-customer-id"] = login;
  return h;
}

async function call(a: GoogleAdsAuth, url: string, init: RequestInit, loginCustomerId?: string | null): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchJson(url, { ...init, headers: headers(a, loginCustomerId) }, { maxBytes: MAX_BYTES, timeoutMs: 60_000 });
    if (res.ok) return res.body;
    const err = googleAdsError(res.body, res.status, a.accessToken);
    if ((err.code === "rate_limit" || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(attempt, res.retryAfter));
      continue;
    }
    throw err;
  }
}

export async function listAccessibleCustomers(a: GoogleAdsAuth): Promise<string[]> {
  const body = (await call(a, `${api()}/customers:listAccessibleCustomers`, { method: "GET" }, "")) as { resourceNames?: string[] };
  return (body?.resourceNames ?? []).map((r) => r.replace(/^customers\//, "")).filter((id) => /^\d+$/.test(id));
}

export type GaRow = Record<string, Record<string, unknown> | undefined>;

/** Runs a GAQL query with searchStream and flattens the result batches. */
export async function searchStream(a: GoogleAdsAuth, customerId: string, query: string, loginCustomerId?: string | null): Promise<GaRow[]> {
  if (!/^\d+$/.test(customerId)) throw new ConnectorError("That Google Ads account id isn't valid.", "api");
  const body = await call(a, `${api()}/customers/${customerId}/googleAds:searchStream`, { method: "POST", body: JSON.stringify({ query }) }, loginCustomerId);
  const batches = Array.isArray(body) ? body : [body];
  const out: GaRow[] = [];
  for (const b of batches as { results?: GaRow[] }[]) if (Array.isArray(b?.results)) out.push(...b.results);
  return out;
}

const CUSTOMER_QUERY = "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.test_account FROM customer LIMIT 1";
const CLIENTS_QUERY =
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 2";

/** Accounts the login can read: direct accounts, plus client accounts under any manager account it has. */
export async function listGoogleAdsAccounts(a: GoogleAdsAuth): Promise<DiscoveredAccount[]> {
  const ids = (await listAccessibleCustomers(a)).slice(0, MAX_ACCOUNTS);
  const out = new Map<string, DiscoveredAccount>();
  for (const id of ids) {
    let row: GaRow | undefined;
    try {
      row = (await searchStream(a, id, CUSTOMER_QUERY, id))[0];
    } catch (e) {
      if (e instanceof ConnectorError && (e.code === "auth" || e.code === "not_approved")) throw e;
      continue; // cancelled or suspended accounts can't be queried
    }
    const c = row?.customer ?? {};
    if (c.manager === true) {
      const clients = await searchStream(a, id, CLIENTS_QUERY, id).catch(() => [] as GaRow[]);
      for (const r of clients) {
        const cc = r.customerClient ?? {};
        const cid = String(cc.id ?? "");
        if (!/^\d+$/.test(cid) || cc.manager === true || (cc.status && cc.status !== "ENABLED") || out.has(cid)) continue;
        out.set(cid, { id: cid, kind: "google_ads", name: String(cc.descriptiveName ?? "").trim() || `Account ${formatId(cid)}`, currency: currencyOf(cc.currencyCode), login_customer_id: id });
        if (out.size >= MAX_ACCOUNTS) break;
      }
      continue;
    }
    out.set(id, { id, kind: "google_ads", name: String(c.descriptiveName ?? "").trim() || `Account ${formatId(id)}`, currency: currencyOf(c.currencyCode), login_customer_id: id });
  }
  return [...out.values()].slice(0, MAX_ACCOUNTS);
}

const currencyOf = (v: unknown) => (typeof v === "string" && /^[A-Z]{3}$/.test(v) ? v : null);
export const formatId = (id: string) => id.replace(/^(\d{3})(\d{3})(\d+)$/, "$1-$2-$3");

// ---------- Performance queries ----------

export type GoogleReport = "campaign" | "ad_group" | "keyword" | "search_term";

/** Last N full days in UTC, ending yesterday. */
export function dateRange(days: number, today = new Date()): { start: string; end: string } {
  return { start: isoDay(today, days), end: isoDay(today, 1) };
}

export function gaqlQueries(days: number, today = new Date()): Record<GoogleReport, string> {
  const { start, end } = dateRange(days, today);
  const during = `segments.date BETWEEN '${start}' AND '${end}'`;
  const m = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value";
  return {
    campaign: `SELECT campaign.name, campaign.status, ${m}, metrics.search_impression_share FROM campaign WHERE ${during} AND campaign.status != 'REMOVED'`,
    ad_group: `SELECT campaign.name, ad_group.name, ad_group.status, ${m}, metrics.search_impression_share FROM ad_group WHERE ${during} AND ad_group.status != 'REMOVED'`,
    keyword: `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ${m}, metrics.search_impression_share FROM keyword_view WHERE ${during} AND ad_group_criterion.status != 'REMOVED'`,
    search_term: `SELECT campaign.name, ad_group.name, search_term_view.search_term, search_term_view.status, ${m} FROM search_term_view WHERE ${during} AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 2000`,
  };
}

const MATCH: Record<string, string> = { EXACT: "Exact match", PHRASE: "Phrase match", BROAD: "Broad match" };
const title = (s: unknown) => (typeof s === "string" && s ? s.charAt(0) + s.slice(1).toLowerCase() : "");

/** GAQL results (camelCase JSON) -> AdRow. Money comes back in micros; impression share as a 0-1 fraction. */
export function mapGoogleAdsRows(report: GoogleReport, results: GaRow[]): AdRow[] {
  const rows: AdRow[] = [];
  for (const r of results) {
    const metrics = r.metrics ?? {};
    const campaign = String(r.campaign?.name ?? "").trim();
    const adGroup = String(r.adGroup?.name ?? "").trim();
    const base = {
      platform: "google" as const,
      campaign,
      spend: num(metrics.costMicros) / 1_000_000,
      impressions: num(metrics.impressions),
      clicks: num(metrics.clicks),
      conversions: num(metrics.conversions),
      conv_value: num(metrics.conversionsValue),
      reach: null,
      frequency: null,
      conv_known: true,
    };
    const share = numOrNull(metrics.searchImpressionShare);
    const withShare = (row: AdRow): AdRow => (share != null && report !== "search_term" ? { ...row, impr_share: Math.min(1, Math.max(0, share)) } : row);
    if (report === "campaign") {
      if (!campaign) continue;
      rows.push(withShare({ ...base, level: "campaign", name: campaign, parent: "", status: title(r.campaign?.status) }));
    } else if (report === "ad_group") {
      if (!adGroup) continue;
      rows.push(withShare({ ...base, level: "adset", name: adGroup, parent: campaign, status: title(r.adGroup?.status) }));
    } else if (report === "keyword") {
      const kw = r.adGroupCriterion?.keyword as { text?: string; matchType?: string } | undefined;
      const text = String(kw?.text ?? "").trim();
      if (!text) continue;
      rows.push(withShare({ ...base, level: "keyword", name: text, parent: adGroup || campaign, match_type: MATCH[String(kw?.matchType)] ?? title(kw?.matchType), status: title(r.adGroupCriterion?.status) }));
    } else {
      const term = String(r.searchTermView?.searchTerm ?? "").trim();
      if (!term) continue;
      rows.push({ ...base, level: "search_term", name: term, parent: adGroup || campaign, excluded: /EXCLUDED/.test(String(r.searchTermView?.status ?? "")) });
    }
  }
  return rows;
}

/** Pulls one account. Campaigns are required; ad groups, keywords and search terms are best effort. */
export async function fetchGoogleAdsRows(a: GoogleAdsAuth, customerId: string, days: number, loginCustomerId?: string | null, today = new Date()): Promise<FetchedAds> {
  const q = gaqlQueries(days, today);
  const rows: AdRow[] = [];
  const warnings: string[] = [];
  for (const report of ["campaign", "ad_group", "keyword", "search_term"] as const) {
    try {
      rows.push(...mapGoogleAdsRows(report, await searchStream(a, customerId, q[report], loginCustomerId)));
    } catch (e) {
      if (report === "campaign" || (e instanceof ConnectorError && (e.code === "auth" || e.code === "not_approved"))) throw e;
      warnings.push(`Google Ads ${report === "ad_group" ? "ad group" : report.replace("_", " ")} numbers couldn't be read this time.`);
    }
  }
  return { rows, warnings };
}
