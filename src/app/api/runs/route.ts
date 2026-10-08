import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { RunError, startRun } from "@/lib/runs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { agent?: string; input?: unknown; parentRunId?: string };
  try {
    const run = startRun(auth.ws, body.agent ?? "", body.input ?? {}, body.parentRunId);
    return NextResponse.json({ id: run.id });
  } catch (e) {
    if (e instanceof RunError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
