import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { endPromo } from "@/lib/promos";

/** Admin: end one account's promo access now. They go back to the plan they pay for. */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || !isAdmin(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const { workspaceId } = await readJson<{ workspaceId?: unknown }>(req, 1000);
    if (typeof workspaceId !== "string") return NextResponse.json({ error: "Bad request." }, { status: 400 });
    endPromo(workspaceId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
