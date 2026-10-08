import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { db, type RunRow } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";
import { RunError, startRun } from "@/lib/runs";

export const runtime = "nodejs";

// Ads exports can be a few MB; everything else is small.
const MAX_BODY = 16 * 1024 * 1024;

type Body = { agent?: unknown; input?: unknown; parentRunId?: unknown; rerunOf?: unknown };

function ownRun(wsId: string, runId: unknown): RunRow | null {
  if (typeof runId !== "string" || !runId) return null;
  return (db().prepare("SELECT * FROM runs WHERE id = ? AND workspace_id = ?").get(runId, wsId) as RunRow | undefined) ?? null;
}

export async function POST(req: Request) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  try {
    const body = await readJson<Body>(req, MAX_BODY);

    // Re-run with exactly the stored input (keeps large uploads server-side).
    const rerun = ownRun(auth.ws.id, body.rerunOf);
    if (body.rerunOf !== undefined && !rerun) return NextResponse.json({ error: "That report no longer exists." }, { status: 404 });
    if (rerun) {
      const run = startRun(auth.ws, rerun.agent, JSON.parse(rerun.input_json), rerun.parent_run_id);
      return NextResponse.json({ id: run.id });
    }

    // Follow-ups (expand a keyword, more like this) send the parent's input minus the bulky fields
    // the browser never received; fill those back in from the parent run.
    const parent = ownRun(auth.ws.id, body.parentRunId);
    let input = body.input && typeof body.input === "object" ? { ...(body.input as Record<string, unknown>) } : {};
    if (parent && parent.agent === body.agent) {
      const parentInput = JSON.parse(parent.input_json) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parentInput)) if (input[k] === undefined) input[k] = v;
    }
    const run = startRun(auth.ws, String(body.agent ?? ""), input, parent?.id ?? null);
    return NextResponse.json({ id: run.id });
  } catch (e) {
    if (e instanceof RunError) return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
