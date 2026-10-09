import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { deleteFeedback } from "@/lib/memory";

/** Forget one note (Settings > What your specialists remember). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { id } = await params;
  deleteFeedback(auth.ws.id, id);
  return NextResponse.json({ ok: true });
}
