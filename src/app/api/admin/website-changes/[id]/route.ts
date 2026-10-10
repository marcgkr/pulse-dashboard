import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db, now, type WebsiteChangeRow } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";

export const runtime = "nodejs";

const STATUSES: WebsiteChangeRow["status"][] = ["submitted", "in_progress", "done"];

/** The team moves a round along and leaves a note the owner sees. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user || !isAdmin(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const { id } = await params;
    const row = db().prepare("SELECT status, done_at FROM website_change_requests WHERE id = ?").get(id) as Pick<WebsiteChangeRow, "status" | "done_at"> | undefined;
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { status, note } = await readJson<{ status?: unknown; note?: unknown }>(req, 8_000);
    if (!STATUSES.includes(status as WebsiteChangeRow["status"])) return NextResponse.json({ error: "Pick a status." }, { status: 400 });
    const text = String(note ?? "").trim().slice(0, 2000);
    const doneAt = status === "done" ? (row.done_at ?? now()) : null;
    db().prepare("UPDATE website_change_requests SET status = ?, admin_note = ?, done_at = ? WHERE id = ?").run(status, text, doneAt, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
