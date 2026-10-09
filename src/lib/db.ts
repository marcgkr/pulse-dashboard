import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "marketingrx.db");

declare global {
  // eslint-disable-next-line no-var
  var __pulserxDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function db(): Database.Database {
  if (!global.__pulserxDb) global.__pulserxDb = open();
  return global.__pulserxDb;
}

/**
 * Runs execute inside the web server process, so anything still marked as working when the
 * server starts was cut off by a restart. Called once from src/instrumentation.ts.
 */
export function recoverInterruptedRuns() {
  db()
    .prepare("UPDATE runs SET status = 'error', error = 'This run was interrupted by a server restart. Run it again.', finished_at = ? WHERE status IN ('queued','running')")
    .run(new Date().toISOString());
}

export function id(prefix = ""): string {
  return prefix + crypto.randomBytes(9).toString("base64url");
}

export function now(): string {
  return new Date().toISOString();
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      website TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT 'Singapore',
      audience TEXT NOT NULL DEFAULT '',
      offers TEXT NOT NULL DEFAULT '',
      competitors TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT '',
      monthly_budget TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT '',
      regulated INTEGER NOT NULL DEFAULT 0,
      plan TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      windsor_api_key TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      agent TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      input_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      progress TEXT NOT NULL DEFAULT '',
      result_json TEXT,
      score INTEGER,
      error TEXT,
      demo INTEGER NOT NULL DEFAULT 0,
      parent_run_id TEXT,
      created_at TEXT NOT NULL,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS runs_ws ON runs(workspace_id, agent, created_at);
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
      agent TEXT NOT NULL,
      title TEXT NOT NULL,
      diagnosis TEXT NOT NULL DEFAULT '',
      steps_json TEXT NOT NULL DEFAULT '[]',
      where_to TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      impact TEXT NOT NULL DEFAULT 'medium',
      effort TEXT NOT NULL DEFAULT 'quick',
      category TEXT NOT NULL DEFAULT '',
      recheck_days INTEGER NOT NULL DEFAULT 14,
      status TEXT NOT NULL DEFAULT 'todo',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS tasks_ws ON tasks(workspace_id, status);
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS score_history (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      score INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, day)
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      ref TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS usage_ws ON usage_events(workspace_id, kind, created_at);
  `);
  addColumn(db, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "workspaces", "stripe_subscription_id", "TEXT");
  addColumn(db, "workspaces", "country", "TEXT NOT NULL DEFAULT 'SG'");
}

function addColumn(db: Database.Database, table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// ---------- Row types ----------

export type UserRow = { id: string; email: string; name: string; password_hash: string; is_admin: number; created_at: string };

export type WorkspaceRow = {
  id: string;
  owner_id: string;
  name: string;
  website: string;
  industry: string;
  location: string;
  country: string;
  audience: string;
  offers: string;
  competitors: string;
  goals: string;
  monthly_budget: string;
  tone: string;
  regulated: number;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id?: string | null;
  windsor_api_key: string | null;
  created_at: string;
};

export type RunRow = {
  id: string;
  workspace_id: string;
  agent: string;
  title: string;
  input_json: string;
  status: "queued" | "running" | "done" | "error";
  progress: string;
  result_json: string | null;
  score: number | null;
  error: string | null;
  demo: number;
  parent_run_id: string | null;
  created_at: string;
  finished_at: string | null;
};

export type TaskRow = {
  id: string;
  workspace_id: string;
  run_id: string | null;
  agent: string;
  title: string;
  diagnosis: string;
  steps_json: string;
  where_to: string;
  priority: "urgent" | "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  effort: "quick" | "half-day" | "project";
  category: string;
  recheck_days: number;
  status: "todo" | "doing" | "done" | "skipped" | "superseded";
  notes: string;
  created_at: string;
  completed_at: string | null;
};
