// Meta Marketing API (read-only): ad accounts and insights at campaign, ad set and ad level,
// mapped to the same AdRow shape the CSV parser produces.

import type { AdRow } from "../agents/ads-data";
import { ConnectorError, fetchJson, num, numOrNull, retryDelayMs, scrub, sleep, type DiscoveredAccount, type FetchedAds } from "./http";
import { graphVersion, metaAppSecretProof } from "./oauth";

const base = () => `https://graph.facebook.com/${graphVersion()}`;
const MAX_PAGES = 20;
const PAGE_SIZE = 500;
const MAX_RETRIES = 2;

// Throttling codes from Meta's rate limiting docs (app, user, ad account and Ads Insights limits).
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004, 80005, 80006, 80008, 80009, 80014]);

type GraphError = { message?: string; code?: number; error_subcode?: number; is_transient?: boolean; type?: string };

function metaError(e: GraphError, status: number, token: string): ConnectorError {
  const code = e.code ?? 0;
  const msg = scrub(e.message ?? "Unknown error", [token]);
  if (code === 190 || code === 102) return new ConnectorError("Meta access has expired or was removed. Reconnect Meta in Settings > Connected accounts.", "auth", status);
  if (RATE_LIMIT_CODES.has(code)) return new ConnectorError("Meta is limiting requests for this ad account right now. Try again in a few minutes.", "rate_limit", status);
  if (code === 10 || code === 200 || code === 294 || (code >= 200 && code < 300))
    return new ConnectorError("Meta says this login can't read that ad account. Check you have access to it in Meta Business Settings, then reconnect.", "permission", status);
  if (code === 1 && /reduce the amount of data/i.test(msg)) return new ConnectorError("Meta couldn't return that much data at once.", "too_much_data", status);
  return new ConnectorError(`Meta returned an error: ${msg}`, "api", status);
}

/**
 * GET against the Graph API with the token in a header and appsecret_proof in the query.
 * Retries throttling and transient errors with backoff.
 */
export async function graphGet(token: string, pathOrUrl: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const u = new URL(pathOrUrl.startsWith("https://") ? pathOrUrl : `${base()}${pathOrUrl}`);
  if (u.hostname !== "graph.facebook.com") throw new ConnectorError("Unexpected paging link from Meta.", "api");
  u.searchParams.delete("access_token"); // paging links carry the token; send it in the header instead
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("appsecret_proof", metaAppSecretProof(token));
  for (let attempt = 0; ; attempt++) {
    const res = await fetchJson(u, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
    const body = (res.body ?? {}) as { error?: GraphError };
    if (res.ok && !body.error) return body as Record<string, unknown>;
    const err = metaError(body.error ?? { message: `HTTP ${res.status}` }, res.status, token);
    const transient = err.code === "rate_limit" || body.error?.is_transient === true || res.status >= 500;
    if (transient && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(attempt, res.retryAfter));
      continue;
    }
    throw err;
  }
}

/** Follows paging.next up to MAX_PAGES pages. */
export async function graphPaged(token: string, path: string, params: Record<string, string>): Promise<{ data: Record<string, unknown>[]; truncated: boolean }> {
  const data: Record<string, unknown>[] = [];
  let next: string | null = path;
  let first = true;
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = await graphGet(token, next, first ? params : {});
    first = false;
    if (Array.isArray(body.data)) data.push(...(body.data as Record<string, unknown>[]));
    const paging = body.paging as { next?: string } | undefined;
    next = typeof paging?.next === "string" ? paging.next : null;
  }
  return { data, truncated: Boolean(next) };
}

const STATUS: Record<number, string> = { 1: "active", 2: "disabled", 3: "unsettled", 7: "in review", 8: "pending settlement", 9: "grace period", 100: "pending closure", 101: "closed" };

export function mapMetaAdAccounts(data: Record<string, unknown>[]): DiscoveredAccount[] {
  const out: DiscoveredAccount[] = [];
  const seen = new Set<string>();
  for (const a of data) {
    const id = String(a.account_id ?? String(a.id ?? "").replace(/^act_/, "")).trim();
    if (!/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const status = STATUS[num(a.account_status)];
    const name = String(a.name ?? "").trim() || `Ad account ${id}`;
    out.push({
      id,
      kind: "meta_ads",
      name: (status && status !== "active" ? `${name} (${status})` : name).slice(0, 200),
      currency: typeof a.currency === "string" && /^[A-Z]{3}$/.test(a.currency) ? a.currency : null,
    });
  }
  return out;
}

export async function listMetaAdAccounts(token: string, opts: { businesses?: boolean } = {}): Promise<DiscoveredAccount[]> {
  const fields = "name,account_id,currency,account_status";
  const all = (await graphPaged(token, "/me/adaccounts", { fields, limit: "100" })).data;
  if (opts.businesses) {
    // Business-owned accounts the person can see through Business Manager (needs business_management).
    try {
      const biz = (await graphPaged(token, "/me/businesses", { fields: "id,name", limit: "50" })).data.slice(0, 20);
      for (const b of biz) {
        const id = String(b.id ?? "");
        if (!/^\d+$/.test(id)) continue;
        for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
          all.push(...(await graphPaged(token, `/${id}/${edge}`, { fields, limit: "100" }).catch(() => ({ data: [] }))).data);
        }
      }
    } catch {
      /* personal ad accounts are still listed */
    }
  }
  return mapMetaAdAccounts(all);
}

// ---------- Conversions ----------

type ActionList = { action_type?: string; value?: string | number }[] | undefined;

function pickAction(list: ActionList, types: string[]): number | null {
  if (!Array.isArray(list)) return null;
  for (const t of types) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return num(hit.value);
  }
  return null;
}

/**
 * Leads, purchases and messaging conversations, the same three result types the CSV path counts as
 * conversions. Meta reports overlapping action types (for example "lead" already includes pixel and
 * instant-form leads), so each group takes the broadest type present instead of adding them up.
 */
export function metaConversions(actions: ActionList, values: ActionList): { conversions: number; conv_value: number; types: string[] } {
  const types: string[] = [];
  let leads = pickAction(actions, ["lead"]);
  if (leads == null) {
    const form = pickAction(actions, ["onsite_conversion.lead_grouped", "leadgen_grouped"]);
    const site = pickAction(actions, ["offsite_conversion.fb_pixel_lead", "onsite_web_lead"]);
    if (form != null || site != null) leads = (form ?? 0) + (site ?? 0);
  }
  const purchases = pickAction(actions, ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"]);
  const messaging = pickAction(actions, ["onsite_conversion.messaging_conversation_started_7d"]);
  if (leads) types.push("lead");
  if (purchases) types.push("purchase");
  if (messaging) types.push("messaging_conversation_started");
  const value = pickAction(values, ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"]) ?? 0;
  return { conversions: (leads ?? 0) + (purchases ?? 0) + (messaging ?? 0), conv_value: value, types };
}

export type MetaLevel = "campaign" | "adset" | "ad";

/** Insights rows -> AdRow. Rows with no name at their level are skipped. */
export function mapMetaInsights(level: MetaLevel, data: Record<string, unknown>[]): AdRow[] {
  const rows: AdRow[] = [];
  for (const d of data) {
    const s = (k: string) => (d[k] == null ? "" : String(d[k]).trim());
    const campaign = s("campaign_name");
    const adset = s("adset_name");
    const ad = s("ad_name");
    const name = level === "ad" ? ad : level === "adset" ? adset : campaign;
    if (!name) continue;
    const conv = metaConversions(d.actions as ActionList, d.action_values as ActionList);
    const linkClicks = numOrNull(d.inline_link_clicks);
    rows.push({
      platform: "meta",
      level,
      name,
      parent: level === "ad" ? adset : level === "adset" ? campaign : "",
      campaign,
      spend: num(d.spend),
      impressions: num(d.impressions),
      // Same as the CSV path: link clicks when Meta has them, else all clicks.
      clicks: linkClicks ?? num(d.clicks),
      conversions: conv.conversions,
      conv_value: conv.conv_value,
      reach: numOrNull(d.reach),
      frequency: numOrNull(d.frequency),
      conv_known: true,
    });
  }
  return rows;
}

const PRESETS: Record<number, string> = { 7: "last_7d", 14: "last_14d", 30: "last_30d", 90: "last_90d" };
const INSIGHT_FIELDS = "campaign_name,adset_name,ad_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions,action_values";

/** Pulls one ad account at campaign, ad set and ad level. Ad-level failures are warnings, not errors. */
export async function fetchMetaRows(token: string, accountId: string, days: number): Promise<FetchedAds> {
  if (!/^\d+$/.test(accountId)) throw new ConnectorError("That Meta ad account id isn't valid.", "api");
  const preset = PRESETS[days] ?? "last_30d";
  const rows: AdRow[] = [];
  const warnings: string[] = [];
  for (const level of ["campaign", "adset", "ad"] as const) {
    try {
      const { data, truncated } = await graphPaged(token, `/act_${accountId}/insights`, { level, date_preset: preset, fields: INSIGHT_FIELDS, limit: String(PAGE_SIZE) });
      rows.push(...mapMetaInsights(level, data));
      if (truncated) warnings.push(`Meta had more ${level === "adset" ? "ad set" : level} rows than we read; the biggest ones may be missing.`);
    } catch (e) {
      if (level === "ad" && e instanceof ConnectorError && e.code !== "auth") {
        warnings.push("Meta ad-level numbers couldn't be read this time, so this report uses campaigns and ad sets.");
        continue;
      }
      throw e;
    }
  }
  return { rows, warnings };
}
