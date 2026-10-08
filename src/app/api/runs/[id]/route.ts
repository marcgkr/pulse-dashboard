import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { db, type RunRow } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { id } = await params;
  const run = db().prepare("SELECT id, status, progress, error FROM runs WHERE id = ? AND workspace_id = ?").get(id, auth.ws.id) as
    | Pick<RunRow, "id" | "status" | "progress" | "error">
    | undefined;
  if (!run) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(run);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { id } = await params;
  db().prepare("DELETE FROM runs WHERE id = ? AND workspace_id = ?").run(id, auth.ws.id);
  return NextResponse.json({ ok: true });
}
