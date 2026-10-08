import { aiEnabled } from "./ai";
import { planById } from "./config";
import { db, id, now, type RunRow, type TaskRow, type WorkspaceRow } from "./db";
import { getAgent, type AgentResult } from "./agents";

export function runsThisMonth(workspaceId: string): number {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM runs WHERE workspace_id = ? AND created_at >= ? AND demo = 0")
    .get(workspaceId, start.toISOString()) as { n: number };
  return row.n;
}

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

  // Fire and forget. The UI polls the run row for progress.
  void execute(run.id, ws, input, live);
  return run;
}

export async function execute(runId: string, ws: WorkspaceRow, input: unknown, live: boolean) {
  const run = db().prepare("SELECT * FROM runs WHERE id = ?").get(runId) as RunRow;
  const agent = getAgent(run.agent)!;
  const setProgress = (msg: string) => db().prepare("UPDATE runs SET progress = ? WHERE id = ?").run(msg.slice(0, 200), runId);
  db().prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(runId);
  try {
    const ctx = { ws, runId, progress: setProgress };
    const result: AgentResult = live ? await agent.run(input, ctx) : await agent.demo(input, ctx);
    db()
      .prepare("UPDATE runs SET status = 'done', progress = '', result_json = ?, score = ?, demo = ?, finished_at = ? WHERE id = ?")
      .run(JSON.stringify(result), result.score ?? null, result.demo ? 1 : 0, now(), runId);
    addTasksFromResult(ws.id, run, result);
    recordScore(ws.id);
  } catch (e) {
    console.error(`[run ${runId}] ${agent.id} failed`, e);
    db()
      .prepare("UPDATE runs SET status = 'error', error = ?, finished_at = ? WHERE id = ?")
      .run(friendlyError(e), now(), runId);
  }
}

function friendlyError(e: unknown): string {
  const err = e as { status?: number; message?: string; name?: string };
  if (err?.status === 401) return "The AI service rejected the API key. Check ANTHROPIC_API_KEY.";
  if (err?.status === 429) return "The AI service is busy right now. Try again in a minute.";
  if (err?.status && err.status >= 500) return "The AI service had a problem. Try again in a minute.";
  return err?.message?.slice(0, 400) || "Something went wrong.";
}

function addTasksFromResult(workspaceId: string, run: RunRow, result: AgentResult) {
  const open = db()
    .prepare("SELECT lower(title) AS t FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing')")
    .all(workspaceId) as { t: string }[];
  const seen = new Set(open.map((r) => r.t));
  const insert = db().prepare(
    `INSERT INTO tasks (id, workspace_id, run_id, agent, title, diagnosis, steps_json, where_to, priority, impact, effort, category, recheck_days, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?)`,
  );
  const tx = db().transaction(() => {
    for (const p of result.prescriptions ?? []) {
      if (!p?.title || seen.has(p.title.toLowerCase())) continue;
      seen.add(p.title.toLowerCase());
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
       FROM tasks WHERE workspace_id = ? AND status != 'skipped'`,
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
  const day = new Date().toISOString().slice(0, 10);
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
