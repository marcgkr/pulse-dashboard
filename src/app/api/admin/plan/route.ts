import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { PLANS } from "@/lib/config";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { workspaceId, plan } = (await req.json().catch(() => ({}))) as { workspaceId?: string; plan?: string };
  if (!workspaceId || !PLANS.some((p) => p.id === plan)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  db().prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(plan, workspaceId);
  return NextResponse.json({ ok: true });
}
