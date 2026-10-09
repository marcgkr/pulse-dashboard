// OAuth for connected accounts: provider settings from env, PKCE, the sealed state cookie, and the
// code exchange / refresh / revoke calls. No database access here. Never log tokens or codes.

import crypto from "node:crypto";
import { decrypt, encrypt, encryptionReady } from "../crypto";
import { ConnectorError, fetchJson, scrub } from "./http";

export type Provider = "google" | "meta";
export const PROVIDERS: Provider[] = ["google", "meta"];

export function isProvider(x: unknown): x is Provider {
  return x === "google" || x === "meta";
}

/** Meta Graph API version. v23.0 shipped in May 2025; Meta supports each version for about two years. */
export function graphVersion(): string {
  const v = process.env.META_GRAPH_VERSION?.trim();
  return v && /^v\d+\.\d+$/.test(v) ? v : "v23.0";
}

/** Google Ads API version. Google retires each version about a year after release: keep GOOGLE_ADS_API_VERSION current. */
export function googleAdsVersion(): string {
  const v = process.env.GOOGLE_ADS_API_VERSION?.trim();
  return v && /^v\d+$/.test(v) ? v : "v22";
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function redirectUri(p: Provider): string {
  return `${appUrl()}/api/connect/${p}/callback`;
}

const env = (k: string) => process.env[k]?.trim() || "";

/** Google Ads needs a developer token on top of the OAuth client; without it Google connects for Search Console only. */
export function googleAdsEnabled(): boolean {
  return Boolean(env("GOOGLE_ADS_DEVELOPER_TOKEN"));
}

/** Whether a provider can be connected, and which env vars are missing (shown to admins only, never to owners). */
export function providerSetup(p: Provider): { ready: boolean; missing: string[] } {
  const need = p === "google" ? ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"] : ["META_APP_ID", "META_APP_SECRET"];
  const missing = need.filter((k) => !env(k));
  if (!encryptionReady()) missing.push("ENCRYPTION_KEY");
  return { ready: missing.length === 0, missing };
}

export const GOOGLE_SCOPE_ADS = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

export function googleScopes(): string[] {
  return ["openid", "email", GOOGLE_SCOPE_GSC, ...(googleAdsEnabled() ? [GOOGLE_SCOPE_ADS] : [])];
}

/** ads_read covers ad accounts the person has a role on. META_BUSINESS_ACCOUNTS=1 also asks for business_management to list business-owned accounts. */
export function metaScopes(): string[] {
  return ["ads_read", ...(env("META_BUSINESS_ACCOUNTS") === "1" ? ["business_management"] : [])];
}

// ---------- PKCE + state ----------

export function pkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/** RFC 7636 verifier (43 chars of base64url) and its S256 challenge. */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}

export const STATE_TTL_SECONDS = 600;
export const stateCookieName = (p: Provider) => `prx_oauth_${p}`;

export type OAuthState = {
  /** Provider */
  p: Provider;
  /** Random state echoed back by the provider */
  s: string;
  /** PKCE verifier */
  v: string;
  /** Workspace and user that started the flow */
  w: string;
  u: string;
  /** Expiry, ms since epoch */
  exp: number;
};

export function newOAuthState(p: Provider, workspaceId: string, userId: string, now = Date.now()): { state: OAuthState; challenge: string } {
  const { verifier, challenge } = createPkce();
  return { state: { p, s: crypto.randomBytes(24).toString("base64url"), v: verifier, w: workspaceId, u: userId, exp: now + STATE_TTL_SECONDS * 1000 }, challenge };
}

/** Encrypts and authenticates the state for the cookie (AES-GCM, so it is both secret and tamper-proof). */
export function sealState(st: OAuthState): string {
  return encrypt(JSON.stringify(st), `oauth-state:${st.p}`);
}

/** Opens the cookie and checks provider, expiry and the state echoed back in the query. Null when anything is off. */
export function openState(sealed: string | undefined, p: Provider, queryState: string | null, now = Date.now()): OAuthState | null {
  if (!sealed || !queryState) return null;
  let st: OAuthState;
  try {
    st = JSON.parse(decrypt(sealed, `oauth-state:${p}`)) as OAuthState;
  } catch {
    return null;
  }
  if (st.p !== p || typeof st.exp !== "number" || st.exp < now || typeof st.s !== "string" || typeof st.v !== "string") return null;
  const a = Buffer.from(st.s);
  const b = Buffer.from(queryState);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return st;
}

export function authorizeUrl(p: Provider, state: string, challenge: string): string {
  if (p === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", env("GOOGLE_OAUTH_CLIENT_ID"));
    u.searchParams.set("redirect_uri", redirectUri(p));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", googleScopes().join(" "));
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    return u.toString();
  }
  const u = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  u.searchParams.set("client_id", env("META_APP_ID"));
  u.searchParams.set("redirect_uri", redirectUri(p));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", metaScopes().join(","));
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

// ---------- Token calls ----------

export type TokenSet = {
  access_token: string;
  refresh_token: string | null;
  /** Seconds from now, when the provider says. */
  expires_in: number | null;
  scopes: string[];
  external_user: string;
};

type ErrBody = { error?: string | { message?: string; code?: number; type?: string }; error_description?: string };

function oauthError(body: unknown, secrets: string[]): string {
  const b = (body ?? {}) as ErrBody;
  if (typeof b.error === "string") return scrub(`${b.error}${b.error_description ? `: ${b.error_description}` : ""}`, secrets);
  return scrub(b.error?.message ?? "unknown error", secrets);
}

/** Reads the email from a Google id_token received straight from Google's token endpoint over TLS. */
function emailFromIdToken(idToken: unknown): string {
  if (typeof idToken !== "string") return "";
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string };
    return typeof payload.email === "string" ? payload.email.slice(0, 200) : "";
  } catch {
    return "";
  }
}

export function metaAppSecretProof(token: string): string {
  return crypto.createHmac("sha256", env("META_APP_SECRET")).update(token).digest("hex");
}

export async function exchangeCode(p: Provider, code: string, verifier: string): Promise<TokenSet> {
  if (p === "google") {
    const secret = env("GOOGLE_OAUTH_CLIENT_SECRET");
    const res = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: secret,
        redirect_uri: redirectUri(p),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!res.ok) throw new ConnectorError(`Google sign-in failed (${oauthError(res.body, [code, secret])}).`, "auth", res.status);
    const b = res.body as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string };
    if (!b.access_token) throw new ConnectorError("Google sign-in returned no access token.", "auth");
    return {
      access_token: b.access_token,
      refresh_token: b.refresh_token ?? null,
      expires_in: typeof b.expires_in === "number" ? b.expires_in : null,
      scopes: String(b.scope ?? "").split(/\s+/).filter(Boolean),
      external_user: emailFromIdToken(b.id_token),
    };
  }

  // Meta: short-lived user token, then swap it for a long-lived one (about 60 days).
  const secret = env("META_APP_SECRET");
  const base = `https://graph.facebook.com/${graphVersion()}`;
  // Meta documents these two calls as GET with query parameters (server to server, over TLS).
  const short = await fetchJson(`${base}/oauth/access_token?${new URLSearchParams({ client_id: env("META_APP_ID"), client_secret: secret, redirect_uri: redirectUri(p), code, code_verifier: verifier })}`);
  if (!short.ok) throw new ConnectorError(`Facebook sign-in failed (${oauthError(short.body, [code, secret])}).`, "auth", short.status);
  const shortToken = (short.body as { access_token?: string }).access_token;
  if (!shortToken) throw new ConnectorError("Facebook sign-in returned no access token.", "auth");
  const long = await fetchJson(`${base}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: env("META_APP_ID"), client_secret: secret, fb_exchange_token: shortToken })}`);
  if (!long.ok) throw new ConnectorError(`Facebook sign-in failed (${oauthError(long.body, [shortToken, secret])}).`, "auth", long.status);
  const lb = long.body as { access_token?: string; expires_in?: number };
  const token = lb.access_token ?? shortToken;

  // Who connected, and which permissions they actually granted (people can untick some).
  const proof = metaAppSecretProof(token);
  const [me, perms] = await Promise.all([
    fetchJson(`${base}/me?fields=id,name&appsecret_proof=${proof}`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
    fetchJson(`${base}/me/permissions?appsecret_proof=${proof}`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
  ]);
  const name = me?.ok ? String((me.body as { name?: string }).name ?? "").slice(0, 200) : "";
  const granted = perms?.ok
    ? ((perms.body as { data?: { permission: string; status: string }[] }).data ?? []).filter((x) => x.status === "granted").map((x) => x.permission)
    : metaScopes();
  return { access_token: token, refresh_token: null, expires_in: typeof lb.expires_in === "number" ? lb.expires_in : null, scopes: granted, external_user: name };
}

/** Swaps a Google refresh token for a new access token. Throws ConnectorError("auth") when the grant is gone. */
export async function refreshGoogle(refreshToken: string): Promise<{ access_token: string; expires_in: number | null }> {
  const secret = env("GOOGLE_OAUTH_CLIENT_SECRET");
  const res = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: secret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) {
    const b = (res.body ?? {}) as ErrBody;
    const gone = b.error === "invalid_grant" || res.status === 400 || res.status === 401;
    throw new ConnectorError(
      gone ? "Google access has expired or was removed. Reconnect Google in Settings > Connected accounts." : `Google sign-in refresh failed (${oauthError(res.body, [refreshToken, secret])}).`,
      gone ? "auth" : "api",
      res.status,
    );
  }
  const b = res.body as { access_token?: string; expires_in?: number };
  if (!b.access_token) throw new ConnectorError("Google returned no access token.", "auth");
  return { access_token: b.access_token, expires_in: typeof b.expires_in === "number" ? b.expires_in : null };
}

/** Best effort: tells the provider to forget our access. Never throws. */
export async function revokeToken(p: Provider, token: string): Promise<void> {
  try {
    if (p === "google") {
      await fetchJson("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      }, { timeoutMs: 10_000 });
    } else {
      await fetchJson(`https://graph.facebook.com/${graphVersion()}/me/permissions?appsecret_proof=${metaAppSecretProof(token)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }, { timeoutMs: 10_000 });
    }
  } catch {
    /* the local copy is deleted either way */
  }
}
