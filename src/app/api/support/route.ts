import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { cleanSupportBody, ownerThread, postOwnerMessage, SUPPORT_PER_HOUR } from "@/lib/support";
import { alertSupportTeam } from "@/lib/whatsapp";

export const runtime = "nodejs";

/** The owner's Help thread. The Help page polls this, and reading it marks team replies as read. */
export async function GET() {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  return NextResponse.json({ messages: ownerThread(auth.ws.id) }, { headers: { "cache-control": "no-store" } });
}

/** The owner writes to the PULSE team. */
export async function POST(req: Request) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { user, ws } = auth;
  let raw: { body?: unknown };
  try {
    raw = await readJson(req);
  } catch (e) {
    return errorResponse(e);
  }
  const clean = cleanSupportBody(raw.body);
  if ("error" in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  if (!rateLimit(`support:${user.id}`, SUPPORT_PER_HOUR, 3_600_000)) {
    return NextResponse.json({ error: "You've sent a lot of messages in the last hour. Wait a while, then send the rest." }, { status: 429 });
  }
  const message = postOwnerMessage(ws.id, user.id, clean.body);
  // Best effort: the message is saved whether or not the alert goes out.
  void alertSupportTeam(ws.id, ws.name, clean.body).catch(() => {});
  return NextResponse.json({ message });
}
