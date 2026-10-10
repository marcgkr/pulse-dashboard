import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { PLANS } from "@/lib/config";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { workspaceId, plan, outlets, webcare } = (await req.json().catch(() => ({}))) as { workspaceId?: string; plan?: string; outlets?: unknown; webcare?: unknown };
  if (!workspaceId) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (plan !== undefined) {
    if (!PLANS.some((p) => p.id === plan)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    db().prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(plan, workspaceId);
  }
  // Extra outlets on top of the one Pro includes (comped, or fixing a billing mismatch).
  if (outlets !== undefined) {
    const n = Number(outlets);
    if (!Number.isInteger(n) || n < 0 || n > 50) return NextResponse.json({ error: "Outlets must be 0 to 50." }, { status: 400 });
    db().prepare("UPDATE workspaces SET extra_outlets = ? WHERE id = ?").run(n, workspaceId);
  }
  // Website changes add-on (comped, or fixing a billing mismatch). It only counts on Growth and Pro.
  if (webcare !== undefined) {
    if (typeof webcare !== "boolean") return NextResponse.json({ error: "Bad request." }, { status: 400 });
    // A free grant, kept apart from the Stripe-backed flag so a renewal doesn't switch it off.
    db().prepare("UPDATE workspaces SET webcare_comp = ? WHERE id = ?").run(webcare ? 1 : 0, workspaceId);
  }
  return NextResponse.json({ ok: true });
}
