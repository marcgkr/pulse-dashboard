import { aiEnabled } from "./ai";
import { planById, LIVE_SYNC_PLANS, type PlanId } from "./config";
import { db, id, now, type RunRow, type TaskRow, type WorkspaceRow } from "./db";
import { getAgent, type AgentResult } from "./agents";
import { envInt } from "./load-guard";
import { memoryFor } from "./memory";

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Start of the current calendar month in Singapore time, as an ISO timestamp. */
export function monthStartSgt(d = new Date()): string {
  const sg = new Date(d.getTime() + SGT_OFFSET_MS);
  return new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), 1) - SGT_OFFSET_MS).toISOString();
}

/** Today's date (YYYY-MM-DD) in Singapore time. */
export function todaySgt(d = new Date()): string {
  return new Date(d.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Counts from usage_events, not runs, so deleting a report doesn't hand back a run. */
export function usedThisMonth(workspaceId: string, kind: "run" | "chat"): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM usage_events WHERE workspace_id = ? AND kind = ? AND created_at >= ?")
    .get(workspaceId, kind, monthStartSgt()) as { n: number };
  return row.n;
}

export function runsThisMonth(workspaceId: string): number {
  return usedThisMonth(workspaceId, "run");
}

export function recordUsage(workspaceId: string, kind: "run" | "chat", ref: string) {
  db().prepare("INSERT INTO usage_events (workspace_id, kind, ref, created_at) VALUES (?, ?, ?, ?)").run(workspaceId, kind, ref, now());
}

const MAX_ACTIVE_RUNS = 2;
const RUN_DEADLINE_MS = 15 * 60 * 1000;

export function usage(ws: WorkspaceRow) {
  const plan = planById(ws.plan);
  const used = runsThisMonth(ws.id);
  return { plan, used, limit: plan.runsPerMonth, left: Math.max(0, plan.runsPerMonth - used) };
}

/** Free plan can only use Site Doctor. */
export function agentAllowed(ws: WorkspaceRow, agentId: string): boolean {
  if (ws.plan !== "free") return true;
  return agentId === "site";
}

export class RunError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function startRun(ws: WorkspaceRow, agentId: string, rawInput: unknown, parentRunId?: string | null): RunRow {
  const agent = getAgent(agentId);
  if (!agent) throw new RunError("Unknown agent.", 404);
  if (!agentAllowed(ws, agentId)) throw new RunError(`${agent.name} is part of the paid plans. Upgrade in Settings to use it.`, 402);

  const live = aiEnabled();
  if (live) {
    const u = usage(ws);
    if (u.left <= 0) throw new RunError(`You've used all ${u.limit} agent runs on the ${u.plan.name} plan this month.`, 402);
  }
  const active = (db().prepare("SELECT COUNT(*) AS n FROM runs WHERE workspace_id = ? AND status IN ('queued','running')").get(ws.id) as { n: number }).n;
  if (active >= MAX_ACTIVE_RUNS) throw new RunError("You already have two checkups running. Wait for one to finish, then try again.", 429);

  // Server-wide caps, so a burst of sign-ups can't run up the AI bill or overload the server.
  const running = (db().prepare("SELECT COUNT(*) AS n FROM runs WHERE status IN ('queued','running')").get() as { n: number }).n;
  if (running >= envInt("RUNS_MAX_CONCURRENT", 24)) throw new RunError("The specialists are busy right now. Try again in a minute.", 503);
  if (live && ws.plan === "free") {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const freeRuns = (
      db()
        .prepare("SELECT COUNT(*) AS n FROM usage_events u JOIN workspaces w ON w.id = u.workspace_id WHERE u.kind = 'run' AND u.created_at >= ? AND w.plan = 'free'")
        .get(hourAgo) as { n: number }
    ).n;
    if (freeRuns >= envInt("FREE_RUNS_PER_HOUR", 120)) {
      throw new RunError("Free checkups are very busy right now. Try again later, or upgrade to skip the queue.", 503);
    }
  }

  const source = (rawInput as { source?: unknown } | null)?.source;
  if (agent.id === "ads" && (source === "windsor" || source === "live") && !LIVE_SYNC_PLANS.includes(ws.plan as PlanId)) {
    throw new RunError("Live ad sync is on the Growth and Pro plans. Upload your Google or Meta exports instead, or upgrade in Settings.", 402);
  }

  let input: unknown;
  try {
    input = agent.parseInput(rawInput, ws);
  } catch (e) {
    throw new RunError((e as Error).message);
  }

  const run: RunRow = {
    id: id("r_"),
    workspace_id: ws.id,
    agent: agent.id,
    title: agent.runTitle(input, ws),
    input_json: JSON.stringify(input),
    status: "queued",
    progress: "Starting",
    result_json: null,
    score: null,
    error: null,
    demo: live ? 0 : 1,
    parent_run_id: parentRunId ?? null,
    created_at: now(),
    finished_at: null,
  };
  db()
    .prepare(
      `INSERT INTO runs (id, workspace_id, agent, title, input_json, status, progress, demo, parent_run_id, created_at)
       VALUES (@id, @workspace_id, @agent, @title, @input_json, @status, @progress, @demo, @parent_run_id, @created_at)`,
    )
    .run(run);
  if (live) recordUsage(ws.id, "run", run.id);

  // Fire and forget. The UI polls the run row for progress.
  void execute(run.id, ws, input, live);
  return run;
}

export async function execute(runId: string, ws: WorkspaceRow, input: unknown, live: boolean) {
  const run = db().prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RunRow;
  const agent = getAgent(run.agent)!;
  const setProgress = (msg: string) => db().prepare("UPDATE runs SET progress = ? WHERE id = ?").run(msg.slice(0, 200), runId);
  db().prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(runId);
  let result: AgentResult;
  let timer: NodeJS.Timeout | undefined;
  try {
    // Each specialist reads what the owner told it about its past reports.
    const ctx = { ws: { ...ws, owner_notes: memoryFor(ws.id, agent.id) }, runId, progress: setProgress };
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("This checkup took too long and was stopped. Try again, or try a smaller input.")), RUN_DEADLINE_MS);
    });
    result = await Promise.race([live ? agent.run(input, ctx) : agent.demo(input, ctx), deadline]);
  } catch (e) {
    console.error(`[run ${runId}] ${agent.id} failed`, e);
    db()
      .prepare("UPDATE runs SET status = 'error', error = ?, finished_at = ? WHERE id = ? AND status = 'running'")
      .run(friendlyError(e), now(), runId);
    // Failed runs don't use up the plan's allowance.
    db().prepare("DELETE FROM usage_events WHERE kind = 'run' AND ref = ?").run(runId);
    return;
  } finally {
    clearTimeout(timer);
  }

  const saved = db()
    .prepare("UPDATE runs SET status = 'done', progress = '', result_json = ?, score = ?, demo = ?, finished_at = ? WHERE id = ? AND status = 'running'")
    // Reports on built-in sample data keep their score inside the report but never feed the Pulse Score.
    .run(JSON.stringify(result), result.sample ? null : (result.score ?? null), result.demo ? 1 : 0, now(), runId);
  if (saved.changes === 0) return; // deleted while running
  try {
    addTasksFromResult(ws.id, run, result);
    recordScore(ws.id);
  } catch (e) {
    console.error(`[run ${runId}] saving prescriptions failed`, e);
  }
}

function friendlyError(e: unknown): string {
  const err = e as { status?: number; message?: string; name?: string };
  if (err?.status === 401) return "The AI service rejected the API key. Check ANTHROPIC_API_KEY.";
  if (err?.status === 429) return "The AI service is busy right now. Try again in a minute.";
  if (err?.status && err.status >= 500) return "The AI service had a problem. Try again in a minute.";
  return err?.message?.slice(0, 400) || "Something went wrong.";
}

// Specialists that diagnose the whole account each time: a new report replaces the untouched
// prescriptions from the previous one, so the board reflects the latest checkup.
const SUPERSEDING_AGENTS = new Set(["site", "ads"]);

const titleKey = (t: string) => t.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

function addTasksFromResult(workspaceId: string, run: RunRow, result: AgentResult) {
  if (result.sample) return; // sample data must never land on the real board
  if (SUPERSEDING_AGENTS.has(run.agent)) {
    db()
      .prepare("UPDATE tasks SET status = 'superseded' WHERE workspace_id = ? AND agent = ? AND status = 'todo' AND (run_id IS NULL OR run_id != ?)")
      .run(workspaceId, run.agent, run.id);
  }
  const open = db()
    .prepare("SELECT title FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing')")
    .all(workspaceId) as { title: string }[];
  const seen = new Set(open.map((r) => titleKey(r.title)));
  const insert = db().prepare(
    `INSERT INTO tasks (id, workspace_id, run_id, agent, title, diagnosis, steps_json, where_to, priority, impact, effort, category, recheck_days, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?)`,
  );
  const tx = db().transaction(() => {
    for (const p of result.prescriptions ?? []) {
      if (!p?.title || seen.has(titleKey(p.title))) continue;
      seen.add(titleKey(p.title));
      insert.run(
        id("t_"),
        workspaceId,
        run.id,
        run.agent,
        p.title,
        p.diagnosis,
        JSON.stringify(p.steps ?? []),
        p.where ?? "",
        p.priority,
        p.impact,
        p.effort,
        p.category ?? "",
        p.recheck_days ?? 14,
        now(),
      );
    }
  });
  tx();
}

// ---------- Pulse Score ----------

export type PulseScore = {
  score: number | null;
  parts: { key: string; label: string; value: number | null; hint: string }[];
};

export function latestRun(workspaceId: string, agent: string): RunRow | null {
  return (
    (db()
      .prepare("SELECT * FROM runs WHERE workspace_id = ? AND agent = ? AND status = 'done' ORDER BY created_at DESC LIMIT 1")
      .get(workspaceId, agent) as RunRow | undefined) ?? null
  );
}

export function pulseScore(workspaceId: string): PulseScore {
  const site = latestRun(workspaceId, "site")?.score ?? null;
  const ads = latestRun(workspaceId, "ads")?.score ?? null;
  const vis = latestRun(workspaceId, "visibility")?.score ?? null;
  const t = db()
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN status IN ('todo','doing') AND priority IN ('urgent','high') THEN 1 ELSE 0 END) AS openHigh,
         COUNT(*) AS total
       FROM tasks WHERE workspace_id = ? AND status NOT IN ('skipped','superseded')`,
    )
    .get(workspaceId) as { done: number | null; openHigh: number | null; total: number };
  const follow = t.total ? Math.round(((t.done ?? 0) / t.total) * 100) : null;

  const parts = [
    { key: "site", label: "Website", value: site, hint: "From Site Doctor" },
    { key: "visibility", label: "AI visibility", value: vis, hint: "From AI Visibility" },
    { key: "ads", label: "Ads health", value: ads, hint: "From Ads Doctor" },
    { key: "follow", label: "Fixes done", value: follow, hint: `${t.done ?? 0} of ${t.total} prescriptions done` },
  ];
  const weights: Record<string, number> = { site: 0.35, visibility: 0.2, ads: 0.25, follow: 0.2 };
  const have = parts.filter((p) => p.value != null);
  if (have.length === 0) return { score: null, parts };
  const wsum = have.reduce((n, p) => n + weights[p.key], 0);
  const score = Math.round(have.reduce((n, p) => n + (p.value as number) * weights[p.key], 0) / wsum);
  return { score, parts };
}

export function recordScore(workspaceId: string) {
  const { score } = pulseScore(workspaceId);
  if (score == null) return;
  const day = todaySgt();
  db()
    .prepare("INSERT INTO score_history (workspace_id, day, score) VALUES (?, ?, ?) ON CONFLICT(workspace_id, day) DO UPDATE SET score = excluded.score")
    .run(workspaceId, day, score);
}

export function parseTask(t: TaskRow) {
  let steps: string[] = [];
  try {
    steps = JSON.parse(t.steps_json);
  } catch {
    /* keep empty */
  }
  return { ...t, steps };
}
