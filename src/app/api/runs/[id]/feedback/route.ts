import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { db, type RunRow } from "@/lib/db";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { clearFeedbackItem, COMMENT_MAX, saveFeedback, type Verdict } from "@/lib/memory";

const VERDICTS: Verdict[] = ["approve", "reject", "comment"];

// Owner feedback on one item in a report (an idea, a finding) or on the whole report (item "").
// The specialist reads it before its next run.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await apiWorkspace();
    if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    if (!rateLimit(`feedback:${auth.ws.id}`, 120, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many changes in a short time. Try again in a few minutes." }, { status: 429 });
    }
    const { id } = await params;
    const run = db().prepare("SELECT id, agent FROM runs WHERE id = ? AND workspace_id = ?").get(id, auth.ws.id) as Pick<RunRow, "id" | "agent"> | undefined;
    if (!run) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const body = await readJson<{ item?: unknown; verdict?: unknown; comment?: unknown }>(req, 8000);
    const item = String(body.item ?? "");
    const comment = String(body.comment ?? "");
    if (body.verdict === null || body.verdict === "clear") {
      clearFeedbackItem(auth.ws.id, run.id, item);
      return NextResponse.json({ ok: true });
    }
    const verdict = VERDICTS.find((v) => v === body.verdict);
    if (!verdict) return NextResponse.json({ error: "Choose approve, comment or reject." }, { status: 400 });
    if (comment.length > COMMENT_MAX) return NextResponse.json({ error: `Keep comments under ${COMMENT_MAX} characters.` }, { status: 400 });
    if (verdict === "comment" && !comment.trim()) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });

    const saved = saveFeedback({ workspaceId: auth.ws.id, agent: run.agent, runId: run.id, item, verdict, comment });
    return NextResponse.json({ item: saved.item, verdict: saved.verdict, comment: saved.comment });
  } catch (e) {
    return errorResponse(e);
  }
}
