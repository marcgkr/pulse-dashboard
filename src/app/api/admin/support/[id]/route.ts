import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";
import { cleanSupportBody, postTeamReply, teamThread } from "@/lib/support";

export const runtime = "nodejs";

async function admin() {
  const user = await currentUser();
  return user && isAdmin(user) ? user : null;
}

function exists(workspaceId: string): boolean {
  return Boolean(db().prepare("SELECT 1 FROM workspaces WHERE id = ?").get(workspaceId));
}

/** One business's Help thread for the team. The inbox polls this; reading it marks the owner's messages as read. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  if (!exists(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ messages: teamThread(id) }, { headers: { "cache-control": "no-store" } });
}

/** The team replies. The owner sees it on their Help page. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  if (!exists(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let raw: { body?: unknown };
  try {
    raw = await readJson(req);
  } catch (e) {
    return errorResponse(e);
  }
  const clean = cleanSupportBody(raw.body);
  if ("error" in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  return NextResponse.json({ message: postTeamReply(id, user.id, clean.body) });
}
