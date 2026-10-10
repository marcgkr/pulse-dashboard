/**
 * Connected accounts (Google Ads, Meta Ads, Search Console): crypto, OAuth state + PKCE, the
 * fetch -> normalise mapping against recorded API responses (tests/fixtures/connectors), the token store,
 * and the Ads Doctor / Keyword Lab demo paths reading live data. No network: fetch is stubbed.
 *
 *   npm run test:connectors
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DB_FILE = process.env.DATABASE_PATH || path.join(ROOT, "data", "connectors-test.db");
for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) fs.rmSync(f, { force: true });

Object.assign(process.env, {
  DATABASE_PATH: DB_FILE,
  ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
  APP_URL: "https://app.example.test",
  GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-google-secret-value",
  GOOGLE_ADS_DEVELOPER_TOKEN: "test-dev-token-value",
  META_APP_ID: "100200300400",
  META_APP_SECRET: "test-meta-app-secret-value",
  CONNECTOR_RETRY_BASE_MS: "1",
});
delete process.env.ANTHROPIC_API_KEY;
delete process.env.WINDSOR_API_KEY;
delete process.env.META_GRAPH_VERSION;
delete process.env.META_LOGIN_CONFIG_ID;
delete process.env.META_BUSINESS_ACCOUNTS;
delete process.env.GOOGLE_ADS_API_VERSION;
delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
for (const k of ["META_ORGANIC", "GOOGLE_YOUTUBE", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "ELEVENLABS_API_KEY", "ELEVENLABS_API_BASE", "ELEVENLABS_STT_MODEL"]) delete process.env[k];

// ---------- fetch stub ----------

type Call = { url: URL; method: string; headers: Record<string, string>; body: string };
const calls: Call[] = [];
type Route = (c: Call) => Response | null | undefined;
let routes: Route[] = [];

const fx = (name: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/connectors", name), "utf8"));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((v, k) => (headers[k] = v));
  const call: Call = { url, method: (init.method ?? "GET").toUpperCase(), headers, body: init.body == null ? "" : String(init.body) };
  calls.push(call);
  for (const r of routes) {
    const res = r(call);
    if (res) return res;
  }
  return json({ error: { message: `no stub for ${call.method} ${url.pathname}` } }, 404);
}) as typeof fetch;

function reset(...r: Route[]) {
  calls.length = 0;
  routes = r;
}

// ---------- tiny runner ----------

const tests: { name: string; fn: () => unknown }[] = [];
const test = (name: string, fn: () => unknown) => tests.push({ name, fn });

async function main() {
  const { encrypt, decrypt, encryptionReady, EncryptionKeyError } = await import("../src/lib/crypto");
  const oauth = await import("../src/lib/connectors/oauth");
  const meta = await import("../src/lib/connectors/meta");
  const gads = await import("../src/lib/connectors/google-ads");
  const gsc = await import("../src/lib/connectors/search-console");
  const store = await import("../src/lib/connectors/store");
  const live = await import("../src/lib/connectors");
  const { analyzeAds } = await import("../src/lib/agents/ads-data");
  const { toParsedData, visibilityScore, dataQuickWins } = await import("../src/lib/agents/keywords-demo");
  const { db, id, now } = await import("../src/lib/db");
  const { adsAgent } = await import("../src/lib/agents/ads");
  const social = await import("../src/lib/connectors/social");
  const sync = await import("../src/lib/social-sync");
  const { latestVideos } = await import("../src/lib/videos");
  const { ownPostsBlock } = await import("../src/lib/agents/content");
  const { allowedMediaUrl } = await import("../src/lib/transcribe");
  const { keywordsAgent } = await import("../src/lib/agents/keywords");
  const { startRun, RunError } = await import("../src/lib/runs");
  type WorkspaceRow = import("../src/lib/db").WorkspaceRow;

  // ---------- crypto ----------

  test("crypto: AES-256-GCM round trip, random IV, aad binding, tamper detection", () => {
    const secret = "ya29.a0-secret-access-token";
    const a = encrypt(secret, "w1:google:access");
    const b = encrypt(secret, "w1:google:access");
    assert.notEqual(a, b, "same plaintext should encrypt differently");
    assert.ok(!a.includes(secret));
    assert.equal(decrypt(a, "w1:google:access"), secret);
    assert.throws(() => decrypt(a, "w2:google:access"), "wrong aad must fail");
    const parts = a.split(".");
    const ct = Buffer.from(parts[3], "base64url");
    ct[0] ^= 1;
    assert.throws(() => decrypt([parts[0], parts[1], parts[2], ct.toString("base64url")].join("."), "w1:google:access"), "tampered ciphertext must fail");
  });

  test("crypto: refuses to work without a valid 32-byte key", () => {
    const keep = process.env.ENCRYPTION_KEY;
    try {
      delete process.env.ENCRYPTION_KEY;
      assert.equal(encryptionReady(), false);
      assert.throws(() => encrypt("x"), (e: unknown) => e instanceof EncryptionKeyError && /ENCRYPTION_KEY/.test((e as Error).message));
      process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
      assert.equal(encryptionReady(), false, "16-byte key accepted");
      assert.equal(oauth.providerSetup("google").ready, false);
      assert.ok(oauth.providerSetup("google").missing.includes("ENCRYPTION_KEY"));
    } finally {
      process.env.ENCRYPTION_KEY = keep;
    }
    assert.equal(encryptionReady(), true);
  });

  // ---------- OAuth helpers ----------

  test("PKCE: 43-char base64url verifier, S256 challenge", () => {
    const { verifier, challenge } = oauth.createPkce();
    assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(challenge, crypto.createHash("sha256").update(verifier).digest("base64url"));
    assert.notEqual(oauth.createPkce().verifier, verifier);
  });

  test("state cookie: sealed, single provider, expires, must match the query state", () => {
    const t0 = 1_800_000_000_000;
    const { state } = oauth.newOAuthState("google", "w_1", "u_1", t0);
    const sealed = oauth.sealState(state);
    assert.ok(!sealed.includes(state.v) && !sealed.includes(state.s), "cookie leaks the verifier or state");
    assert.deepEqual(oauth.openState(sealed, "google", state.s, t0 + 1000), state);
    assert.equal(oauth.openState(sealed, "google", state.s + "x", t0), null, "wrong state accepted");
    assert.equal(oauth.openState(sealed, "google", null, t0), null);
    assert.equal(oauth.openState(sealed, "meta", state.s, t0), null, "other provider accepted");
    assert.equal(oauth.openState(sealed, "google", state.s, t0 + oauth.STATE_TTL_SECONDS * 1000 + 1), null, "expired state accepted");
    assert.equal(oauth.openState(sealed.slice(0, -2) + "AA", "google", state.s, t0), null, "tampered cookie accepted");
    assert.equal(oauth.openState(undefined, "google", state.s, t0), null);
  });

  test("authorize URLs: offline + consent + PKCE for Google, ads_read for Meta, exact redirect URIs", () => {
    const g = new URL(oauth.authorizeUrl("google", "st", "ch"));
    assert.equal(g.origin + g.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(g.searchParams.get("redirect_uri"), "https://app.example.test/api/connect/google/callback");
    assert.equal(g.searchParams.get("access_type"), "offline");
    assert.equal(g.searchParams.get("prompt"), "consent");
    assert.equal(g.searchParams.get("code_challenge_method"), "S256");
    assert.equal(g.searchParams.get("code_challenge"), "ch");
    assert.equal(g.searchParams.get("state"), "st");
    const scopes = g.searchParams.get("scope")!.split(" ");
    assert.ok(scopes.includes("https://www.googleapis.com/auth/adwords") && scopes.includes("https://www.googleapis.com/auth/webmasters.readonly"));
    const m = new URL(oauth.authorizeUrl("meta", "st", "ch"));
    assert.equal(m.origin + m.pathname, "https://www.facebook.com/v23.0/dialog/oauth");
    assert.equal(m.searchParams.get("scope"), "ads_read,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights");
    assert.equal(m.searchParams.get("redirect_uri"), "https://app.example.test/api/connect/meta/callback");
    assert.ok(scopes.includes(oauth.GOOGLE_SCOPE_YOUTUBE), "YouTube asked for by default");
    process.env.META_ORGANIC = "0";
    process.env.GOOGLE_YOUTUBE = "0";
    try {
      assert.equal(new URL(oauth.authorizeUrl("meta", "st", "ch")).searchParams.get("scope"), "ads_read");
      assert.ok(!new URL(oauth.authorizeUrl("google", "st", "ch")).searchParams.get("scope")!.includes("youtube"));
    } finally {
      delete process.env.META_ORGANIC;
      delete process.env.GOOGLE_YOUTUBE;
    }
  });

  test("TikTok: authorize URL, setup check, code exchange and granted kinds", async () => {
    assert.deepEqual(oauth.providerSetup("tiktok").missing, ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]);
    process.env.TIKTOK_CLIENT_KEY = "awtestclientkey";
    process.env.TIKTOK_CLIENT_SECRET = "test-tiktok-secret-value";
    assert.equal(oauth.providerSetup("tiktok").ready, true);
    const t = new URL(oauth.authorizeUrl("tiktok", "st", "ch"));
    assert.equal(t.origin + t.pathname, "https://www.tiktok.com/v2/auth/authorize/");
    assert.equal(t.searchParams.get("client_key"), "awtestclientkey");
    assert.equal(t.searchParams.get("scope"), "user.info.basic,video.list");
    assert.equal(t.searchParams.get("redirect_uri"), "https://app.example.test/api/connect/tiktok/callback");
    assert.equal(t.searchParams.get("code_challenge"), null, "TikTok's web flow takes no PKCE");
    reset((c) =>
      c.url.href === "https://open.tiktokapis.com/v2/oauth/token/"
        ? json({ access_token: "act.tiktokaccess000000", refresh_token: "rft.tiktokrefresh00000", expires_in: 86400, open_id: "open-1", scope: "user.info.basic,video.list", token_type: "Bearer" })
        : null,
    );
    const tok = await oauth.exchangeCode("tiktok", "code-123", "unused");
    assert.equal(tok.access_token, "act.tiktokaccess000000");
    assert.deepEqual(tok.scopes, ["user.info.basic", "video.list"]);
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("client_key"), "awtestclientkey");
    // TikTok sends some failures as HTTP 200 with an error field.
    reset((c) => (c.url.hostname === "open.tiktokapis.com" ? json({ error: "invalid_grant", error_description: "Authorization code is expired." }) : null));
    await assert.rejects(oauth.exchangeCode("tiktok", "code-123", "unused"), /TikTok/);
    assert.deepEqual(store.grantedKinds("tiktok", "user.info.basic,video.list"), ["tiktok_account"]);
    assert.deepEqual(store.grantedKinds("meta", "ads_read pages_show_list pages_read_engagement instagram_basic"), ["meta_ads", "facebook_page", "instagram_account"]);
    assert.deepEqual(store.grantedKinds("meta", "ads_read"), ["meta_ads"]);
    assert.deepEqual(store.grantedKinds("google", `${oauth.GOOGLE_SCOPE_GSC} ${oauth.GOOGLE_SCOPE_YOUTUBE}`), ["search_console", "youtube_channel"]);
  });

  test("Google without a developer token asks for Search Console only", () => {
    const keep = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    try {
      const scopes = new URL(oauth.authorizeUrl("google", "s", "c")).searchParams.get("scope")!;
      assert.ok(!scopes.includes("adwords") && scopes.includes("webmasters.readonly"));
      assert.equal(oauth.providerSetup("google").ready, true, "Search Console alone still works");
    } finally {
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = keep;
    }
  });

  test("provider setup lists missing env vars", () => {
    const keep = process.env.META_APP_SECRET;
    delete process.env.META_APP_SECRET;
    try {
      assert.deepEqual(oauth.providerSetup("meta"), { ready: false, missing: ["META_APP_SECRET"] });
    } finally {
      process.env.META_APP_SECRET = keep;
    }
  });

  test("Google code exchange sends the PKCE verifier and reads the email", async () => {
    reset((c) => (c.url.href === "https://oauth2.googleapis.com/token" ? json({ ...fx("google-token-refresh.json"), refresh_token: "1//0recorded-refresh-token" }) : null));
    const t = await oauth.exchangeCode("google", "4/0code", "verifier-123");
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get("code_verifier"), "verifier-123");
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("redirect_uri"), "https://app.example.test/api/connect/google/callback");
    assert.equal(t.refresh_token, "1//0recorded-refresh-token");
    assert.equal(t.external_user, "owner@glowaesthetics.sg");
    assert.ok(t.scopes.includes(oauth.GOOGLE_SCOPE_GSC) && t.scopes.includes(oauth.GOOGLE_SCOPE_ADS));
  });

  test("Meta code exchange swaps for a long-lived token and records granted permissions", async () => {
    reset(
      (c) => (c.url.pathname === "/v23.0/oauth/access_token" && c.url.searchParams.get("code") ? json({ access_token: "EAAshortlivedtoken000000000000", token_type: "bearer", expires_in: 5183 }) : null),
      (c) => (c.url.pathname === "/v23.0/oauth/access_token" && c.url.searchParams.get("grant_type") === "fb_exchange_token" ? json({ access_token: "EAAlonglivedtoken0000000000000", token_type: "bearer", expires_in: 5183944 }) : null),
      (c) => (c.url.pathname === "/v23.0/me" ? json({ id: "10229", name: "Mei Tan" }) : null),
      (c) => (c.url.pathname === "/v23.0/me/permissions" ? json({ data: [{ permission: "ads_read", status: "granted" }, { permission: "public_profile", status: "granted" }] }) : null),
    );
    const t = await oauth.exchangeCode("meta", "AQcode", "verifier-xyz");
    assert.equal(t.access_token, "EAAlonglivedtoken0000000000000");
    assert.equal(t.external_user, "Mei Tan");
    assert.ok(t.scopes.includes("ads_read"));
    assert.equal(calls[0].url.searchParams.get("code_verifier"), "verifier-xyz");
    const me = calls.find((c) => c.url.pathname === "/v23.0/me")!;
    assert.equal(me.headers.authorization, "Bearer EAAlonglivedtoken0000000000000");
    assert.ok(!me.url.search.includes("EAA"), "token sent in the URL");
    assert.equal(me.url.searchParams.get("appsecret_proof"), crypto.createHmac("sha256", "test-meta-app-secret-value").update("EAAlonglivedtoken0000000000000").digest("hex"));
  });

  // ---------- Meta mapping ----------

  test("Meta: ad accounts", () => {
    const a = meta.mapMetaAdAccounts(fx("meta-adaccounts.json").data);
    assert.deepEqual(a[0], { id: "1234567890", kind: "meta_ads", name: "Glow Aesthetics", currency: "SGD" });
    assert.equal(a[1].name, "Glow Aesthetics (old) (closed)");
  });

  test("Meta: conversions count leads, purchases and messages once each", () => {
    // "lead" already includes form and pixel leads, so they aren't added again.
    assert.equal(meta.metaConversions([{ action_type: "lead", value: "47" }, { action_type: "onsite_conversion.lead_grouped", value: "31" }, { action_type: "offsite_conversion.fb_pixel_lead", value: "16" }], []).conversions, 47);
    assert.equal(meta.metaConversions([{ action_type: "onsite_conversion.lead_grouped", value: "7" }, { action_type: "offsite_conversion.fb_pixel_lead", value: "2" }], []).conversions, 9);
    const shop = meta.metaConversions([{ action_type: "purchase", value: "14" }, { action_type: "omni_purchase", value: "14" }, { action_type: "offsite_conversion.fb_pixel_purchase", value: "14" }], [{ action_type: "omni_purchase", value: "2387.40" }]);
    assert.deepEqual([shop.conversions, shop.conv_value], [14, 2387.4]);
    assert.equal(meta.metaConversions([{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "22" }, { action_type: "onsite_conversion.messaging_first_reply", value: "19" }], []).conversions, 22);
    assert.equal(meta.metaConversions([{ action_type: "link_click", value: "1058" }, { action_type: "landing_page_view", value: "611" }], undefined).conversions, 0);
  });

  test("Meta: insights rows map to AdRow like the CSV path", () => {
    const rows = meta.mapMetaInsights("campaign", fx("meta-insights-campaign.json").data);
    assert.equal(rows.length, 4);
    const lead = rows[0];
    assert.deepEqual(
      { ...lead },
      { platform: "meta", level: "campaign", name: "Leads - Hydrafacial Offer", parent: "", campaign: "Leads - Hydrafacial Offer", spend: 1478.29, impressions: 90016, clicks: 1013, conversions: 47, conv_value: 0, reach: 31250, frequency: 2.880512, conv_known: true },
    );
    const adsets = meta.mapMetaInsights("adset", fx("meta-insights-adset-page1.json").data);
    assert.equal(adsets[0].parent, "Leads - Hydrafacial Offer");
    assert.equal(adsets[0].level, "adset");
    const ads = meta.mapMetaInsights("ad", fx("meta-insights-ad.json").data);
    assert.deepEqual([ads[0].level, ads[0].name, ads[0].parent, ads[0].campaign], ["ad", "Reel - Before you book", "Women 25-45 - Broad Singapore", "Leads - Hydrafacial Offer"]);
  });

  const metaRoutes = (opts: { rateLimitOnce?: boolean } = {}): Route[] => {
    let limited = !opts.rateLimitOnce;
    return [
      (c) => {
        if (c.url.hostname !== "graph.facebook.com" || !c.url.pathname.endsWith("/act_1234567890/insights")) return null;
        const level = c.url.searchParams.get("level");
        if (level === "campaign") {
          if (!limited) {
            limited = true;
            return json(fx("meta-rate-limit.json"), 400);
          }
          return json(fx("meta-insights-campaign.json"));
        }
        if (level === "adset") return json(c.url.searchParams.get("after") ? fx("meta-insights-adset-page2.json") : fx("meta-insights-adset-page1.json"));
        if (level === "ad") return json(fx("meta-insights-ad.json"));
        return null;
      },
    ];
  };

  test("Meta: fetch follows paging, retries throttling, never puts the token in a URL", async () => {
    reset(...metaRoutes({ rateLimitOnce: true }));
    const token = "EAAtesttoken1234567890abcdefghij";
    const r = await meta.fetchMetaRows(token, "1234567890", 30);
    assert.equal(r.rows.filter((x) => x.level === "campaign").length, 4);
    assert.equal(r.rows.filter((x) => x.level === "adset").length, 5, "second page of ad sets not read");
    assert.equal(r.rows.filter((x) => x.level === "ad").length, 2);
    assert.equal(calls.filter((c) => c.url.searchParams.get("level") === "campaign").length, 2, "throttled call not retried");
    for (const c of calls) {
      assert.ok(!c.url.href.includes("EAA"), `token in URL: ${c.url.pathname}`);
      assert.equal(c.headers.authorization, `Bearer ${token}`);
      assert.ok(c.url.searchParams.get("appsecret_proof"));
    }
    const first = calls.find((c) => c.url.searchParams.get("level") === "adset")!;
    assert.equal(first.url.searchParams.get("date_preset"), "last_30d");
    assert.match(first.url.searchParams.get("fields")!, /inline_link_clicks.*actions.*action_values/);
  });

  test("Meta: expired token is an auth error", async () => {
    reset((c) => (c.url.hostname === "graph.facebook.com" ? json(fx("meta-token-expired.json"), 400) : null));
    await assert.rejects(meta.fetchMetaRows("EAAexpired000000000000000000", "1234567890", 7), (e: unknown) => (e as { code?: string }).code === "auth" && /Reconnect Meta/.test((e as Error).message));
  });

  // ---------- Google Ads mapping ----------

  test("Google Ads: GAQL covers campaign, ad group, keyword and search terms for the last N days", () => {
    const q = gads.gaqlQueries(30, new Date("2026-10-09T05:00:00Z"));
    assert.match(q.campaign, /FROM campaign WHERE segments\.date BETWEEN '2026-09-09' AND '2026-10-08'/);
    assert.match(q.campaign, /metrics\.cost_micros.*metrics\.conversions_value, metrics\.search_impression_share/);
    assert.match(q.ad_group, /FROM ad_group /);
    assert.match(q.keyword, /FROM keyword_view /);
    assert.match(q.search_term, /FROM search_term_view .*LIMIT 2000$/);
  });

  test("Google Ads: rows map to AdRow (micros, impression share, match type, excluded terms)", () => {
    const camp = gads.mapGoogleAdsRows("campaign", fx("google-ads-campaign.json").flatMap((b: { results: unknown[] }) => b.results));
    assert.equal(camp.length, 5);
    assert.deepEqual(
      { ...camp[0] },
      { platform: "google", level: "campaign", name: "Search - Brand", parent: "", campaign: "Search - Brand", spend: 189.24, impressions: 2140, clicks: 498, conversions: 41, conv_value: 0, reach: null, frequency: null, conv_known: true, status: "Enabled", impr_share: 0.882 },
    );
    assert.equal(camp[4].impr_share, undefined, "PMax has no search impression share");
    const groups = gads.mapGoogleAdsRows("ad_group", fx("google-ads-ad-group.json")[0].results);
    assert.deepEqual([groups[1].level, groups[1].name, groups[1].parent], ["adset", "Core", "Search - Hydrafacial"]);
    const kws = gads.mapGoogleAdsRows("keyword", fx("google-ads-keyword.json")[0].results);
    assert.deepEqual([kws[0].level, kws[0].name, kws[0].match_type, kws[0].parent], ["keyword", "hydrafacial singapore", "Phrase match", "Core"]);
    const terms = gads.mapGoogleAdsRows("search_term", fx("google-ads-search-term.json")[0].results);
    assert.equal(terms.length, 5);
    assert.equal(terms.find((t) => t.name === "hydrafacial jobs")!.excluded, true);
    assert.equal(terms.find((t) => t.name === "cheap hydrafacial")!.excluded, false);
    assert.equal(terms[1].spend, 218.3);
  });

  const googleAdsRoutes = (): Route[] => [
    (c) => (c.url.pathname.endsWith("/customers:listAccessibleCustomers") ? json(fx("google-ads-list-accessible.json")) : null),
    (c) => {
      const m = c.url.pathname.match(/^\/v22\/customers\/(\d+)\/googleAds:searchStream$/);
      if (!m) return null;
      const q = (JSON.parse(c.body) as { query: string }).query;
      if (/FROM customer LIMIT 1/.test(q)) return json(fx(`google-ads-customer-${m[1]}.json`));
      if (/FROM customer_client/.test(q)) return json(fx(`google-ads-clients-${m[1]}.json`));
      if (/FROM campaign /.test(q)) return json(fx("google-ads-campaign.json"));
      if (/FROM ad_group /.test(q)) return json(fx("google-ads-ad-group.json"));
      if (/FROM keyword_view/.test(q)) return json(fx("google-ads-keyword.json"));
      if (/FROM search_term_view/.test(q)) return json(fx("google-ads-search-term.json"));
      return null;
    },
  ];

  test("Google Ads: lists direct and manager-client accounts with the right login-customer-id", async () => {
    reset(...googleAdsRoutes());
    const accounts = await gads.listGoogleAdsAccounts({ accessToken: "ya29.test", developerToken: "dev-token" });
    assert.deepEqual(
      accounts.map((a) => [a.id, a.name, a.login_customer_id]),
      [
        ["1234567890", "Glow Aesthetics SG", "1234567890"],
        ["5550001111", "Glow Aesthetics Tampines", "9876543210"],
      ],
    );
    const stream = calls.filter((c) => c.url.pathname.includes("searchStream"));
    assert.ok(stream.every((c) => c.headers["developer-token"] === "dev-token" && c.headers.authorization === "Bearer ya29.test"));
    assert.equal(calls[0].headers["login-customer-id"], undefined, "listAccessibleCustomers must not send login-customer-id");
  });

  test("Google Ads: fetch reads all four reports and flattens stream batches", async () => {
    reset(...googleAdsRoutes());
    const r = await gads.fetchGoogleAdsRows({ accessToken: "ya29.test", developerToken: "dev-token" }, "5550001111", 14, "9876543210", new Date("2026-10-09T00:00:00Z"));
    const by = (l: string) => r.rows.filter((x) => x.level === l).length;
    assert.deepEqual([by("campaign"), by("adset"), by("keyword"), by("search_term")], [5, 4, 3, 5]);
    assert.ok(calls.every((c) => c.headers["login-customer-id"] === "9876543210"));
    assert.match(JSON.parse(calls[0].body).query, /BETWEEN '2026-09-25' AND '2026-10-08'/);
  });

  test("Google Ads: an unapproved developer token gives a plain message", async () => {
    reset((c) => (c.url.hostname === "googleads.googleapis.com" ? json(fx("google-ads-error-not-approved.json"), 403) : null));
    await assert.rejects(
      gads.fetchGoogleAdsRows({ accessToken: "ya29.test", developerToken: "dev" }, "1234567890", 30),
      (e: unknown) => (e as { code?: string }).code === "not_approved" && /hasn't approved/.test((e as Error).message),
    );
  });

  // ---------- Search Console mapping ----------

  test("Search Console: sites skip unverified ones", () => {
    const s = gsc.mapSites(fx("gsc-sites.json"));
    assert.deepEqual(
      s.map((x) => [x.id, x.name]),
      [
        ["https://www.glowaesthetics.sg/", "https://www.glowaesthetics.sg/"],
        ["sc-domain:glowaesthetics.sg", "glowaesthetics.sg (whole domain)"],
      ],
    );
  });

  test("Search Console: rows map to the parser's DataRow shape and feed the visibility score", async () => {
    reset((c) => {
      if (!c.url.pathname.startsWith("/webmasters/v3/sites/") || !c.url.pathname.endsWith("/searchAnalytics/query")) return null;
      const b = JSON.parse(c.body) as { dimensions: string[]; startDate: string; endDate: string };
      return json(b.dimensions.length === 2 ? fx("gsc-query-page.json") : fx("gsc-query.json"));
    });
    const rows = await gsc.fetchSearchConsoleRows("ya29.test", "sc-domain:glowaesthetics.sg", 90, new Date("2026-10-09T00:00:00Z"));
    assert.equal(calls[0].url.pathname, "/webmasters/v3/sites/sc-domain%3Aglowaesthetics.sg/searchAnalytics/query");
    const body = JSON.parse(calls[0].body);
    assert.deepEqual([body.startDate, body.endDate, body.rowLimit], ["2026-07-09", "2026-10-06", 1000]);
    const hf = rows.find((r) => r.query === "hydrafacial singapore")!;
    assert.deepEqual(
      { ...hf },
      { query: "hydrafacial singapore", clicks: 38, impressions: 2410, ctr: 1.58, position: 7.2, searches: null, searches_label: null, competition: null, page: "https://www.glowaesthetics.sg/treatments/hydrafacial" },
    );
    assert.ok(rows.some((r) => r.query === "glow aesthetics reviews"), "queries are lower-cased like the parser");
    const data = toParsedData(rows)!;
    assert.equal(data.source, "search_console");
    assert.deepEqual(data.columns, ["clicks", "impressions", "ctr", "position"]);
    assert.equal(data.rows[0].query, "best facial singapore", "rows sort by impressions like pasted data");
    assert.equal(data.totals!.clicks, 303);
    assert.ok(visibilityScore(data)!.score > 0);
    const wins = dataQuickWins(data);
    assert.ok(wins.some((w) => w.includes("hydrafacial singapore") && w.includes("/treatments/hydrafacial")));
  });

  // ---------- Combined rows through the existing analysis ----------

  test("live rows run through analyzeAds unchanged", async () => {
    reset(...googleAdsRoutes(), ...metaRoutes());
    const g = await gads.fetchGoogleAdsRows({ accessToken: "ya29.test", developerToken: "d" }, "1234567890", 30);
    const m = await meta.fetchMetaRows("EAAtesttoken1234567890abcdefghij", "1234567890", 30);
    const a = analyzeAds([...g.rows, ...m.rows], { currency: { google: "SGD", meta: "SGD" }, brandTerms: ["glow aesthetics"] });
    assert.ok(a.platforms.google && a.platforms.meta);
    assert.equal(a.platforms.google!.base_level, "campaign");
    assert.equal(Math.round(a.platforms.google!.spend * 100) / 100, 5159.09);
    assert.equal(a.platforms.google!.campaign_count, 5);
    assert.equal(a.platforms.meta!.adset_count, 5);
    assert.ok(a.wasted_search_terms.some((w) => w.term === "cheap hydrafacial"));
    assert.ok(!a.wasted_search_terms.some((w) => w.term === "hydrafacial jobs"), "excluded terms are not waste");
    assert.ok(a.wasted_search_terms.find((w) => w.term === "glow aesthetics reviews")!.is_brand);
    assert.ok(a.score != null);
  });

  // ---------- Store, scoping and the specialists ----------

  const mkWorkspace = (plan: string, website = "https://www.glowaesthetics.sg"): WorkspaceRow => {
    const uid = id("u_");
    db().prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)").run(uid, `${uid}@example.test`, "Owner", now());
    const wid = id("w_");
    db()
      .prepare("INSERT INTO workspaces (id, owner_id, name, website, industry, location, offers, plan, created_at) VALUES (?, ?, 'Glow Aesthetics', ?, 'Aesthetic clinic', 'Tampines', 'hydrafacial, pico laser', ?, ?)")
      .run(wid, uid, website, plan, now());
    return db().prepare("SELECT * FROM workspaces WHERE id = ?").get(wid) as WorkspaceRow;
  };

  const GOOGLE_TOKENS = {
    access_token: "ya29.a0-initial-access-token-value",
    refresh_token: "1//0recorded-refresh-token-value",
    expires_in: 3599,
    scopes: [oauth.GOOGLE_SCOPE_ADS, oauth.GOOGLE_SCOPE_GSC, "openid", "email"],
    external_user: "owner@glowaesthetics.sg",
  };
  const META_TOKENS = { access_token: "EAAtesttoken1234567890abcdefghij", refresh_token: null, expires_in: 5_183_944, scopes: ["ads_read"], external_user: "Mei Tan" };

  test("store: tokens are encrypted at rest, scoped to the workspace and never sent to the browser", () => {
    const ws = mkWorkspace("growth");
    const other = mkWorkspace("growth");
    const conn = store.saveConnection(ws.id, "google", GOOGLE_TOKENS);
    const raw = JSON.stringify(db().prepare("SELECT * FROM connections WHERE id = ?").get(conn.id));
    assert.ok(!raw.includes(GOOGLE_TOKENS.access_token) && !raw.includes(GOOGLE_TOKENS.refresh_token), "plaintext token in the database");
    assert.equal(store.getConnection(other.id, "google"), null, "another workspace can see the connection");
    assert.deepEqual(store.connectionTokens(conn), { access: GOOGLE_TOKENS.access_token, refresh: GOOGLE_TOKENS.refresh_token });
    // Moving the encrypted token to another workspace's row doesn't decrypt.
    assert.equal(store.connectionTokens({ ...conn, workspace_id: other.id }).access, null);
    const client = JSON.stringify(store.clientConnections(ws.id));
    assert.ok(!client.includes("ya29") && !client.includes("1//0") && !client.includes("v1."), "client data includes a token");
    assert.throws(() => store.setSelected(other.id, "google", "google_ads", ["1234567890"]), "selecting on an unconnected workspace");
  });

  test("store: account auto-selection, single Search Console property, choices kept on reconnect", () => {
    const ws = mkWorkspace("growth");
    const conn = store.saveConnection(ws.id, "google", GOOGLE_TOKENS);
    const found = [
      { id: "1234567890", kind: "google_ads" as const, name: "Glow Aesthetics SG", currency: "SGD", login_customer_id: "1234567890" },
      ...gsc.mapSites(fx("gsc-sites.json")),
    ];
    store.replaceAccounts(ws.id, conn.id, found, ws.website);
    const sel = (k: "google_ads" | "search_console") => store.selectedAccounts(ws.id, k).map((a) => a.provider_account_id);
    assert.deepEqual(sel("google_ads"), ["1234567890"], "the only Google Ads account is picked");
    assert.deepEqual(sel("search_console"), ["sc-domain:glowaesthetics.sg"], "the domain property matching the website is picked");
    assert.equal(store.setSelected(ws.id, "google", "search_console", ["https://www.glowaesthetics.sg/", "sc-domain:glowaesthetics.sg"]), 1);
    assert.deepEqual(sel("search_console"), ["https://www.glowaesthetics.sg/"]);
    store.replaceAccounts(ws.id, conn.id, found, ws.website);
    assert.deepEqual(sel("search_console"), ["https://www.glowaesthetics.sg/"], "choice lost on reconnect");
  });

  test("store: expired Google access token is refreshed and re-encrypted", async () => {
    const ws = mkWorkspace("growth");
    store.saveConnection(ws.id, "google", { ...GOOGLE_TOKENS, expires_in: 30 });
    reset((c) => (c.url.href === "https://oauth2.googleapis.com/token" ? json(fx("google-token-refresh.json")) : null));
    const token = await store.accessToken(store.getConnection(ws.id, "google")!);
    assert.equal(token, "ya29.a0AfB_byRecordedRefreshedAccessToken0000000000");
    assert.equal(new URLSearchParams(calls[0].body).get("grant_type"), "refresh_token");
    const c = store.getConnection(ws.id, "google")!;
    assert.ok(!c.access_token_enc!.includes("ya29"));
    assert.equal(store.connectionTokens(c).access, token);
    reset((cc) => (cc.url.href === "https://oauth2.googleapis.com/token" ? json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400) : null));
    store.saveConnection(ws.id, "google", { ...GOOGLE_TOKENS, expires_in: 1 });
    await assert.rejects(store.accessToken(store.getConnection(ws.id, "google")!), /Reconnect Google/);
  });

  const connectBoth = (ws: WorkspaceRow) => {
    const g = store.saveConnection(ws.id, "google", GOOGLE_TOKENS);
    store.replaceAccounts(ws.id, g.id, [{ id: "1234567890", kind: "google_ads", name: "Glow Aesthetics SG", currency: "SGD", login_customer_id: "1234567890" }, ...gsc.mapSites(fx("gsc-sites.json"))], ws.website);
    const m = store.saveConnection(ws.id, "meta", META_TOKENS);
    store.replaceAccounts(ws.id, m.id, meta.mapMetaAdAccounts(fx("meta-adaccounts.json").data), ws.website);
    store.setSelected(ws.id, "meta", "meta_ads", ["1234567890"]);
  };

  test("fetchLiveAds: one provider failing doesn't stop the other, and the failure is reported", async () => {
    const ws = mkWorkspace("growth");
    connectBoth(ws);
    reset(...metaRoutes(), (c) => (c.url.hostname === "googleads.googleapis.com" ? json(fx("google-ads-error-not-approved.json"), 403) : null));
    const r = await live.fetchLiveAds(ws, 30);
    assert.ok(r.rows.length > 0 && r.rows.every((x) => x.platform === "meta"));
    const g = r.sources.find((s) => s.platform === "google")!;
    assert.equal(g.ok, false);
    assert.match(g.error!, /hasn't approved/);
    assert.ok(r.sources.find((s) => s.platform === "meta")!.ok);
    assert.equal(r.currency.meta, "SGD");
    const conns = store.clientConnections(ws.id);
    assert.ok(conns.find((c) => c.provider === "meta")!.lastSyncAt, "Meta sync time not recorded");
    assert.match(conns.find((c) => c.provider === "google")!.lastError ?? "", /hasn't approved/);
    assert.ok(!JSON.stringify(r).includes("EAAtest") && !JSON.stringify(r).includes("ya29"), "token leaked into results");
  });

  test("Ads Doctor demo mode reads live data for real and is gated to live-sync plans", async () => {
    const ws = mkWorkspace("growth");
    connectBoth(ws);
    reset(...googleAdsRoutes(), ...metaRoutes());
    const input = adsAgent.parseInput({ source: "live", days: 30 }, ws);
    assert.equal(input.source, "live");
    assert.equal(adsAgent.runTitle(input, ws), "Ads checkup: live sync, last 30 days");
    const result = await adsAgent.demo(input, { ws, runId: "r_test", progress: () => {} });
    assert.equal(result.demo, true);
    assert.equal(result.sample, false, "live data fell back to the sample account");
    const platforms = result.platforms as Record<string, unknown>;
    assert.ok(platforms.google && platforms.meta);
    assert.ok((result.sources_used as { label: string }[]).every((s) => !/windsor/i.test(s.label)));
    assert.ok(!/windsor/i.test(JSON.stringify(result)), "result mentions the old supplier");
    assert.ok(result.prescriptions.length > 0);

    const starter = mkWorkspace("starter");
    connectBoth(starter);
    assert.throws(() => startRun(starter, "ads", { source: "live", days: 30 }), (e: unknown) => e instanceof RunError && e.status === 402);
    const empty = mkWorkspace("growth");
    assert.throws(() => adsAgent.parseInput({ source: "live", days: 30 }, empty), /Connected accounts/);
  });

  test("Keyword Lab demo mode uses the connected Search Console by default", async () => {
    const ws = mkWorkspace("starter");
    connectBoth(ws);
    reset((c) => {
      if (!c.url.pathname.endsWith("/searchAnalytics/query")) return null;
      return json((JSON.parse(c.body) as { dimensions: string[] }).dimensions.length === 2 ? fx("gsc-query-page.json") : fx("gsc-query.json"));
    });
    const input = keywordsAgent.parseInput({ seeds: "hydrafacial" }, ws);
    assert.equal(input.gsc, true);
    assert.equal(keywordsAgent.parseInput({ seeds: "hydrafacial", gsc: false }, ws).gsc, false);
    const r = await keywordsAgent.demo(input, { ws, runId: "r_kw", progress: () => {} });
    const data = r.data as { source: string; total_rows: number };
    assert.equal(data.source, "search_console");
    assert.equal(data.total_rows, 7);
    assert.match(String(r.data_from), /Search Console: glowaesthetics\.sg \(whole domain\), last 90 days/);
    assert.ok(typeof r.score === "number");
    assert.match(r.summary, /connected Search Console/);

    // Search Console failing falls back to pasted data and says so.
    reset((c) => (c.url.pathname.endsWith("/searchAnalytics/query") ? json({ error: { code: 403, message: "User does not have sufficient permission", status: "PERMISSION_DENIED" } }, 403) : null));
    const r2 = await keywordsAgent.demo({ ...input, data: "Top queries,Clicks,Impressions,CTR,Position\nhydrafacial tampines,4,120,3.3%,8.1" }, { ws, runId: "r_kw2", progress: () => {} });
    assert.equal((r2.data as { total_rows: number }).total_rows, 1);
    assert.match(r2.summary, /couldn't be read this time/);
  });

  // ---------- organic social and the video library ----------

  const IG = "17841400000000001";
  const PAGE = "104000000000001";
  const CHANNEL = "UCabcdefghijklmnopqrstuv";
  const igMedia = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `180000000${String(i).padStart(8, "0")}`,
      caption: i % 3 === 2 ? `Photo ${i}` : `Reel ${i}: why hydrafacial before an event\nmore`,
      media_type: i % 3 === 2 ? "IMAGE" : "VIDEO",
      media_product_type: i % 3 === 2 ? "FEED" : "REELS",
      permalink: `https://www.instagram.com/reel/C${i}xyz/`,
      timestamp: new Date(Date.UTC(2026, 8, 30 - i)).toISOString().replace(".000Z", "+0000"),
      like_count: 100 - i,
      comments_count: i,
    }));
  const socialRoutes = (opts: { media?: number } = {}): Route[] => [
    (c) => {
      if (c.url.hostname !== "graph.facebook.com") return null;
      const p = c.url.pathname.replace(/^\/v[\d.]+/, "");
      if (p === "/me/accounts") return json({ data: [{ id: PAGE, name: "Glow Aesthetics", instagram_business_account: { id: IG, username: "glowaesthetics.sg" } }, { id: "104000000000002", name: "Side Page" }] });
      if (p === `/${IG}/media`) return json({ data: igMedia(opts.media ?? 9) });
      if (/^\/\d+\/insights$/.test(p)) return json({ data: [{ name: "views", values: [{ value: 1234 }] }] });
      if (/^\/18\d+$/.test(p)) return json({ media_url: `https://scontent.cdninstagram.com/v/t50/${p.slice(1)}.mp4?oh=signed` });
      if (p === `/${PAGE}`) return json({ access_token: "EAApagetoken1234567890abcdefghij" });
      if (p === `/${PAGE}/videos`) return json({ data: [{ id: "900000000000001", title: "Clinic tour", description: "Walk through", permalink_url: "/glow/videos/900000000000001/", created_time: "2026-09-01T03:00:00+0000", length: 42.5 }] });
      if (p === "/900000000000001") return json({ source: "https://video.xx.fbcdn.net/v/t42/clinic.mp4?oh=signed" });
      return null;
    },
    (c) => {
      if (c.url.hostname !== "www.googleapis.com" || !c.url.pathname.startsWith("/youtube/v3/")) return null;
      const p = c.url.pathname.slice("/youtube/v3/".length);
      if (p === "channels") return json({ items: [{ id: CHANNEL, snippet: { title: "Glow Aesthetics" } }] });
      if (p === "playlistItems") {
        assert.equal(c.url.searchParams.get("playlistId"), `UU${CHANNEL.slice(2)}`);
        return json({ items: [{ contentDetails: { videoId: "dQw4w9WgXcQ" } }] });
      }
      if (p === "videos")
        return json({ items: [{ id: "dQw4w9WgXcQ", snippet: { title: "Pico laser explained", description: "What to expect", publishedAt: "2026-09-20T02:00:00Z" }, statistics: { viewCount: "5400", likeCount: "210", commentCount: "12" }, contentDetails: { duration: "PT1M5S" } }] });
      return null;
    },
  ];

  test("social: Meta lists Pages with their Instagram accounts; YouTube lists channels", async () => {
    reset(...socialRoutes());
    const found = await live.discoverAccounts("meta", META_TOKENS.access_token, ["pages_show_list", "pages_read_engagement", "instagram_basic"]);
    assert.deepEqual(
      found.accounts.map((a) => `${a.kind}:${a.name}`),
      ["facebook_page:Glow Aesthetics", "instagram_account:@glowaesthetics.sg", "facebook_page:Side Page"],
    );
    assert.ok(calls.every((c) => !c.url.href.includes("EAAtest")), "token in a URL");
    const yt = await live.discoverAccounts("google", GOOGLE_TOKENS.access_token, [oauth.GOOGLE_SCOPE_YOUTUBE]);
    assert.deepEqual(yt.accounts, [{ id: CHANNEL, kind: "youtube_channel", name: "Glow Aesthetics", currency: null }]);
  });

  test("social: Instagram keeps videos only, with views; YouTube reads the uploads playlist", async () => {
    reset(...socialRoutes());
    const ig = await social.fetchInstagramVideos(META_TOKENS.access_token, IG, 100);
    assert.equal(ig.length, 6, "images are left out");
    assert.equal(ig[0].views, 1234);
    assert.equal(ig[0].title, "Reel 0: why hydrafacial before an event");
    assert.equal(ig[0].url, "https://www.instagram.com/reel/C0xyz/");
    assert.equal(ig[0].published_at, "2026-09-30T00:00:00.000Z");
    const yt = await social.fetchYouTubeVideos(GOOGLE_TOKENS.access_token, CHANNEL, 100);
    assert.deepEqual([yt[0].url, yt[0].views, yt[0].duration_seconds], ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", 5400, 65]);
    await assert.rejects(social.fetchInstagramVideos(META_TOKENS.access_token, "../me", 5), /isn't valid/);
  });

  test("social: TikTok lists videos with a cursor and refreshes its token", async () => {
    const ws = mkWorkspace("growth");
    store.saveConnection(ws.id, "tiktok", { access_token: "act.old0000000000", refresh_token: "rft.old0000000000", expires_in: 10, scopes: ["user.info.basic", "video.list"], external_user: "" });
    let page = 0;
    reset((c) => {
      if (c.url.href === "https://open.tiktokapis.com/v2/oauth/token/") return json({ access_token: "act.new0000000000", refresh_token: "rft.new0000000000", expires_in: 86400, scope: "user.info.basic,video.list" });
      if (c.url.pathname === "/v2/video/list/") {
        assert.equal(c.method, "POST");
        const body = JSON.parse(c.body) as { cursor?: number };
        page++;
        if (page === 1) assert.equal(body.cursor, undefined);
        else assert.equal(body.cursor, 1727000000000);
        const v = (n: number) => ({ id: `73${n}0000000000000`, title: "", video_description: `Tip ${n} #skincare`, create_time: 1727000000 - n, share_url: `https://www.tiktok.com/@glow/video/73${n}`, duration: 30, view_count: 900 + n, like_count: 50, comment_count: 3 });
        return json({ data: page === 1 ? { videos: [v(1), v(2)], cursor: 1727000000000, has_more: true } : { videos: [v(3)], cursor: 0, has_more: false }, error: { code: "ok", message: "" } });
      }
      return null;
    });
    const token = await store.accessToken(store.getConnection(ws.id, "tiktok")!);
    assert.equal(token, "act.new0000000000");
    assert.equal(store.connectionTokens(store.getConnection(ws.id, "tiktok")!).refresh, "rft.new0000000000", "rotated refresh token kept");
    const vids = await social.fetchTikTokVideos(token, 100);
    assert.deepEqual(vids.map((v) => v.title), ["Tip 1 #skincare", "Tip 2 #skincare", "Tip 3 #skincare"]);
    assert.equal(vids[0].published_at, new Date((1727000000 - 1) * 1000).toISOString());
  });

  test("video library: sync, drop unticked accounts, transcribe the plan's latest videos", async () => {
    const ws = mkWorkspace("growth");
    const m = store.saveConnection(ws.id, "meta", { ...META_TOKENS, scopes: ["ads_read", ...oauth.META_ORGANIC_SCOPES] });
    reset(...socialRoutes({ media: 60 }));
    store.replaceAccounts(ws.id, m.id, (await live.discoverAccounts("meta", META_TOKENS.access_token, oauth.META_ORGANIC_SCOPES)).accounts, ws.website);
    store.setSelected(ws.id, "meta", "instagram_account", [IG]);
    store.setSelected(ws.id, "meta", "facebook_page", [PAGE]);
    const g = store.saveConnection(ws.id, "google", { ...GOOGLE_TOKENS, scopes: [oauth.GOOGLE_SCOPE_YOUTUBE] });
    store.replaceAccounts(ws.id, g.id, [{ id: CHANNEL, kind: "youtube_channel", name: "Glow Aesthetics", currency: null }], ws.website);
    assert.ok(sync.hasSocialAccounts(ws.id));

    const r = await sync.syncSocialVideos(ws, { transcribe: false });
    assert.deepEqual(r.errors, []);
    const count = (platform?: string) =>
      (db().prepare(`SELECT COUNT(*) AS n FROM social_videos WHERE workspace_id = ?${platform ? " AND platform = ?" : ""}`).get(...(platform ? [ws.id, platform] : [ws.id])) as { n: number }).n;
    assert.equal(count("instagram"), 40, "60 posts, 40 of them videos");
    assert.equal(count("facebook"), 1);
    assert.equal(count("youtube"), 1);
    const fresh = db().prepare("SELECT * FROM workspaces WHERE id = ?").get(ws.id) as WorkspaceRow;
    assert.ok(fresh.videos_synced_at);

    // Transcription: Growth covers the latest 20. Instagram and Facebook by link, YouTube unavailable.
    process.env.ELEVENLABS_API_KEY = "sk_test_elevenlabs_key_value";
    const sent: string[] = [];
    reset(...socialRoutes({ media: 60 }), (c) => {
      if (c.url.href !== "https://api.elevenlabs.io/v1/speech-to-text") return null;
      assert.equal(c.headers["xi-api-key"], "sk_test_elevenlabs_key_value");
      sent.push(c.url.href);
      return json({ language_code: "en", text: "Hi, I'm Dr Tan and today we're talking about hydrafacial." });
    });
    try {
      const t = await sync.transcribeLatest(ws);
      assert.equal(t.done, 20, "the 20 latest Instagram and Facebook videos; YouTube doesn't take a place");
      const status = db().prepare("SELECT transcript_status AS s, COUNT(*) AS n FROM social_videos WHERE workspace_id = ? GROUP BY s ORDER BY s").all(ws.id);
      assert.deepEqual(status, [
        { s: "done", n: 20 },
        { s: "skipped", n: 21 },
        { s: "unavailable", n: 1 },
      ]);
      const lib = latestVideos(ws.id, 1)[0];
      assert.match(lib.transcriptExcerpt ?? "", /hydrafacial/);
      // Pro picks up the skipped ones (20 older Reels and the Facebook video) on the next run.
      assert.equal((await sync.transcribeLatest({ ...ws, plan: "pro" })).done, 21);
      assert.equal(sent.length, 41);
      // Re-ticking brings videos back untranscribed, but the month's allowance caps what that can cost.
      db().prepare("UPDATE social_videos SET transcript_status = 'none', transcript = NULL WHERE workspace_id = ?").run(ws.id);
      assert.equal((await sync.transcribeLatest(ws)).done, 0, "Growth's 20 for this month are used");
      // A bad key stops both workers and leaves the videos waiting for the next read.
      reset(...socialRoutes({ media: 60 }), (c) => (c.url.hostname === "api.elevenlabs.io" ? json({ detail: { message: "invalid api key" } }, 401) : null));
      const before = sent.length;
      const bad = await sync.transcribeLatest({ ...ws, plan: "pro" });
      assert.ok(bad.failed <= 2, `kept going after a bad key: ${bad.failed} failures`);
      assert.equal(sent.length, before);
      assert.equal((db().prepare("SELECT COUNT(*) AS n FROM social_videos WHERE workspace_id = ? AND transcript_status = 'error'").get(ws.id) as { n: number }).n, 0);
      assert.equal((await sync.transcribeLatest({ ...ws, plan: "starter" })).done, 0, "Starter doesn't transcribe");
    } finally {
      delete process.env.ELEVENLABS_API_KEY;
    }

    // Unticking Instagram drops its videos on the next sync; disconnecting Google drops YouTube's.
    store.setSelected(ws.id, "meta", "instagram_account", []);
    reset(...socialRoutes({ media: 60 }));
    await sync.syncSocialVideos(ws, { transcribe: false });
    assert.equal(count("instagram"), 0);
    sync.dropProviderVideos(ws.id, "google");
    assert.equal(count("youtube"), 0);
    assert.equal(count("facebook"), 1);
  });

  test("Social Media Content prompt block: best posts and recent posts, no duplicates", () => {
    const v = (url: string, views: number | null, t: string | null = null) => ({ platform: "instagram" as const, url, title: `Post ${url}`, caption: "", publishedAt: "2026-09-01T00:00:00Z", views, likes: 10, transcriptExcerpt: t });
    const block = ownPostsBlock([v("a", 900, "We start with a consult"), v("b", 300)], [v("a", 900), v("c", null)]);
    assert.match(block, /Best performing:\n- instagram, 2026-09-01, 900 views, 10 likes: Post a\n  Said: We start with a consult/);
    assert.match(block, /Most recent:\n- instagram, 2026-09-01, 10 likes: Post c/);
    assert.equal(block.match(/Post a/g)?.length, 1);
    assert.equal(ownPostsBlock([], []), "");
  });

  test("transcription only downloads from Meta's video hosts", () => {
    assert.ok(allowedMediaUrl("https://scontent.cdninstagram.com/v/x.mp4"));
    assert.ok(allowedMediaUrl("https://video.xx.fbcdn.net/v/x.mp4"));
    assert.ok(!allowedMediaUrl("http://scontent.cdninstagram.com/v/x.mp4"));
    assert.ok(!allowedMediaUrl("https://169.254.169.254/latest"));
    assert.ok(!allowedMediaUrl("https://cdninstagram.com.evil.test/x.mp4"));
  });

  // ---------- run ----------

  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ok   ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${t.name}\n       ${(e as Error).stack?.split("\n").slice(0, 4).join("\n       ")}`);
    }
  }
  console.log(failed ? `\n${failed} of ${tests.length} connector checks failed.` : `\nAll ${tests.length} connector checks passed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
