// Google Search Console API (read-only): verified sites and the last 90 days of queries, mapped to
// the same DataRow shape Keyword Lab's pasted-data parser produces.

import { cleanKeyword, type DataRow } from "../agents/keywords-demo";
import { ConnectorError, fetchJson, isoDay, num, numOrNull, retryDelayMs, scrub, sleep, type DiscoveredAccount } from "./http";

const API = "https://www.googleapis.com/webmasters/v3";
const MAX_RETRIES = 2;
const ROW_LIMIT = 1000;

function gscError(body: unknown, status: number, token: string): ConnectorError {
  const e = ((body as { error?: { message?: string; status?: string } } | null)?.error ?? {}) as { message?: string; status?: string };
  if (status === 401) return new ConnectorError("Google access has expired or was removed. Reconnect Google in Settings > Connected accounts.", "auth", status);
  if (status === 429 || e.status === "RESOURCE_EXHAUSTED") return new ConnectorError("Search Console is limiting requests right now. Try again in a few minutes.", "rate_limit", status);
  if (status === 403) return new ConnectorError("Google says this login can't read that Search Console property.", "permission", status);
  return new ConnectorError(`Search Console returned an error: ${scrub(e.message ?? `HTTP ${status}`, [token])}`, "api", status);
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchJson(url, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" } });
    if (res.ok) return res.body;
    const err = gscError(res.body, res.status, token);
    if ((err.code === "rate_limit" || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(attempt, res.retryAfter));
      continue;
    }
    throw err;
  }
}

export function mapSites(body: unknown): DiscoveredAccount[] {
  const entries = ((body as { siteEntry?: { siteUrl?: string; permissionLevel?: string }[] } | null)?.siteEntry ?? []).filter(
    (s) => typeof s.siteUrl === "string" && s.permissionLevel !== "siteUnverifiedUser",
  );
  return entries.slice(0, 200).map((s) => ({
    id: s.siteUrl!,
    kind: "search_console" as const,
    name: s.siteUrl!.startsWith("sc-domain:") ? `${s.siteUrl!.slice(10)} (whole domain)` : s.siteUrl!,
    currency: null,
  }));
}

export async function listSearchConsoleSites(token: string): Promise<DiscoveredAccount[]> {
  return mapSites(await call(token, `${API}/sites`));
}

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

/**
 * searchAnalytics rows -> DataRow (ctr as a percent, position to one decimal, like the parser).
 * pageRows (dimensions query + page) adds the page that gets the most clicks for each query.
 */
export function mapSearchAnalytics(queryRows: GscRow[], pageRows: GscRow[] = []): DataRow[] {
  const topPage = new Map<string, { page: string; clicks: number; impressions: number }>();
  for (const r of pageRows) {
    const q = cleanKeyword(r.keys?.[0] ?? "");
    const page = String(r.keys?.[1] ?? "");
    if (!q || !page) continue;
    const cur = topPage.get(q);
    const c = num(r.clicks);
    const i = num(r.impressions);
    if (!cur || c > cur.clicks || (c === cur.clicks && i > cur.impressions)) topPage.set(q, { page, clicks: c, impressions: i });
  }
  const out: DataRow[] = [];
  const seen = new Set<string>();
  for (const r of queryRows) {
    const query = cleanKeyword(r.keys?.[0] ?? "");
    if (!query || seen.has(query)) continue;
    seen.add(query);
    const ctr = numOrNull(r.ctr);
    const position = numOrNull(r.position);
    const row: DataRow = {
      query,
      clicks: numOrNull(r.clicks),
      impressions: numOrNull(r.impressions),
      ctr: ctr == null ? null : Math.round(ctr * 10000) / 100,
      position: position == null ? null : Math.round(position * 10) / 10,
      searches: null,
      searches_label: null,
      competition: null,
    };
    const page = topPage.get(query)?.page;
    if (page) row.page = page;
    out.push(row);
  }
  return out;
}

/** Search Console data lags by about two days, so the window ends three days ago. */
export function gscRange(days: number, today = new Date()): { startDate: string; endDate: string } {
  return { startDate: isoDay(today, days + 2), endDate: isoDay(today, 3) };
}

export async function fetchSearchConsoleRows(token: string, siteUrl: string, days = 90, today = new Date()): Promise<DataRow[]> {
  if (!siteUrl || siteUrl.length > 500) throw new ConnectorError("That Search Console property isn't valid.", "api");
  const url = `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const range = gscRange(days, today);
  const query = (await call(token, url, { method: "POST", body: JSON.stringify({ ...range, dimensions: ["query"], rowLimit: ROW_LIMIT, type: "web" }) })) as { rows?: GscRow[] };
  // The page breakdown only adds detail; a failure here doesn't stop the report.
  const pages = (await call(token, url, { method: "POST", body: JSON.stringify({ ...range, dimensions: ["query", "page"], rowLimit: ROW_LIMIT, type: "web" }) }).catch(() => null)) as {
    rows?: GscRow[];
  } | null;
  return mapSearchAnalytics(query?.rows ?? [], pages?.rows ?? []);
}
