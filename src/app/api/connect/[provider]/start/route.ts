import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { rateLimit } from "@/lib/http";
import { appUrl, authorizeUrl, isProvider, newOAuthState, providerSetup, sealState, STATE_TTL_SECONDS, stateCookieName } from "@/lib/connectors/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (query: string) => NextResponse.redirect(`${appUrl()}/app/settings/connections?${query}`, 303);

// Starts Google or Meta sign-in: a sealed, short-lived, httpOnly cookie holds the state and PKCE verifier.
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return back("error=unknown");
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.redirect(`${appUrl()}/login`, 303);
  if (!providerSetup(provider).ready) return back(`error=not_ready&provider=${provider}`);
  if (!rateLimit(`connect:${auth.user.id}`, 10, 10 * 60_000)) return back(`error=busy&provider=${provider}`);

  const { state, challenge } = newOAuthState(provider, auth.ws.id, auth.user.id);
  const res = NextResponse.redirect(authorizeUrl(provider, state.s, challenge), 303);
  res.cookies.set(stateCookieName(provider), sealState(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax so the cookie comes back on the top-level redirect from Google or Facebook.
    sameSite: "lax",
    path: "/api/connect",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
