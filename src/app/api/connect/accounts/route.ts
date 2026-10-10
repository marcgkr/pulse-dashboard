import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { ConnectorError } from "@/lib/connectors/http";
import { isProvider } from "@/lib/connectors/oauth";
import { setSelected, type AccountKind } from "@/lib/connectors/store";

export const runtime = "nodejs";

const KINDS: Record<string, AccountKind[]> = { google: ["google_ads", "search_console"], meta: ["meta_ads"] };

// Chooses which connected ad accounts / Search Console property the specialists read.
export async function POST(req: Request) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (auth.ws.plan === "free") return NextResponse.json({ error: "Connecting accounts is part of the paid plans." }, { status: 402 });
  let body: { provider?: unknown; kind?: unknown; ids?: unknown };
  try {
    body = await readJson(req);
  } catch (e) {
    return errorResponse(e);
  }
  const provider = body.provider;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown connection." }, { status: 400 });
  const kind = KINDS[provider].find((k) => k === body.kind);
  if (!kind) return NextResponse.json({ error: "Unknown account type." }, { status: 400 });
  if (!Array.isArray(body.ids) || body.ids.length > 200 || !body.ids.every((x) => typeof x === "string" && x.length > 0 && x.length <= 500)) {
    return NextResponse.json({ error: "Pick accounts from the list." }, { status: 400 });
  }
  try {
    const selected = setSelected(auth.ws.id, provider, kind, body.ids as string[]);
    return NextResponse.json({ ok: true, selected });
  } catch (e) {
    if (e instanceof ConnectorError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
