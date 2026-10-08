import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { recordScore } from "@/lib/runs";

const STATUSES = ["todo", "doing", "done", "skipped"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string; notes?: string };
  if (body.status && !STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  const res = db()
    .prepare(
      `UPDATE tasks SET
         status = COALESCE(?, status),
         notes = COALESCE(?, notes),
         completed_at = CASE WHEN ? = 'done' THEN ? WHEN ? IS NOT NULL THEN NULL ELSE completed_at END
       WHERE id = ? AND workspace_id = ?`,
    )
    .run(body.status ?? null, body.notes ?? null, body.status ?? null, now(), body.status ?? null, id, auth.ws.id);
  if (res.changes === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  recordScore(auth.ws.id);
  return NextResponse.json({ ok: true });
}
