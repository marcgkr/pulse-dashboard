import { aiEnabled } from "./ai";
import { planById } from "./config";
import { db, type RunRow, type WorkspaceRow } from "./db";
import { startRun } from "./runs";

// Pro autopilot: Site Doctor re-checks the website every week and AI Visibility re-asks the owner's
// last questions every month, with no one clicking. Autopilot reports use the plan's monthly
// allowance like any other, and stop when it runs out.

const DAY = 24 * 60 * 60 * 1000;
export const SITE_EVERY_DAYS = 7;
export const VISIBILITY_EVERY_DAYS = 30;
const STARTS_PER_TICK = 10;
const TICK_MS = 60 * 60 * 1000;

type Due = { ws: WorkspaceRow; agent: "site" | "visibility"; input: unknown };

/** Businesses on a plan with autopilot that haven't switched it off, carrying the account's plan. */
function autopilotWorkspaces(): WorkspaceRow[] {
  const all = db().prepare("SELECT * FROM workspaces ORDER BY owner_id, created_at, id").all() as WorkspaceRow[];
  const out: WorkspaceRow[] = [];
  let owner = "";
  let primary: WorkspaceRow | null = null;
  let n = 0;
  for (const w of all) {
    if (w.owner_id !== owner) {
      owner = w.owner_id;
      primary = w;
      n = 0;
    }
    n++;
    const plan = planById(primary!.plan);
    if (!plan.autopilot || n > plan.businesses || w.autopilot === 0) continue;
    out.push({ ...w, plan: primary!.plan });
  }
  return out;
}

/** What autopilot would start right now. */
export function dueRuns(now = Date.now()): Due[] {
  const due: Due[] = [];
  const latest = db().prepare("SELECT * FROM runs WHERE workspace_id = ? AND agent = ? ORDER BY created_at DESC LIMIT 1");
  const latestDone = db().prepare("SELECT * FROM runs WHERE workspace_id = ? AND agent = ? AND status = 'done' ORDER BY created_at DESC LIMIT 1");
  for (const ws of autopilotWorkspaces()) {
    // Any recent site run counts, failed ones too, so a site that's down isn't retried every hour.
    const site = latest.get(ws.id, "site") as RunRow | undefined;
    if (ws.website && (!site || now - Date.parse(site.created_at) >= SITE_EVERY_DAYS * DAY)) {
      due.push({ ws, agent: "site", input: { url: ws.website } });
    }
    // AI Visibility needs the owner's questions, so it only repeats a check they've run before.
    const vis = latest.get(ws.id, "visibility") as RunRow | undefined;
    const visDone = latestDone.get(ws.id, "visibility") as RunRow | undefined;
    if (visDone && vis && now - Date.parse(vis.created_at) >= VISIBILITY_EVERY_DAYS * DAY) {
      due.push({ ws, agent: "visibility", input: JSON.parse(visDone.input_json) });
    }
  }
  return due;
}

/** Starts what's due, a few at a time. Returns the run ids started. */
export function runAutopilot(now = Date.now()): string[] {
  if (!aiEnabled()) return [];
  const started: string[] = [];
  for (const d of dueRuns(now)) {
    if (started.length >= STARTS_PER_TICK) break;
    try {
      const run = startRun(d.ws, d.agent, d.input);
      db().prepare("UPDATE runs SET title = ? WHERE id = ?").run(`Autopilot: ${run.title}`.slice(0, 200), run.id);
      started.push(run.id);
    } catch (e) {
      // Out of reports, already running, or the server is busy: try again next hour.
      console.warn(`[autopilot] ${d.agent} for ${d.ws.id} not started:`, (e as Error).message);
    }
  }
  if (started.length) console.log(`[autopilot] started ${started.length} report(s)`);
  return started;
}

/** Called once at server start (src/instrumentation.ts). */
export function startAutopilot() {
  const g = globalThis as unknown as { __autopilot?: boolean };
  if (g.__autopilot || process.env.AUTOPILOT === "off") return;
  g.__autopilot = true;
  const tick = () => {
    try {
      runAutopilot();
    } catch (e) {
      console.error("[autopilot] tick failed", e);
    }
  };
  setTimeout(tick, 2 * 60 * 1000).unref();
  setInterval(tick, TICK_MS).unref();
}
