import { NextResponse } from "next/server";
import { currentUser, ownedWorkspaces } from "@/lib/auth";
import { outletLimit } from "@/lib/config";
import { db } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";

/** Opens another of the owner's businesses (Pro). */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    const { id } = await readJson<{ id?: unknown }>(req, 1000);
    const owned = ownedWorkspaces(user.id);
    const allowed = owned.slice(0, owned[0] ? outletLimit(owned[0]) : 0);
    if (!allowed.some((w) => w.id === id)) return NextResponse.json({ error: "That business isn't on your plan." }, { status: 404 });
    db().prepare("UPDATE users SET current_workspace_id = ? WHERE id = ?").run(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
