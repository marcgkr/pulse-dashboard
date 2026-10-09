// Recognises links to social posts so reports can show a thumbnail and play the post in place.
// Client-safe: no server imports.

export type SocialPlatform = "TikTok" | "Instagram" | "YouTube" | "Facebook" | "LinkedIn" | "Xiaohongshu" | "X";

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
  /** Player URL for an iframe, when the platform allows embedding without an account. */
  embed: string | null;
  /** True when /api/thumb can find a cover image for it. */
  thumb: boolean;
  /** Tall (9:16) player for short-form video. */
  vertical: boolean;
};

const HOSTS: [RegExp, SocialPlatform][] = [
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(facebook\.com|fb\.watch)$/, "Facebook"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)(xiaohongshu\.com|xhslink\.com)$/, "Xiaohongshu"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X"],
];

export function parseSocialLink(raw: string | null | undefined): SocialLink | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const platform = HOSTS.find(([re]) => re.test(host))?.[1];
  if (!platform) return null;
  const url = u.toString();

  if (platform === "TikTok") {
    const id = /\/video\/(\d{8,25})/.exec(u.pathname)?.[1];
    return { platform, url, embed: id ? `https://www.tiktok.com/embed/v2/${id}` : null, thumb: true, vertical: true };
  }
  if (platform === "YouTube") {
    const id = youtubeId(u);
    const short = u.pathname.startsWith("/shorts/");
    return { platform, url, embed: id ? `https://www.youtube-nocookie.com/embed/${id}` : null, thumb: Boolean(id), vertical: short };
  }
  if (platform === "Instagram") {
    const m = /^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/.exec(u.pathname);
    const kind = m?.[1] === "reels" ? "reel" : m?.[1];
    return { platform, url, embed: m ? `https://www.instagram.com/${kind}/${m[2]}/embed` : null, thumb: false, vertical: kind === "reel" };
  }
  return { platform, url, embed: null, thumb: false, vertical: false };
}

export function youtubeId(u: URL): string | null {
  const id =
    u.hostname.endsWith("youtu.be") ? u.pathname.slice(1) : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.searchParams.get("v");
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

/** A real post a trend or idea is based on. Numbers are as the research source reported them. */
export type Reference = {
  platform: string;
  /** Link to the post. Null on sample reports. */
  url: string | null;
  /** Account name, e.g. "@cassietj_". */
  creator: string;
  /** View count as the source showed it, e.g. "7,860,584 views". Null when the source didn't say. */
  views: string | null;
  /** When it was posted, as the source showed it. Null when the source didn't say. */
  posted: string | null;
  /** What to borrow from it (structure, opening, format), and what to leave out. */
  borrow: string;
  /** Placeholder on the public sample report: not a real post. */
  sample?: boolean;
};
