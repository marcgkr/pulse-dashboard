import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { rateLimit } from "@/lib/http";
import { hasSocialAccounts, syncSocialVideos } from "@/lib/social-sync";

export const runtime = "nodejs";

// "Read my posts now" on Connected accounts. Runs in the background; the page refreshes to show counts.
export async function POST() {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (auth.ws.plan === "free") return NextResponse.json({ error: "Connecting accounts is part of the paid plans." }, { status: 402 });
  if (!hasSocialAccounts(auth.ws.id)) return NextResponse.json({ error: "Tick an Instagram, Facebook, YouTube or TikTok account first." }, { status: 400 });
  if (!rateLimit(`social-sync:${auth.ws.id}`, 6, 60 * 60_000)) return NextResponse.json({ error: "We read your posts a moment ago. Try again in an hour." }, { status: 429 });
  // Wait up to 20 seconds so small accounts show their counts straight away; bigger ones finish in the background.
  const run = syncSocialVideos(auth.ws).catch(() => ({ videos: 0, errors: ["Couldn't read your posts right now."] }));
  const r = await Promise.race([run, new Promise<null>((res) => setTimeout(() => res(null), 20_000))]);
  return NextResponse.json({ ok: true, done: r !== null, errors: r?.errors ?? [] });
}
