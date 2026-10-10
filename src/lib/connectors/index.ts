// Connected accounts, put together for the specialists: account discovery after sign-in, live ad rows
// for Ads Doctor and Search Console rows for Keyword Lab. Server only. Logs never include tokens.

import type { AdRow, Platform, SourceInfo } from "../agents/ads-data";
import { toParsedData, type ParsedData } from "../agents/keywords-demo";
import { LIVE_SYNC_PLANS, type PlanId } from "../config";
import type { WorkspaceRow } from "../db";
import { fetchGoogleAdsRows, listGoogleAdsAccounts, type GoogleAdsAuth } from "./google-ads";
import { ConnectorError, type DiscoveredAccount } from "./http";
import { fetchMetaRows, listMetaAdAccounts } from "./meta";
import { googleAdsEnabled, GOOGLE_SCOPE_ADS, GOOGLE_SCOPE_GSC, GOOGLE_SCOPE_YOUTUBE, metaScopes, type Provider } from "./oauth";
import { listMetaSocialAccounts, listTikTokAccount, listYouTubeChannels } from "./social";
import { fetchWindsor } from "./legacy-sync";
import { fetchSearchConsoleRows, listSearchConsoleSites } from "./search-console";
import { accessToken, getConnection, markSync, selectedAccounts, type SelectedAccount } from "./store";
import type { ConnectedSources } from "@/components/forms/types";

const MAX_ACCOUNTS_PER_RUN = 5;

function friendly(e: unknown): string {
  if (e instanceof ConnectorError) return e.message;
  return "Couldn't read this account right now.";
}

function logFailure(what: string, e: unknown) {
  // ConnectorError messages are already scrubbed of tokens; anything else is reduced to its name.
  const detail = e instanceof ConnectorError ? `${e.code} ${e.status}: ${e.message}` : (e as Error)?.name ?? "error";
  console.warn(`[connectors] ${what} failed: ${detail}`);
}

function googleAdsAuth(token: string): GoogleAdsAuth {
  return { accessToken: token, developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || "", loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || null };
}

/** Lists the accounts a fresh login can read. Each kind is best effort so one failure doesn't block the others. */
export async function discoverAccounts(p: Provider, token: string, scopes: string[]): Promise<{ accounts: DiscoveredAccount[]; failed: string[] }> {
  const accounts: DiscoveredAccount[] = [];
  const failed: string[] = [];
  const attempt = async (label: string, fn: () => Promise<DiscoveredAccount[]>) => {
    try {
      accounts.push(...(await fn()));
    } catch (e) {
      logFailure(`listing ${label}`, e);
      failed.push(label);
    }
  };
  if (p === "google") {
    if (googleAdsEnabled() && scopes.includes(GOOGLE_SCOPE_ADS)) await attempt("Google Ads accounts", () => listGoogleAdsAccounts(googleAdsAuth(token)));
    if (scopes.includes(GOOGLE_SCOPE_GSC)) await attempt("Search Console properties", () => listSearchConsoleSites(token));
    if (scopes.includes(GOOGLE_SCOPE_YOUTUBE)) await attempt("YouTube channels", () => listYouTubeChannels(token));
  } else if (p === "tiktok") {
    await attempt("TikTok account", () => listTikTokAccount(token));
  } else {
    if (scopes.includes("ads_read")) await attempt("Meta ad accounts", () => listMetaAdAccounts(token, { businesses: metaScopes().includes("business_management") }));
    if (scopes.includes("pages_show_list")) await attempt("Facebook Pages and Instagram accounts", () => listMetaSocialAccounts(token));
  }
  return { accounts, failed };
}

/**
 * Older workspaces stored a key for the previous sync supplier. It is only used when the platform still
 * has WINDSOR_API_KEY set and the workspace has no native ad connection. Never named to customers.
 */
export function legacyAdsSyncKey(ws: WorkspaceRow): string | null {
  return process.env.WINDSOR_API_KEY?.trim() && ws.windsor_api_key ? ws.windsor_api_key : null;
}

/** What the forms need to know. Plain data, no tokens. */
export function connectedSources(ws: WorkspaceRow): ConnectedSources {
  const ads = [...selectedAccounts(ws.id, "google_ads"), ...selectedAccounts(ws.id, "meta_ads")];
  const site = selectedAccounts(ws.id, "search_console")[0];
  return {
    ads: ads.length > 0 || legacyAdsSyncKey(ws) !== null,
    adsAccounts: ads.map((a) => `${a.kind === "google_ads" ? "Google Ads" : "Meta"}: ${a.name}`),
    searchConsole: site ? site.name : null,
    livePlan: LIVE_SYNC_PLANS.includes(ws.plan as PlanId),
  };
}

export type LiveAds = { rows: AdRow[]; sources: SourceInfo[]; currency: Partial<Record<Platform, string | null>>; warnings: string[] };

/** Pulls the selected Google Ads and Meta ad accounts. One account or provider failing doesn't stop the others. */
export async function fetchLiveAds(ws: WorkspaceRow, days: number, progress: (m: string) => void = () => {}): Promise<LiveAds> {
  const out: LiveAds = { rows: [], sources: [], currency: {}, warnings: [] };
  const google = selectedAccounts(ws.id, "google_ads").slice(0, MAX_ACCOUNTS_PER_RUN);
  const meta = selectedAccounts(ws.id, "meta_ads").slice(0, MAX_ACCOUNTS_PER_RUN);

  if (google.length === 0 && meta.length === 0) {
    const legacy = legacyAdsSyncKey(ws);
    if (!legacy) throw new Error("Connect your Google Ads or Meta ad account in Settings > Connected accounts first, or upload your exports instead.");
    progress(`Pulling the last ${days} days from your ad accounts`);
    const w = await fetchWindsor(legacy, days);
    return { ...out, rows: w.rows, sources: w.sources };
  }

  const run = async (p: Provider, platform: Platform, accounts: SelectedAccount[], pull: (token: string, a: SelectedAccount) => Promise<{ rows: AdRow[]; warnings: string[] }>) => {
    if (accounts.length === 0) return;
    const label = platform === "google" ? "Google Ads" : "Meta Ads";
    const conn = getConnection(ws.id, p);
    let token: string | null = null;
    let tokenError: string | null = null;
    try {
      if (!conn) throw new ConnectorError(`${label} isn't connected any more. Reconnect it in Settings > Connected accounts.`, "auth");
      token = await accessToken(conn);
    } catch (e) {
      logFailure(`${p} token`, e);
      tokenError = friendly(e);
    }
    let anyOk = false;
    let lastError: string | null = tokenError;
    for (const a of accounts) {
      const info: SourceInfo = { source: "live", label: `${label}: ${a.name}`, platform, level: platform === "google" ? "campaign" : "ad", rows: 0, ok: false };
      if (!token) {
        info.error = tokenError ?? "Not connected.";
      } else {
        progress(`Reading ${label} account ${a.name}`);
        try {
          const r = await pull(token, a);
          out.rows.push(...r.rows);
          out.warnings.push(...r.warnings.map((w) => `${a.name}: ${w}`));
          info.rows = r.rows.length;
          info.ok = true;
          anyOk = true;
          if (r.rows.length === 0) info.error = "Connected, but there was no activity in this period.";
          if (a.currency && !out.currency[platform]) out.currency[platform] = a.currency;
          else if (a.currency && out.currency[platform] !== a.currency) out.warnings.push(`Your ${label} accounts use different currencies; totals mix ${out.currency[platform]} and ${a.currency}.`);
        } catch (e) {
          logFailure(`${p} account fetch`, e);
          info.error = friendly(e);
          lastError = info.error;
        }
      }
      if (!info.ok || info.rows === 0) out.warnings.push(`${info.label}: ${info.error ?? "no rows"}`);
      out.sources.push(info);
    }
    markSync(ws.id, p, anyOk ? null : lastError);
  };

  await run("google", "google", google, (token, a) => fetchGoogleAdsRows(googleAdsAuth(token), a.provider_account_id, days, a.login_customer_id));
  await run("meta", "meta", meta, (token, a) => fetchMetaRows(token, a.provider_account_id, days));
  return out;
}

/** Last 90 days of the selected Search Console property, as Keyword Lab's parsed data. Null when nothing is selected. */
export async function fetchLiveSearchConsole(ws: WorkspaceRow, days = 90): Promise<{ site: string; data: ParsedData | null; error: string | null } | null> {
  const site = selectedAccounts(ws.id, "search_console")[0];
  if (!site) return null;
  try {
    const conn = getConnection(ws.id, "google");
    if (!conn) throw new ConnectorError("Google isn't connected any more.", "auth");
    const rows = await fetchSearchConsoleRows(await accessToken(conn), site.provider_account_id, days);
    markSync(ws.id, "google", null);
    return { site: site.name, data: toParsedData(rows), error: null };
  } catch (e) {
    logFailure("search console fetch", e);
    const msg = friendly(e);
    markSync(ws.id, "google", msg);
    return { site: site.name, data: null, error: msg };
  }
}
