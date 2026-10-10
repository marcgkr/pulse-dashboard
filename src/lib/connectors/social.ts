// Organic social accounts for the video library: Instagram and Facebook Pages (through the Meta
// login), YouTube (through the Google login) and TikTok. Read-only: we list the owner's own posts
// and their public numbers. Server only. Never log tokens.

import { ConnectorError, fetchJson, numOrNull, type DiscoveredAccount } from "./http";
import { graphGet, graphPaged } from "./meta";

export const VIDEO_PLATFORMS = ["instagram", "facebook", "youtube", "tiktok"] as const;

/** One of the owner's videos, as the platform reports it. */
export type FetchedVideo = {
  platform: (typeof VIDEO_PLATFORMS)[number];
  external_id: string;
  url: string;
  title: string;
  caption: string;
  published_at: string | null;
  duration_seconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

// ---------- Meta: Instagram professional accounts and Facebook Pages ----------

/** Pages the person manages, and the Instagram professional account linked to each. */
export async function listMetaSocialAccounts(token: string): Promise<DiscoveredAccount[]> {
  const pages = (await graphPaged(token, "/me/accounts", { fields: "id,name,instagram_business_account{id,username}", limit: "100" })).data;
  const out: DiscoveredAccount[] = [];
  for (const p of pages) {
    const id = String(p.id ?? "");
    if (!/^\d+$/.test(id)) continue;
    out.push({ id, kind: "facebook_page", name: str(p.name, 200) || id, currency: null });
    const ig = p.instagram_business_account as { id?: string; username?: string } | undefined;
    if (ig?.id && /^\d+$/.test(ig.id)) out.push({ id: ig.id, kind: "instagram_account", name: ig.username ? `@${ig.username}` : ig.id, currency: null });
  }
  return out;
}

/** Pages through a Graph edge until `want` items pass the filter, reading at most `maxPages` pages. */
async function graphUntil(token: string, path: string, params: Record<string, string>, keep: (x: Record<string, unknown>) => boolean, want: number, maxPages = 6) {
  const out: Record<string, unknown>[] = [];
  let next: string | null = path;
  for (let page = 0; next && page < maxPages && out.length < want; page++) {
    const body: Record<string, unknown> = await graphGet(token, next, page === 0 ? params : {});
    for (const x of (body.data as Record<string, unknown>[] | undefined) ?? []) if (keep(x)) out.push(x);
    const paging = body.paging as { next?: string } | undefined;
    next = typeof paging?.next === "string" ? paging.next : null;
  }
  return out.slice(0, want);
}

/** Runs fn over items, a few at a time. */
async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n]);
      }
    }),
  );
  return out;
}

/** Latest Instagram videos and Reels, with views where the account shares insights. */
export async function fetchInstagramVideos(token: string, igUserId: string, limit: number): Promise<FetchedVideo[]> {
  if (!/^\d+$/.test(igUserId)) throw new ConnectorError("That Instagram account id isn't valid.", "api");
  const isVideo = (m: Record<string, unknown>) => (m.media_type === "VIDEO" || m.media_product_type === "REELS") && /^\d+$/.test(String(m.id ?? ""));
  const videos = await graphUntil(
    token,
    `/${igUserId}/media`,
    { fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count", limit: "50" },
    isVideo,
    limit,
  );
  return pool(videos, 5, async (m) => {
    const id = String(m.id);
    let views: number | null = null;
    try {
      // "views" replaced plays and video_views in 2025. Empty when Instagram has no data yet.
      const ins = await graphGet(token, `/${id}/insights`, { metric: "views" });
      const first = (ins.data as { values?: { value?: unknown }[] }[] | undefined)?.[0];
      views = numOrNull(first?.values?.[0]?.value);
    } catch {
      views = null; // no insights permission, or too new
    }
    const caption = str(m.caption);
    return {
      platform: "instagram" as const,
      external_id: id,
      url: str(m.permalink, 500),
      title: caption.split("\n")[0].slice(0, 140),
      caption,
      published_at: typeof m.timestamp === "string" ? new Date(m.timestamp).toISOString() : null,
      duration_seconds: null,
      views,
      likes: numOrNull(m.like_count),
      comments: numOrNull(m.comments_count),
    };
  });
}

/** A fresh, short-lived link to the video file, for transcription. Null when Instagram doesn't share it. */
export async function instagramMediaUrl(token: string, mediaId: string): Promise<string | null> {
  if (!/^\d+$/.test(mediaId)) return null;
  const m = await graphGet(token, `/${mediaId}`, { fields: "media_url" });
  return typeof m.media_url === "string" && m.media_url.startsWith("https://") ? m.media_url : null;
}

/** The Page's own token, needed to read its videos. */
async function pageToken(userToken: string, pageId: string): Promise<string> {
  if (!/^\d+$/.test(pageId)) throw new ConnectorError("That Facebook Page id isn't valid.", "api");
  const p = await graphGet(userToken, `/${pageId}`, { fields: "access_token" });
  if (typeof p.access_token !== "string") throw new ConnectorError("Facebook didn't share access to this Page. Reconnect Meta and tick the Page.", "permission");
  return p.access_token;
}

export async function fetchFacebookVideos(userToken: string, pageId: string, limit: number): Promise<FetchedVideo[]> {
  const token = await pageToken(userToken, pageId);
  const vids = await graphUntil(token, `/${pageId}/videos`, { fields: "id,title,description,permalink_url,created_time,length", limit: "50" }, (v) => /^\d+$/.test(String(v.id ?? "")), limit);
  return vids.map((v) => {
      const caption = str(v.description);
      const link = str(v.permalink_url, 500);
      return {
        platform: "facebook" as const,
        external_id: String(v.id),
        url: link.startsWith("http") ? link : `https://www.facebook.com${link}`,
        title: str(v.title, 140) || caption.split("\n")[0].slice(0, 140),
        caption,
        published_at: typeof v.created_time === "string" ? new Date(v.created_time).toISOString() : null,
        duration_seconds: numOrNull(v.length) != null ? Math.round(numOrNull(v.length)!) : null,
        views: null,
        likes: null,
        comments: null,
      };
    });
}

/** A link to a Page video's file, for transcription. */
export async function facebookVideoSource(userToken: string, pageId: string, videoId: string): Promise<string | null> {
  if (!/^\d+$/.test(videoId)) return null;
  const token = await pageToken(userToken, pageId);
  const v = await graphGet(token, `/${videoId}`, { fields: "source" });
  return typeof v.source === "string" && v.source.startsWith("https://") ? v.source : null;
}

// ---------- YouTube ----------

async function youtube(token: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetchJson(u, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  if (!res.ok) {
    const msg = ((res.body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`).slice(0, 200);
    throw new ConnectorError(`YouTube: ${msg}`, res.status === 401 ? "auth" : res.status === 403 ? "permission" : "api", res.status);
  }
  return (res.body ?? {}) as Record<string, unknown>;
}

export async function listYouTubeChannels(token: string): Promise<DiscoveredAccount[]> {
  const body = await youtube(token, "channels", { part: "snippet", mine: "true", maxResults: "50" });
  return ((body.items as { id?: string; snippet?: { title?: string } }[] | undefined) ?? [])
    .filter((c) => typeof c.id === "string" && /^UC[\w-]{20,}$/.test(c.id))
    .map((c) => ({ id: c.id!, kind: "youtube_channel" as const, name: c.snippet?.title?.slice(0, 200) || c.id!, currency: null }));
}

/** ISO 8601 duration (PT1M5S) to seconds. */
export function isoDurationSeconds(d: unknown): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(d ?? ""));
  if (!m) return null;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0));
}

export async function fetchYouTubeVideos(token: string, channelId: string, limit: number): Promise<FetchedVideo[]> {
  if (!/^UC[\w-]{20,}$/.test(channelId)) throw new ConnectorError("That YouTube channel id isn't valid.", "api");
  // Every channel's uploads playlist is its id with UC swapped for UU.
  const playlist = `UU${channelId.slice(2)}`;
  const ids: string[] = [];
  let page = "";
  for (let pages = 0; ids.length < limit && pages < 6; pages++) {
    const body = await youtube(token, "playlistItems", { part: "contentDetails", playlistId: playlist, maxResults: "50", ...(page ? { pageToken: page } : {}) });
    for (const it of (body.items as { contentDetails?: { videoId?: string } }[] | undefined) ?? []) {
      const id = it.contentDetails?.videoId;
      if (id && /^[\w-]{6,20}$/.test(id)) ids.push(id);
    }
    page = typeof body.nextPageToken === "string" ? body.nextPageToken : "";
    if (!page) break;
  }
  const out: FetchedVideo[] = [];
  for (let i = 0; i < Math.min(ids.length, limit); i += 50) {
    const body = await youtube(token, "videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, Math.min(i + 50, limit)).join(",") });
    for (const v of (body.items as Record<string, Record<string, unknown>>[] | undefined) ?? []) {
      const id = String((v as unknown as { id: string }).id);
      const sn = v.snippet ?? {};
      const st = v.statistics ?? {};
      out.push({
        platform: "youtube",
        external_id: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: str(sn.title, 200),
        caption: str(sn.description),
        published_at: typeof sn.publishedAt === "string" ? sn.publishedAt : null,
        duration_seconds: isoDurationSeconds(v.contentDetails?.duration),
        views: numOrNull(st.viewCount),
        likes: numOrNull(st.likeCount),
        comments: numOrNull(st.commentCount),
      });
    }
  }
  return out;
}

// ---------- TikTok ----------

const TIKTOK_FIELDS = "id,title,video_description,create_time,share_url,duration,view_count,like_count,comment_count";

async function tiktok(token: string, path: string, init: { method?: string; body?: string } = {}): Promise<Record<string, unknown>> {
  const res = await fetchJson(`https://open.tiktokapis.com/v2/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
  const body = (res.body ?? {}) as { data?: Record<string, unknown>; error?: { code?: string; message?: string } };
  if (!res.ok || (body.error?.code && body.error.code !== "ok")) {
    const code = body.error?.code ?? "";
    throw new ConnectorError(`TikTok: ${(body.error?.message || code || `HTTP ${res.status}`).slice(0, 200)}`, /token|auth/i.test(code) || res.status === 401 ? "auth" : "api", res.status);
  }
  return body.data ?? {};
}

export async function listTikTokAccount(token: string): Promise<DiscoveredAccount[]> {
  const d = await tiktok(token, "user/info/?fields=open_id,display_name");
  const u = (d.user ?? {}) as { open_id?: string; display_name?: string };
  return u.open_id ? [{ id: u.open_id, kind: "tiktok_account", name: u.display_name?.slice(0, 200) || "TikTok account", currency: null }] : [];
}

export async function fetchTikTokVideos(token: string, limit: number): Promise<FetchedVideo[]> {
  const out: FetchedVideo[] = [];
  let cursor: number | undefined;
  for (let page = 0; out.length < limit && page < 10; page++) {
    const d = await tiktok(token, `video/list/?fields=${TIKTOK_FIELDS}`, { method: "POST", body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }) });
    for (const v of (d.videos as Record<string, unknown>[] | undefined) ?? []) {
      const caption = str(v.video_description);
      out.push({
        platform: "tiktok",
        external_id: String(v.id ?? ""),
        url: str(v.share_url, 500),
        title: str(v.title, 200) || caption.split("\n")[0].slice(0, 140),
        caption,
        published_at: numOrNull(v.create_time) ? new Date(numOrNull(v.create_time)! * 1000).toISOString() : null,
        duration_seconds: numOrNull(v.duration),
        views: numOrNull(v.view_count),
        likes: numOrNull(v.like_count),
        comments: numOrNull(v.comment_count),
      });
    }
    if (!d.has_more) break;
    cursor = numOrNull(d.cursor) ?? undefined;
    if (!cursor) break;
  }
  return out.filter((v) => v.external_id && v.url).slice(0, limit);
}
