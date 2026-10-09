import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { isProvider, revokeToken } from "@/lib/connectors/oauth";
import { connectionTokens, deleteConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";

// Deletes the stored tokens and account list, then asks the provider to revoke access (best effort).
export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown connection." }, { status: 404 });
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const removed = deleteConnection(auth.ws.id, provider);
  if (removed) {
    const t = connectionTokens(removed);
    // Revoking a Google refresh token also revokes its access tokens.
    const token = provider === "google" ? (t.refresh ?? t.access) : t.access;
    if (token) await revokeToken(provider, token);
  }
  return NextResponse.json({ ok: true });
}
