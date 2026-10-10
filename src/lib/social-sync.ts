// Fills the video library (social_videos) from the owner's connected Instagram, Facebook Page, YouTube
// and TikTok accounts, then transcribes the latest videos the plan covers. Every step is best effort:
// one account failing doesn't stop the others. Server only. Logs never include tokens or media links.

import { planById } from "./config";
import { db, now, type VideoRow, type WorkspaceRow } from "./db";
import { ConnectorError } from "./connectors/http";
import type { Provider } from "./connectors/oauth";
import {
  facebookVideoSource,
  fetchFacebookVideos,
  fetchInstagramVideos,
  fetchTikTokVideos,
  fetchYouTubeVideos,
  instagramMediaUrl,
  VIDEO_PLATFORMS,
  type FetchedVideo,
} from "./connectors/social";
import { accessToken, getConnection, selectedAccounts, type AccountKind, type SelectedAccount } from "./connectors/store";
import { transcribeMediaUrl, transcriptionReady } from "./transcribe";

/** How many of each account's latest videos we keep. */
export const VIDEOS_PER_ACCOUNT = 100;
/** Longer videos aren't transcribed (cost and time). */
const MAX_TRANSCRIBE_SECONDS = 30 * 60;
/** Reading the library again before this is pointless for the specialists. */
export const SYNC_STALE_MS = 12 * 3600_000;

type Platform = FetchedVideo["platform"];

const SOURCES: { kind: AccountKind; provider: Provider; platform: Platform }[] = [
  { kind: "instagram_account", provider: "meta", platform: "instagram" },
  { kind: "facebook_page", provider: "meta", platform: "facebook" },
  { kind: "youtube_channel", provider: "google", platform: "youtube" },
  { kind: "tiktok_account", provider: "tiktok", platform: "tiktok" },
];

const LABEL: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok" };

const syncing = new Set<string>();
const transcribing = new Set<string>();

function logFailure(what: string, e: unknown) {
  const detail = e instanceof ConnectorError ? `${e.code} ${e.status}: ${e.message}` : ((e as Error)?.name ?? "error");
  console.warn(`[social] ${what} failed: ${detail}`);
}

/** Whether any organic social account is ticked for this business. */
export function hasSocialAccounts(wsId: string): boolean {
  return SOURCES.some((s) => selectedAccounts(wsId, s.kind).length > 0);
}

function fetchFor(token: string, platform: Platform, a: SelectedAccount): Promise<FetchedVideo[]> {
  if (platform === "instagram") return fetchInstagramVideos(token, a.provider_account_id, VIDEOS_PER_ACCOUNT);
  if (platform === "facebook") return fetchFacebookVideos(token, a.provider_account_id, VIDEOS_PER_ACCOUNT);
  if (platform === "youtube") return fetchYouTubeVideos(token, a.provider_account_id, VIDEOS_PER_ACCOUNT);
  return fetchTikTokVideos(token, VIDEOS_PER_ACCOUNT);
}

function upsert(wsId: string, accountId: string, videos: FetchedVideo[]) {
  const stmt = db().prepare(
    `INSERT INTO social_videos (workspace_id, platform, external_id, url, title, caption, published_at, duration_seconds, views, likes, comments, account_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, platform, external_id) DO UPDATE SET
       url = excluded.url, title = excluded.title, caption = excluded.caption, published_at = excluded.published_at,
       duration_seconds = excluded.duration_seconds, views = excluded.views, likes = excluded.likes, comments = excluded.comments,
       account_id = excluded.account_id, updated_at = excluded.updated_at`,
  );
  const ts = now();
  db().transaction(() => {
    for (const v of videos) {
      if (!v.external_id || !/^https:\/\//.test(v.url)) continue;
      stmt.run(wsId, v.platform, v.external_id, v.url, v.title, v.caption, v.published_at, v.duration_seconds, v.views, v.likes, v.comments, accountId, ts);
    }
  })();
}

export type SyncResult = { videos: number; errors: string[] };

/**
 * Reads the latest videos from every ticked social account, drops videos from accounts that are no
 * longer ticked, and starts transcription in the background. Concurrent calls for one business share
 * nothing: the second returns straight away.
 */
export async function syncSocialVideos(ws: Pick<WorkspaceRow, "id" | "plan">, opts: { transcribe?: boolean } = {}): Promise<SyncResult> {
  const out: SyncResult = { videos: 0, errors: [] };
  if (syncing.has(ws.id)) return out;
  syncing.add(ws.id);
  try {
    const tokens = new Map<Provider, Promise<string>>();
    const token = (p: Provider) => {
      if (!tokens.has(p)) {
        const conn = getConnection(ws.id, p);
        tokens.set(p, conn ? accessToken(conn) : Promise.reject(new ConnectorError("Not connected.", "auth")));
      }
      return tokens.get(p)!;
    };
    const keep = new Map<Platform, Set<string>>(VIDEO_PLATFORMS.map((p) => [p, new Set<string>()]));
    for (const s of SOURCES) {
      for (const a of selectedAccounts(ws.id, s.kind)) {
        keep.get(s.platform)!.add(a.provider_account_id);
        try {
          const videos = await fetchFor(await token(s.provider), s.platform, a);
          upsert(ws.id, a.provider_account_id, videos);
          out.videos += videos.length;
        } catch (e) {
          logFailure(`${s.platform} ${a.name}`, e);
          out.errors.push(`${LABEL[s.platform]} ${a.name}: ${e instanceof ConnectorError ? e.message : "couldn't read the posts right now."}`);
        }
      }
    }
    // Videos from accounts that were unticked or disconnected leave the library.
    const del = db().prepare("DELETE FROM social_videos WHERE workspace_id = ? AND platform = ? AND account_id = ?");
    const rows = db().prepare("SELECT DISTINCT platform, account_id FROM social_videos WHERE workspace_id = ?").all(ws.id) as { platform: Platform; account_id: string }[];
    for (const r of rows) if (!keep.get(r.platform)?.has(r.account_id)) del.run(ws.id, r.platform, r.account_id);
    db().prepare("UPDATE workspaces SET videos_synced_at = ? WHERE id = ?").run(now(), ws.id);
  } finally {
    syncing.delete(ws.id);
  }
  if (opts.transcribe !== false) void transcribeLatest(ws).catch((e) => logFailure("transcription", e));
  return out;
}

/** Syncs when the library is older than SYNC_STALE_MS, waiting at most maxWaitMs. Never throws. */
export async function refreshVideosIfStale(ws: WorkspaceRow, maxWaitMs = 45_000): Promise<void> {
  if (!hasSocialAccounts(ws.id)) return;
  const last = ws.videos_synced_at ? Date.parse(ws.videos_synced_at) : 0;
  if (Date.now() - last < SYNC_STALE_MS) return;
  await Promise.race([syncSocialVideos(ws).catch((e) => logFailure("sync", e)), new Promise((r) => setTimeout(r, maxWaitMs))]);
}

/**
 * Transcribes the plan's number of latest videos. Instagram and Facebook share the video file; YouTube
 * and TikTok don't, so those are marked unavailable and the specialists use their titles and captions.
 */
export async function transcribeLatest(ws: Pick<WorkspaceRow, "id" | "plan">): Promise<{ done: number; failed: number }> {
  const cap = planById(ws.plan).transcribeVideos;
  const res = { done: 0, failed: 0 };
  if (cap <= 0 || !transcriptionReady() || transcribing.has(ws.id)) return res;
  transcribing.add(ws.id);
  try {
    const latest = db().prepare("SELECT * FROM social_videos WHERE workspace_id = ? ORDER BY published_at DESC LIMIT ?").all(ws.id, cap) as VideoRow[];
    const mark = db().prepare("UPDATE social_videos SET transcript = ?, transcript_status = ?, transcript_note = ?, updated_at = ? WHERE workspace_id = ? AND platform = ? AND external_id = ?");
    const set = (v: VideoRow, status: VideoRow["transcript_status"], note: string, text: string | null = null) =>
      mark.run(text, status, note.slice(0, 200), now(), ws.id, v.platform, v.external_id);

    const todo: VideoRow[] = [];
    for (const v of latest) {
      if (v.transcript_status !== "none" && v.transcript_status !== "skipped") continue;
      if (v.platform === "youtube" || v.platform === "tiktok") set(v, "unavailable", `${LABEL[v.platform]} doesn't share the video file, so we use the title and caption.`);
      else if ((v.duration_seconds ?? 0) > MAX_TRANSCRIBE_SECONDS) set(v, "skipped", "Longer than 30 minutes.");
      else todo.push(v);
    }
    // Older videos beyond the plan's number wait as skipped, so an upgrade picks them up.
    const ids = new Set(latest.map((v) => `${v.platform}|${v.external_id}`));
    const older = db().prepare("SELECT platform, external_id FROM social_videos WHERE workspace_id = ? AND transcript_status = 'none'").all(ws.id) as VideoRow[];
    for (const v of older) if (!ids.has(`${v.platform}|${v.external_id}`)) set(v, "skipped", "Outside your plan's latest videos.");

    if (todo.length === 0) return res;
    const meta = getConnection(ws.id, "meta");
    if (!meta) return res;
    const token = await accessToken(meta);
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const v = todo[i++];
        try {
          const link = v.platform === "instagram" ? await instagramMediaUrl(token, v.external_id) : await facebookVideoSource(token, v.account_id, v.external_id);
          if (!link) {
            set(v, "unavailable", `${LABEL[v.platform]} didn't share the video file.`);
            continue;
          }
          const text = await transcribeMediaUrl(link);
          set(v, "done", text ? "" : "No speech in this video.", text.slice(0, 20_000));
          res.done++;
        } catch (e) {
          logFailure(`transcribing ${v.platform} ${v.external_id}`, e);
          set(v, "error", "Couldn't transcribe this one.");
          res.failed++;
          // A bad key or a used-up quota fails every video the same way: stop and try again on the next sync.
          if (e instanceof ConnectorError && (e.code === "auth" || e.code === "rate_limit")) break;
        }
      }
    };
    await Promise.all([worker(), worker()]);
  } finally {
    transcribing.delete(ws.id);
  }
  return res;
}

export type LibraryStatus = { videos: number; byPlatform: Partial<Record<Platform, number>>; transcribed: number; syncedAt: string | null; transcribeCap: number; transcriptionOn: boolean };

export function libraryStatus(ws: Pick<WorkspaceRow, "id" | "plan" | "videos_synced_at">): LibraryStatus {
  const rows = db().prepare("SELECT platform, COUNT(*) AS n, SUM(transcript_status = 'done') AS t FROM social_videos WHERE workspace_id = ? GROUP BY platform").all(ws.id) as {
    platform: Platform;
    n: number;
    t: number | null;
  }[];
  const byPlatform: Partial<Record<Platform, number>> = {};
  for (const r of rows) byPlatform[r.platform] = r.n;
  return {
    videos: rows.reduce((s, r) => s + r.n, 0),
    byPlatform,
    transcribed: rows.reduce((s, r) => s + (r.t ?? 0), 0),
    syncedAt: ws.videos_synced_at ?? null,
    transcribeCap: planById(ws.plan).transcribeVideos,
    transcriptionOn: transcriptionReady(),
  };
}

/** Removes a disconnected provider's videos straight away. */
export function dropProviderVideos(wsId: string, p: Provider) {
  const platforms = SOURCES.filter((s) => s.provider === p).map((s) => s.platform);
  const del = db().prepare("DELETE FROM social_videos WHERE workspace_id = ? AND platform = ?");
  for (const pl of platforms) del.run(wsId, pl);
}

export const SOCIAL_KINDS: AccountKind[] = SOURCES.map((s) => s.kind);
