import { NextResponse, type NextRequest } from "next/server";

// Rejects cross-site writes. Session cookies are SameSite=Lax already; this also covers
// sibling subdomains and requests that slip through as "simple" form posts.
export function middleware(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return NextResponse.next();
  if (req.nextUrl.pathname === "/api/billing/webhook") return NextResponse.next(); // Stripe, verified by signature
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

export const config = { matcher: "/api/:path*" };
