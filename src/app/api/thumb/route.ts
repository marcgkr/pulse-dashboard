import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/http";
import { safeFetch } from "@/lib/safe-fetch";
import { parseSocialLink, youtubeId } from "@/lib/social-links";

// Cover image for a TikTok or YouTube post, looked up when the report is viewed. TikTok's image
// links expire after a while, so we don't store them in the report; we ask TikTok's public
// oEmbed endpoint and redirect, remembering the answer for a few hours.

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; image: string | null }>();

export async function GET(req: Request) {
  const link = parseSocialLink(new URL(req.url).searchParams.get("url"));
  if (!link?.thumb) return new NextResponse(null, { status: 404 });

  if (link.platform === "YouTube") {
    const id = youtubeId(new URL(link.url));
    return id ? redirect(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`) : new NextResponse(null, { status: 404 });
  }

  const hit = cache.get(link.url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.image ? redirect(hit.image) : new NextResponse(null, { status: 404 });
  if (!rateLimit(`thumb:${clientIp(req)}`, 120, 10 * 60 * 1000)) return new NextResponse(null, { status: 429 });

  let image: string | null = null;
  try {
    const r = await safeFetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link.url)}`, { timeoutMs: 6000, maxBytes: 200_000 });
    if (r.ok) {
      const t = (JSON.parse(r.body) as { thumbnail_url?: unknown }).thumbnail_url;
      if (typeof t === "string" && t.startsWith("https://")) image = t;
    }
  } catch {
    image = null;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(link.url, { at: Date.now(), image });
  return image ? redirect(image) : new NextResponse(null, { status: 404 });
}

function redirect(to: string) {
  return NextResponse.redirect(to, { status: 302, headers: { "Cache-Control": "public, max-age=3600" } });
}
