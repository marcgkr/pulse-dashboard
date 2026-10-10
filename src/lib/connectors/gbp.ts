// Google Business Profile (read-only): the owner's locations, each location's profile, reviews, posts,
// photo count and the last 30 days of calls, website clicks and direction requests. Server only.
// Google gives these APIs to approved projects only (GOOGLE_BUSINESS_PROFILE=1 once approved).

import { ConnectorError, fetchJson, isoDay, numOrNull, retryDelayMs, scrub, sleep, type DiscoveredAccount } from "./http";

const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const PERF = "https://businessprofileperformance.googleapis.com/v1";
const MAX_RETRIES = 2;

/** "accounts/123/locations/456": the account is needed for reviews and posts, the location for the rest. */
const LOCATION_ID = /^accounts\/(\d+)\/locations\/(\d+)$/;

export function parseLocationId(id: string): { account: string; location: string } | null {
  const m = LOCATION_ID.exec(id);
  return m ? { account: m[1], location: m[2] } : null;
}

async function gbpGet(token: string, url: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchJson(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
    if (res.ok) return (res.body ?? {}) as Record<string, unknown>;
    const err = (res.body as { error?: { message?: string; status?: string } } | null)?.error;
    const msg = scrub(err?.message ?? `HTTP ${res.status}`, [token]);
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(attempt, res.retryAfter));
      continue;
    }
    if (res.status === 401) throw new ConnectorError("Google access has expired or was removed. Reconnect Google in Settings > Connected accounts.", "auth", 401);
    // A project without Business Profile API access gets 403 or 429 with a zero quota.
    if (/quota|has not been used|is disabled|not been approved/i.test(msg))
      throw new ConnectorError("Google hasn't switched on Business Profile access for this app yet. Ask PULSE to check the API approval.", "not_approved", res.status);
    if (res.status === 403 || res.status === 404) throw new ConnectorError("Google says this login can't read that Business Profile. Check you're an owner or manager of it, then reconnect.", "permission", res.status);
    throw new ConnectorError(`Google Business Profile returned an error: ${msg}`, "api", res.status);
  }
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

type RawAddress = { addressLines?: string[]; locality?: string; postalCode?: string };
const address = (a: RawAddress | undefined) => [...(a?.addressLines ?? []), a?.locality, a?.postalCode].filter(Boolean).join(", ");

/** Every location on every account the person can manage, as "accounts/A/locations/L". */
export async function listGbpLocations(token: string): Promise<DiscoveredAccount[]> {
  const out: DiscoveredAccount[] = [];
  const accounts: string[] = [];
  let page = "";
  for (let i = 0; i < 5; i++) {
    const b = await gbpGet(token, `${ACCOUNTS}/accounts?pageSize=20${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
    for (const a of (b.accounts as { name?: string }[] | undefined) ?? []) if (a.name && /^accounts\/\d+$/.test(a.name)) accounts.push(a.name);
    page = str(b.nextPageToken, 500);
    if (!page) break;
  }
  for (const acct of accounts.slice(0, 20)) {
    let lp = "";
    for (let i = 0; i < 5; i++) {
      const b = await gbpGet(token, `${INFO}/${acct}/locations?readMask=name,title,storefrontAddress&pageSize=100${lp ? `&pageToken=${encodeURIComponent(lp)}` : ""}`);
      for (const l of (b.locations as { name?: string; title?: string; storefrontAddress?: RawAddress }[] | undefined) ?? []) {
        const m = /^locations\/(\d+)$/.exec(l.name ?? "");
        if (!m) continue;
        const where = address(l.storefrontAddress);
        out.push({ id: `${acct}/locations/${m[1]}`, kind: "gbp_location", name: `${str(l.title, 150) || "Unnamed location"}${where ? ` (${where.slice(0, 80)})` : ""}`, currency: null });
      }
      lp = str(b.nextPageToken, 500);
      if (!lp) break;
    }
  }
  return out;
}

export type GbpReview = { reviewer: string; stars: number | null; comment: string; created: string | null; replied: boolean };
export type GbpPost = { summary: string; created: string | null; type: string };

export type GbpSnapshot = {
  title: string;
  primaryCategory: string;
  additionalCategories: string[];
  description: string;
  phone: string;
  website: string;
  address: string;
  hasHours: boolean;
  specialHours: number;
  services: string[];
  mapsUri: string;
  photos: number | null;
  rating: number | null;
  reviewCount: number | null;
  reviews: GbpReview[];
  posts: GbpPost[];
  /** Last 30 days, or null when Google didn't share them. */
  actions: { calls: number; websiteClicks: number; directions: number } | null;
  warnings: string[];
};

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** One location's profile and activity. Reviews, posts, photos and performance are best effort. */
export async function fetchGbpSnapshot(token: string, id: string, now = new Date()): Promise<GbpSnapshot> {
  const ids = parseLocationId(id);
  if (!ids) throw new ConnectorError("That Business Profile location isn't valid.", "api");
  const mask = "name,title,phoneNumbers,categories,storefrontAddress,websiteUri,regularHours,specialHours,profile,metadata,serviceItems";
  const l = await gbpGet(token, `${INFO}/locations/${ids.location}?readMask=${mask}`);
  const cats = (l.categories ?? {}) as { primaryCategory?: { displayName?: string }; additionalCategories?: { displayName?: string }[] };
  const services = ((l.serviceItems as { structuredServiceItem?: { description?: string }; freeFormServiceItem?: { label?: { displayName?: string } } }[] | undefined) ?? [])
    .map((s) => str(s.freeFormServiceItem?.label?.displayName ?? s.structuredServiceItem?.description, 120))
    .filter(Boolean);
  const snap: GbpSnapshot = {
    title: str(l.title, 200),
    primaryCategory: str(cats.primaryCategory?.displayName, 120),
    additionalCategories: (cats.additionalCategories ?? []).map((c) => str(c.displayName, 120)).filter(Boolean),
    description: str((l.profile as { description?: string } | undefined)?.description, 1000),
    phone: str((l.phoneNumbers as { primaryPhone?: string } | undefined)?.primaryPhone, 40),
    website: str(l.websiteUri, 300),
    address: address(l.storefrontAddress as RawAddress | undefined),
    hasHours: Boolean((l.regularHours as { periods?: unknown[] } | undefined)?.periods?.length),
    specialHours: ((l.specialHours as { specialHourPeriods?: unknown[] } | undefined)?.specialHourPeriods ?? []).length,
    services: services.slice(0, 40),
    mapsUri: str((l.metadata as { mapsUri?: string } | undefined)?.mapsUri, 300),
    photos: null,
    rating: null,
    reviewCount: null,
    reviews: [],
    posts: [],
    actions: null,
    warnings: [],
  };
  const base = `${V4}/accounts/${ids.account}/locations/${ids.location}`;
  const soft = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof ConnectorError && e.code === "auth") throw e;
      snap.warnings.push(`${label} couldn't be read this time.`);
    }
  };
  await soft("Reviews", async () => {
    const b = await gbpGet(token, `${base}/reviews?pageSize=50`);
    snap.rating = numOrNull(b.averageRating);
    snap.reviewCount = numOrNull(b.totalReviewCount);
    snap.reviews = ((b.reviews as Record<string, unknown>[] | undefined) ?? []).map((r) => ({
      reviewer: str((r.reviewer as { displayName?: string } | undefined)?.displayName, 80) || "A customer",
      stars: STARS[str(r.starRating)] ?? null,
      comment: str(r.comment, 1200),
      created: str(r.createTime, 40) || null,
      replied: Boolean((r.reviewReply as { comment?: string } | undefined)?.comment),
    }));
  });
  await soft("Posts", async () => {
    const b = await gbpGet(token, `${base}/localPosts?pageSize=20`);
    snap.posts = ((b.localPosts as Record<string, unknown>[] | undefined) ?? []).map((p) => ({ summary: str(p.summary, 600), created: str(p.createTime, 40) || null, type: str(p.topicType, 30) }));
  });
  await soft("Photos", async () => {
    const b = await gbpGet(token, `${base}/media?pageSize=1`);
    snap.photos = numOrNull(b.totalMediaItemCount) ?? 0;
  });
  await soft("Calls, website clicks and directions", async () => {
    const start = new Date(`${isoDay(now, 31)}T00:00:00Z`);
    const end = new Date(`${isoDay(now, 1)}T00:00:00Z`);
    const d = (p: string, x: Date) => `${p}.year=${x.getUTCFullYear()}&${p}.month=${x.getUTCMonth() + 1}&${p}.day=${x.getUTCDate()}`;
    const b = await gbpGet(
      token,
      `${PERF}/locations/${ids.location}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=CALL_CLICKS&dailyMetrics=WEBSITE_CLICKS&dailyMetrics=BUSINESS_DIRECTION_REQUESTS&${d("dailyRange.startDate", start)}&${d("dailyRange.endDate", end)}`,
    );
    const total: Record<string, number> = {};
    for (const group of (b.multiDailyMetricTimeSeries as { dailyMetricTimeSeries?: { dailyMetric?: string; timeSeries?: { datedValues?: { value?: string }[] } }[] }[] | undefined) ?? []) {
      for (const s of group.dailyMetricTimeSeries ?? []) {
        total[s.dailyMetric ?? ""] = (s.timeSeries?.datedValues ?? []).reduce((n, v) => n + (numOrNull(v.value) ?? 0), 0);
      }
    }
    snap.actions = { calls: total.CALL_CLICKS ?? 0, websiteClicks: total.WEBSITE_CLICKS ?? 0, directions: total.BUSINESS_DIRECTION_REQUESTS ?? 0 };
  });
  return snap;
}
