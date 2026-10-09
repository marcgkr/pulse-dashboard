import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiWorkspace } from "@/lib/auth";
import { discoverAccounts } from "@/lib/connectors";
import { ConnectorError } from "@/lib/connectors/http";
import { appUrl, exchangeCode, GOOGLE_SCOPE_ADS, GOOGLE_SCOPE_GSC, isProvider, openState, providerSetup, stateCookieName, type Provider } from "@/lib/connectors/oauth";
import { replaceAccounts, saveConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(provider: Provider | null, query: string) {
  const res = NextResponse.redirect(`${appUrl()}/app/settings/connections?${query}${provider ? `&provider=${provider}` : ""}`, 303);
  // The state cookie is single use.
  if (provider) res.cookies.set(stateCookieName(provider), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/connect", maxAge: 0 });
  return res;
}

// Google or Facebook sends the owner back here after they approve (or cancel).
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return back(null, "error=unknown");
  const url = new URL(req.url);
  const jar = await cookies();
  const st = openState(jar.get(stateCookieName(provider))?.value, provider, url.searchParams.get("state"));
  if (!st) return back(provider, "error=state");

  // The flow must finish in the same login and business that started it.
  const auth = await apiWorkspace();
  if (!auth || auth.ws.id !== st.w || auth.user.id !== st.u) return back(provider, "error=state");
  if (url.searchParams.get("error")) return back(provider, "error=denied");
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096) return back(provider, "error=state");
  if (!providerSetup(provider).ready) return back(provider, "error=not_ready");

  try {
    const tokens = await exchangeCode(provider, code, st.v);
    const conn = saveConnection(auth.ws.id, provider, tokens);
    const { accounts, failed } = await discoverAccounts(provider, tokens.access_token, tokens.scopes);
    replaceAccounts(auth.ws.id, conn.id, accounts, auth.ws.website);
    if (provider === "google" && !tokens.scopes.includes(GOOGLE_SCOPE_GSC) && !tokens.scopes.includes(GOOGLE_SCOPE_ADS)) return back(provider, "connected=1&warn=scopes");
    if (failed.length) return back(provider, "connected=1&warn=discover");
    return back(provider, "connected=1");
  } catch (e) {
    const detail = e instanceof ConnectorError ? `${e.code}: ${e.message}` : (e as Error)?.message?.slice(0, 200);
    console.warn(`[connect ${provider}] callback failed for workspace ${auth.ws.id}: ${detail}`);
    return back(provider, "error=exchange");
  }
}
