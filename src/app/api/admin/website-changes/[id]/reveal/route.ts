import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { revealPassword } from "@/lib/webcare";

export const runtime = "nodejs";

/** Admins only: decrypts the website password for one round, on request, and records who looked. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  const row = db().prepare("SELECT workspace_id FROM website_change_requests WHERE id = ?").get(id) as { workspace_id: string } | undefined;
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let password: string | null;
  try {
    password = revealPassword(row.workspace_id, user.id, id);
  } catch (e) {
    console.warn("[webcare] couldn't decrypt a website password:", (e as Error).name);
    return NextResponse.json({ error: "The saved password can't be read. Ask the owner to save it again." }, { status: 500 });
  }
  if (!password) return NextResponse.json({ error: "No password saved for this business." }, { status: 404 });
  return NextResponse.json({ password }, { headers: { "cache-control": "no-store" } });
}
