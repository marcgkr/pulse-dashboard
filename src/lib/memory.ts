import { db, id, now, type FeedbackRow } from "./db";

// What each specialist remembers about a business: the owner's approvals, rejections and comments
// on past reports. Fed into the specialist's next run through businessContext (src/lib/ai.ts).

export const COMMENT_MAX = 1000;
const ITEM_MAX = 300;
/** How many notes a specialist reads before a run. Newest first. */
const NOTES_PER_RUN = 40;

export type Verdict = FeedbackRow["verdict"];

export function feedbackForRun(workspaceId: string, runId: string): FeedbackRow[] {
  return db().prepare("SELECT * FROM feedback WHERE workspace_id = ? AND run_id = ? ORDER BY updated_at").all(workspaceId, runId) as FeedbackRow[];
}

export function feedbackForWorkspace(workspaceId: string): FeedbackRow[] {
  return db().prepare("SELECT * FROM feedback WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 500").all(workspaceId) as FeedbackRow[];
}

/** Saves one verdict per item per report. A new verdict on the same item replaces the old one. */
export function saveFeedback(f: { workspaceId: string; agent: string; runId: string; item: string; verdict: Verdict; comment: string }): FeedbackRow {
  const item = f.item.trim().slice(0, ITEM_MAX);
  const comment = f.comment.trim().slice(0, COMMENT_MAX);
  const t = now();
  db()
    .prepare(
      `INSERT INTO feedback (id, workspace_id, agent, run_id, item, verdict, comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (workspace_id, run_id, item) DO UPDATE SET verdict = excluded.verdict, comment = excluded.comment, updated_at = excluded.updated_at`,
    )
    .run(id("fb_"), f.workspaceId, f.agent, f.runId, item, f.verdict, comment, t, t);
  return db().prepare("SELECT * FROM feedback WHERE workspace_id = ? AND run_id = ? AND item = ?").get(f.workspaceId, f.runId, item) as FeedbackRow;
}

export function deleteFeedback(workspaceId: string, feedbackId: string) {
  db().prepare("DELETE FROM feedback WHERE id = ? AND workspace_id = ?").run(feedbackId, workspaceId);
}

export function clearFeedbackItem(workspaceId: string, runId: string, item: string) {
  db().prepare("DELETE FROM feedback WHERE workspace_id = ? AND run_id = ? AND item = ?").run(workspaceId, runId, item.trim().slice(0, ITEM_MAX));
}

function line(f: FeedbackRow): string {
  const about = f.item ? `"${f.item}"` : "the whole report";
  const note = f.comment ? `: ${f.comment}` : "";
  if (f.verdict === "approve") return `- Liked ${about}${note}`;
  if (f.verdict === "reject") return `- Rejected ${about}${note || " (no reason given)"}`;
  return `- Comment on ${about}${note}`;
}

/**
 * The owner's notes for one specialist, as prompt text. Empty when there are none.
 * Approvals without a comment are kept short: they only tell the agent what landed.
 */
export function memoryFor(workspaceId: string, agent: string): string {
  const rows = db()
    .prepare("SELECT * FROM feedback WHERE workspace_id = ? AND agent = ? ORDER BY updated_at DESC LIMIT ?")
    .all(workspaceId, agent, NOTES_PER_RUN) as FeedbackRow[];
  return rows.map(line).join("\n");
}
