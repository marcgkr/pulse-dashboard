// Connected accounts in the database. Every query is scoped to a workspace id, tokens are encrypted
// with ENCRYPTION_KEY (bound to the workspace and provider), and nothing returned by clientConnections()
// contains a token. Server only.

import { db, id, now, type ConnectionAccountRow, type ConnectionRow } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ConnectorError, type DiscoveredAccount } from "./http";
import {
  providerSetup,
  refreshGoogle,
  refreshTikTok,
  googleAdsEnabled,
  gbpEnabled,
  GOOGLE_SCOPE_ADS,
  GOOGLE_SCOPE_GSC,
  GOOGLE_SCOPE_YOUTUBE,
  GOOGLE_SCOPE_GBP,
  PROVIDERS,
  type Provider,
  type TokenSet,
} from "./oauth";

export type AccountKind = ConnectionAccountRow["kind"];

const aad = (wsId: string, p: Provider, which: "access" | "refresh") => `${wsId}:${p}:${which}`;

export function getConnection(wsId: string, p: Provider): ConnectionRow | null {
  return (db().prepare("SELECT * FROM connections WHERE workspace_id = ? AND provider = ?").get(wsId, p) as ConnectionRow | undefined) ?? null;
}

/** Stores (or replaces) a provider's tokens for a workspace. Encrypts first, so a missing key stores nothing. */
export function saveConnection(wsId: string, p: Provider, t: TokenSet): ConnectionRow {
  const existing = getConnection(wsId, p);
  const accessEnc = encrypt(t.access_token, aad(wsId, p, "access"));
  // Google only sends a refresh token on consent; keep the old one if this exchange didn't include one.
  const refreshEnc = t.refresh_token ? encrypt(t.refresh_token, aad(wsId, p, "refresh")) : (existing?.refresh_token_enc ?? null);
  const expires = t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null;
  const ts = now();
  if (existing) {
    db()
      .prepare("UPDATE connections SET external_user = ?, scopes = ?, access_token_enc = ?, refresh_token_enc = ?, expires_at = ?, last_error = NULL, updated_at = ? WHERE id = ? AND workspace_id = ?")
      .run(t.external_user, t.scopes.join(" "), accessEnc, refreshEnc, expires, ts, existing.id, wsId);
  } else {
    db()
      .prepare(
        `INSERT INTO connections (id, workspace_id, provider, external_user, scopes, access_token_enc, refresh_token_enc, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id("c_"), wsId, p, t.external_user, t.scopes.join(" "), accessEnc, refreshEnc, expires, ts, ts);
  }
  return getConnection(wsId, p)!;
}

export function deleteConnection(wsId: string, p: Provider): ConnectionRow | null {
  const c = getConnection(wsId, p);
  if (c) db().prepare("DELETE FROM connections WHERE id = ? AND workspace_id = ?").run(c.id, wsId);
  return c;
}

/** Decrypted tokens, for revoking on disconnect. */
export function connectionTokens(c: ConnectionRow): { access: string | null; refresh: string | null } {
  const open = (v: string | null, which: "access" | "refresh") => {
    if (!v) return null;
    try {
      return decrypt(v, aad(c.workspace_id, c.provider, which));
    } catch {
      return null;
    }
  };
  return { access: open(c.access_token_enc, "access"), refresh: open(c.refresh_token_enc, "refresh") };
}

/** A usable access token, refreshing Google's when it is about to expire. */
export async function accessToken(c: ConnectionRow): Promise<string> {
  const t = connectionTokens(c);
  const fresh = c.expires_at ? new Date(c.expires_at).getTime() - Date.now() > 120_000 : true;
  if (c.provider === "meta") {
    if (!t.access || !fresh) throw new ConnectorError("Meta access has expired. Reconnect Meta in Settings > Connected accounts.", "auth");
    return t.access;
  }
  if (t.access && fresh) return t.access;
  if (c.provider === "tiktok") {
    if (!t.refresh) throw new ConnectorError("TikTok access has expired. Reconnect TikTok in Settings > Connected accounts.", "auth");
    const r = await refreshTikTok(t.refresh);
    // TikTok may rotate the refresh token; keep the newest one.
    db()
      .prepare("UPDATE connections SET access_token_enc = ?, refresh_token_enc = ?, expires_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
      .run(
        encrypt(r.access_token, aad(c.workspace_id, "tiktok", "access")),
        r.refresh_token ? encrypt(r.refresh_token, aad(c.workspace_id, "tiktok", "refresh")) : c.refresh_token_enc,
        r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null,
        now(),
        c.id,
        c.workspace_id,
      );
    return r.access_token;
  }
  if (!t.refresh) throw new ConnectorError("Google access has expired. Reconnect Google in Settings > Connected accounts.", "auth");
  const r = await refreshGoogle(t.refresh);
  db()
    .prepare("UPDATE connections SET access_token_enc = ?, expires_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
    .run(encrypt(r.access_token, aad(c.workspace_id, "google", "access")), r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null, now(), c.id, c.workspace_id);
  return r.access_token;
}

export function markSync(wsId: string, p: Provider, error: string | null) {
  if (error) db().prepare("UPDATE connections SET last_error = ? WHERE workspace_id = ? AND provider = ?").run(error.slice(0, 300), wsId, p);
  else db().prepare("UPDATE connections SET last_sync_at = ?, last_error = NULL WHERE workspace_id = ? AND provider = ?").run(now(), wsId, p);
}

// ---------- Accounts ----------

/**
 * Replaces the account list after a (re)connect, keeping earlier choices. When nothing was chosen before,
 * picks the only account of a kind, and the Search Console property that matches the business website.
 */
export function replaceAccounts(wsId: string, connectionId: string, found: DiscoveredAccount[], website = "") {
  const conn = db().prepare("SELECT id FROM connections WHERE id = ? AND workspace_id = ?").get(connectionId, wsId);
  if (!conn) throw new Error("Connection not found.");
  const before = db().prepare("SELECT kind, provider_account_id, selected FROM connection_accounts WHERE connection_id = ?").all(connectionId) as Pick<ConnectionAccountRow, "kind" | "provider_account_id" | "selected">[];
  const prev = new Map(before.map((r) => [`${r.kind}|${r.provider_account_id}`, r.selected]));
  const hadChoice = new Set(before.filter((r) => r.selected).map((r) => r.kind));
  const host = hostOf(website);
  const sites = found.filter((x) => x.kind === "search_console");
  const siteMatch = host ? sites.filter((x) => hostOf(x.id) === host).sort((x, y) => Number(y.id.startsWith("sc-domain:")) - Number(x.id.startsWith("sc-domain:"))) : [];
  const autoSite = siteMatch[0]?.id ?? (sites.length === 1 ? sites[0].id : null);
  const pick = (a: DiscoveredAccount): number => {
    const was = prev.get(`${a.kind}|${a.id}`);
    if (hadChoice.has(a.kind)) return was ?? 0;
    if (a.kind === "search_console") return a.id === autoSite ? 1 : 0;
    return found.filter((x) => x.kind === a.kind).length === 1 ? 1 : 0;
  };
  const tx = db().transaction(() => {
    db().prepare("DELETE FROM connection_accounts WHERE connection_id = ?").run(connectionId);
    const ins = db().prepare(
      "INSERT OR IGNORE INTO connection_accounts (connection_id, provider_account_id, kind, name, currency, selected, login_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const a of found) ins.run(connectionId, a.id, a.kind, a.name.slice(0, 200), a.currency, pick(a), a.login_customer_id ?? null);
  });
  tx();
}

function hostOf(u: string): string {
  const s = String(u ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("sc-domain:")) return s.slice(10).replace(/^www\./, "");
  try {
    return new URL(/^https?:\/\//.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Kinds where a business uses one account at most: its website's property, and this outlet's Business Profile location. */
export const SINGLE_KINDS: AccountKind[] = ["search_console", "gbp_location"];

/** Sets which accounts of one kind are used. Search Console and Business Profile take one at most. Returns how many are selected. */
export function setSelected(wsId: string, p: Provider, kind: AccountKind, ids: string[]): number {
  const c = getConnection(wsId, p);
  if (!c) throw new ConnectorError("That account isn't connected.", "config");
  const want = new Set(SINGLE_KINDS.includes(kind) ? ids.slice(0, 1) : ids);
  const rows = db().prepare("SELECT provider_account_id FROM connection_accounts WHERE connection_id = ? AND kind = ?").all(c.id, kind) as { provider_account_id: string }[];
  const upd = db().prepare("UPDATE connection_accounts SET selected = ? WHERE connection_id = ? AND kind = ? AND provider_account_id = ?");
  let n = 0;
  db().transaction(() => {
    for (const r of rows) {
      const on = want.has(r.provider_account_id) ? 1 : 0;
      n += on;
      upd.run(on, c.id, kind, r.provider_account_id);
    }
  })();
  return n;
}

export type SelectedAccount = ConnectionAccountRow & { provider: Provider };

export function selectedAccounts(wsId: string, kind: AccountKind): SelectedAccount[] {
  return db()
    .prepare(
      `SELECT a.*, c.provider FROM connection_accounts a JOIN connections c ON c.id = a.connection_id
       WHERE c.workspace_id = ? AND a.kind = ? AND a.selected = 1 ORDER BY a.name`,
    )
    .all(wsId, kind) as SelectedAccount[];
}

// ---------- What the browser may see ----------

export type ClientAccount = { id: string; kind: AccountKind; name: string; currency: string | null; selected: boolean };

export type ClientConnection = {
  provider: Provider;
  /** Env is configured for this provider. */
  ready: boolean;
  /** Google only: Google Ads is switched on (developer token present). */
  adsReady: boolean;
  /** Google only: Business Profile access is switched on (GOOGLE_BUSINESS_PROFILE=1). */
  gbpReady: boolean;
  connected: boolean;
  /** Connected, but the token is gone or expired: reconnect. */
  needsReconnect: boolean;
  externalUser: string;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Kinds the person granted (Google lets people untick scopes). */
  granted: AccountKind[];
  accounts: ClientAccount[];
};

/** The account kinds a provider's login can give us. */
export const PROVIDER_KINDS: Record<Provider, AccountKind[]> = {
  google: ["google_ads", "search_console", "youtube_channel", "gbp_location"],
  meta: ["meta_ads", "facebook_page", "instagram_account"],
  tiktok: ["tiktok_account"],
};

/** Which kinds the person actually granted (people can untick permissions on Google and Meta). */
export function grantedKinds(p: Provider, scopeList: string | null | undefined): AccountKind[] {
  const scopes = new Set((scopeList ?? "").split(/[\s,]+/).filter(Boolean));
  const out: AccountKind[] = [];
  if (p === "google") {
    if (scopes.has(GOOGLE_SCOPE_ADS)) out.push("google_ads");
    if (scopes.has(GOOGLE_SCOPE_GSC)) out.push("search_console");
    if (scopes.has(GOOGLE_SCOPE_YOUTUBE)) out.push("youtube_channel");
    if (scopes.has(GOOGLE_SCOPE_GBP)) out.push("gbp_location");
  } else if (p === "meta") {
    if (scopes.has("ads_read")) out.push("meta_ads");
    if (scopes.has("pages_show_list") && scopes.has("pages_read_engagement")) out.push("facebook_page");
    if (scopes.has("instagram_basic")) out.push("instagram_account");
  } else if (scopes.has("video.list")) {
    out.push("tiktok_account");
  }
  return out;
}

/** Connection status for the settings page and forms. Never includes tokens. */
export function clientConnections(wsId: string): ClientConnection[] {
  return PROVIDERS.map((p) => {
    const c = getConnection(wsId, p);
    const accounts = c
      ? (db().prepare("SELECT * FROM connection_accounts WHERE connection_id = ? ORDER BY kind, name").all(c.id) as ConnectionAccountRow[]).map((a) => ({
          id: a.provider_account_id,
          kind: a.kind,
          name: a.name,
          currency: a.currency,
          selected: !!a.selected,
        }))
      : [];
    const granted = c ? grantedKinds(p, c.scopes) : [];
    const expired = c?.provider === "meta" && c.expires_at ? new Date(c.expires_at).getTime() < Date.now() : false;
    const noRefresh = (c?.provider === "google" || c?.provider === "tiktok") && !c.refresh_token_enc;
    return {
      provider: p,
      ready: providerSetup(p).ready,
      adsReady: p === "google" ? googleAdsEnabled() : true,
      gbpReady: p === "google" && gbpEnabled(),
      connected: !!c,
      needsReconnect: !!c && (expired || noRefresh || /reconnect/i.test(c.last_error ?? "")),
      externalUser: c?.external_user ?? "",
      lastSyncAt: c?.last_sync_at ?? null,
      lastError: c?.last_error ?? null,
      granted,
      accounts,
    };
  });
}
