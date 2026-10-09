import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/http";

// Runs before every page and API request.
// 1. Per-address request limits, so one machine (or a few) can't flood the server.
// 2. Rejects cross-site writes to the API.

const WINDOW_MS = 60_000;
const num = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d);
// Per address per minute. Generous enough for an office of people sharing one address; a
// report page polls about 30 times a minute while a specialist works.
const LIMITS = { api: num(process.env.RATE_LIMIT_API_PER_MIN, 300), page: num(process.env.RATE_LIMIT_PAGES_PER_MIN, 240) };

// Fixed one-minute windows: one small entry per address, cleared as windows end.
const g = globalThis as unknown as { __reqCounts?: Map<string, { start: number; n: number }> };
const counts = (g.__reqCounts ??= new Map());

function overLimit(key: string, limit: number, now: number): boolean {
  const c = counts.get(key);
  if (!c || now - c.start >= WINDOW_MS) {
    if (counts.size > 100_000) for (const [k, v] of counts) if (now - v.start >= WINDOW_MS) counts.delete(k);
    counts.set(key, { start: now, n: 1 });
    return false;
  }
  c.n++;
  return c.n > limit;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // Railway's health check and Stripe's signed webhooks skip the limits.
  if (path !== "/api/health" && path !== "/api/billing/webhook") {
    const kind = isApi ? "api" : "page";
    if (overLimit(`${kind}:${clientIp(req)}`, LIMITS[kind], Date.now())) {
      const body = "Too many requests from your network. Wait a minute and try again.";
      return isApi
        ? NextResponse.json({ error: body }, { status: 429, headers: { "Retry-After": "60" } })
        : new NextResponse(body, { status: 429, headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" } });
    }
  }

  if (!isApi || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return NextResponse.next();
  if (path === "/api/billing/webhook") return NextResponse.next(); // Stripe, verified by signature

  // Rejects cross-site writes. Session cookies are SameSite=Lax already; this also covers
  // sibling subdomains and requests that slip through as "simple" form posts.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* treated as a mismatch */
    }
    if (originHost !== host) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  } else if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  return NextResponse.next();
}

// Everything except build assets and files with an extension (images, fonts, icons).
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
  runtime: "nodejs",
};
