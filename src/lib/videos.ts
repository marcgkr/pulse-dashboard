import { db, type VideoRow } from "./db";

// The owner's own videos from connected Instagram, YouTube and TikTok accounts, with transcripts
// where the plan includes them. Filled by the social sync (src/lib/connectors/social.ts). Server only.

export type LibraryVideo = {
  platform: VideoRow["platform"];
  url: string;
  title: string;
  caption: string;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  /** Up to ~600 characters of transcript, or null when there is none. */
  transcriptExcerpt: string | null;
};

const excerpt = (t: string | null, n = 600) => (t ? (t.length > n ? `${t.slice(0, n).trimEnd()}...` : t) : null);

function toLibrary(v: VideoRow): LibraryVideo {
  return {
    platform: v.platform,
    url: v.url,
    title: v.title,
    caption: v.caption,
    publishedAt: v.published_at,
    views: v.views,
    likes: v.likes,
    transcriptExcerpt: v.transcript_status === "done" ? excerpt(v.transcript) : null,
  };
}

/** Latest videos first. */
export function latestVideos(workspaceId: string, limit = 50): LibraryVideo[] {
  return (db().prepare("SELECT * FROM social_videos WHERE workspace_id = ? ORDER BY published_at DESC LIMIT ?").all(workspaceId, limit) as VideoRow[]).map(toLibrary);
}

/** Best performers by views (then likes), for "what already works for you". */
export function topVideos(workspaceId: string, limit = 10): LibraryVideo[] {
  return (
    db().prepare("SELECT * FROM social_videos WHERE workspace_id = ? ORDER BY COALESCE(views, -1) DESC, COALESCE(likes, -1) DESC LIMIT ?").all(workspaceId, limit) as VideoRow[]
  ).map(toLibrary);
}

const STOP = new Set("the and for with your you our are how what why when who can this that from into about best near more most have has not but all any".split(" "));
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9À-ɏ一-鿿\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/**
 * The owner's videos most related to a topic (e.g. an article's title and keywords), by word overlap
 * with each video's title, caption and transcript. Videos with no overlap are left out.
 */
export function relevantVideos(workspaceId: string, topic: string, limit = 8): LibraryVideo[] {
  const want = words(topic);
  if (!want.size) return [];
  const rows = db().prepare("SELECT * FROM social_videos WHERE workspace_id = ? ORDER BY published_at DESC LIMIT 300").all(workspaceId) as VideoRow[];
  return rows
    .map((v) => {
      const title = words(`${v.title} ${v.caption}`);
      const body = words(v.transcript ?? "");
      let score = 0;
      for (const w of want) score += (title.has(w) ? 3 : 0) + (body.has(w) ? 1 : 0);
      return { v, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.v.published_at ?? "0") - Date.parse(a.v.published_at ?? "0"))
    .slice(0, limit)
    .map((x) => toLibrary(x.v));
}
