import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { BRAND } from "@/lib/config";
import { encryptionReady } from "@/lib/crypto";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { loginSummary, saveLogin, webcareActive } from "@/lib/webcare";

export const runtime = "nodejs";

/** Saves or replaces the website login PULSE uses. The password is never sent back. */
export async function POST(req: Request) {
  try {
    const auth = await apiWorkspace();
    if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    if (!webcareActive(auth.ws)) return NextResponse.json({ error: "Add website changes by PULSE first." }, { status: 402 });
    if (!encryptionReady()) {
      console.warn("[webcare] ENCRYPTION_KEY is not set, so website logins can't be saved");
      return NextResponse.json({ error: `We can't store login details safely right now. Email ${BRAND.contactEmail} and we'll sort it out.` }, { status: 503 });
    }
    if (!rateLimit(`webcare-login:${auth.user.id}`, 20, 3_600_000)) return NextResponse.json({ error: "Too many changes in the last hour. Try again later." }, { status: 429 });
    const raw = await readJson<{ loginUrl?: unknown; username?: unknown; password?: unknown; notes?: unknown }>(req, 8_000);
    const saved = saveLogin(auth.ws.id, raw);
    if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
    return NextResponse.json({ ok: true, login: loginSummary(auth.ws.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
