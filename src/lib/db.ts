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
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      website TEXT NOT NULL DEFAULT '',
      score INTEGER,
      country TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'checkup',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_user TEXT NOT NULL DEFAULT '',
      scopes TEXT NOT NULL DEFAULT '',
      access_token_enc TEXT,
      refresh_token_enc TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (workspace_id, provider)
    );
    CREATE TABLE IF NOT EXISTS connection_accounts (
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      provider_account_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      currency TEXT,
      selected INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (connection_id, kind, provider_account_id)
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      agent TEXT NOT NULL,
      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
      item TEXT NOT NULL DEFAULT '',
      verdict TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS feedback_ws ON feedback(workspace_id, agent, updated_at);
    CREATE UNIQUE INDEX IF NOT EXISTS feedback_item ON feedback(workspace_id, run_id, item);
    CREATE TABLE IF NOT EXISTS social_videos (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      duration_seconds INTEGER,
      views INTEGER,
      likes INTEGER,
      comments INTEGER,
      transcript TEXT,
      transcript_status TEXT NOT NULL DEFAULT 'none',
      transcript_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, platform, external_id)
    );
    CREATE INDEX IF NOT EXISTS social_videos_recent ON social_videos(workspace_id, published_at);
    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      days INTEGER,
      max_uses INTEGER,
      uses INTEGER NOT NULL DEFAULT 0,
      redeem_by TEXT,
      note TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email TEXT NOT NULL DEFAULT '',
      until TEXT,
      redeemed_at TEXT NOT NULL,
      PRIMARY KEY (code, workspace_id)
    );
    -- Help chat between an owner and the PULSE team (src/lib/support.ts). One thread per business.
    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      seen_by_owner INTEGER NOT NULL DEFAULT 0,
      seen_by_team INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS support_ws ON support_messages(workspace_id, created_at);
    -- Website changes by PULSE (src/lib/webcare.ts): the login the owner shares, password encrypted.
    CREATE TABLE IF NOT EXISTS website_logins (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      login_url TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      password_enc TEXT,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    -- Each round of changes an owner sends. items is a JSON array of { text, detail? }.
    CREATE TABLE IF NOT EXISTS website_change_requests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      items TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL,
      done_at TEXT,
      admin_note TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS website_changes_ws ON website_change_requests(workspace_id, created_at);
    -- Sensitive things admins do, such as revealing a website password.
    CREATE TABLE IF NOT EXISTS admin_audit (
      id TEXT PRIMARY KEY,
      admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      workspace_id TEXT,
      ref TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_audit_ref ON admin_audit(ref, created_at);
  `);
  addColumn(db, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  // Pro accounts can run several businesses; this is the one the owner is looking at.
  addColumn(db, "users", "current_workspace_id", "TEXT");
  // Pro: weekly Site Doctor and monthly AI Visibility re-checks (src/lib/autopilot.ts). On unless switched off.
  addColumn(db, "workspaces", "autopilot", "INTEGER NOT NULL DEFAULT 1");
  // Access from a promo code (src/lib/promos.ts): the plan, until when (null = no end) and which code.
  addColumn(db, "workspaces", "promo_plan", "TEXT");
  addColumn(db, "workspaces", "promo_until", "TEXT");
  addColumn(db, "workspaces", "promo_code", "TEXT");
  // Pro: extra outlets paid for on top of the one included (each a Stripe subscription item unit).
  addColumn(db, "workspaces", "extra_outlets", "INTEGER NOT NULL DEFAULT 0");
  // Last time the owner's own posts were read from their connected social accounts.
  addColumn(db, "workspaces", "videos_synced_at", "TEXT");
  // The connected account (Page, Instagram account, channel) a video came from.
  addColumn(db, "social_videos", "account_id", "TEXT NOT NULL DEFAULT ''");
  // Growth and Pro: "Website changes by PULSE" add-on (a Stripe subscription item, metadata.kind = "webcare").
  addColumn(db, "workspaces", "webcare", "INTEGER NOT NULL DEFAULT 0");
  // When an owner stops the add-on, the month they paid for runs to its end (no refund credit).
  addColumn(db, "workspaces", "webcare_until", "TEXT");
  // Switched on free by an admin. Kept apart from `webcare`, which follows the Stripe subscription.
  addColumn(db, "workspaces", "webcare_comp", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "workspaces", "stripe_subscription_id", "TEXT");
  addColumn(db, "workspaces", "country", "TEXT NOT NULL DEFAULT 'SG'");
  addColumn(db, "connections", "last_sync_at", "TEXT");
  addColumn(db, "connections", "last_error", "TEXT");
  // Google Ads accounts reached through a manager account need the manager's id on every request.
  addColumn(db, "connection_accounts", "login_customer_id", "TEXT");
  // Grants made before webcare_comp existed sat in `webcare`. With no subscription they can only be grants.
  db.exec("UPDATE workspaces SET webcare_comp = 1, webcare = 0 WHERE webcare = 1 AND stripe_subscription_id IS NULL");
  // Ads reports saved before native connections named the old sync supplier. Keep them white-labelled.
  db.exec(`UPDATE runs SET
      title = REPLACE(title, 'Windsor.ai, ', 'live sync, '),
      input_json = REPLACE(input_json, '"source":"windsor"', '"source":"live"'),
      result_json = REPLACE(REPLACE(REPLACE(REPLACE(result_json, '"Windsor.ai Google Ads', '"Google Ads (live sync)'), '"Windsor.ai Meta Ads', '"Meta Ads (live sync)'), '"Windsor.ai returned', '"Live sync returned'), 'Windsor.ai', 'live sync'),
      error = REPLACE(error, 'Windsor.ai', 'live sync')
    WHERE agent = 'ads' AND (title LIKE '%Windsor%' OR input_json LIKE '%"source":"windsor"%' OR result_json LIKE '%Windsor%' OR error LIKE '%Windsor%')`);
}

function addColumn(db: Database.Database, table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// ---------- Row types ----------

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_admin: number;
  current_workspace_id?: string | null;
  created_at: string;
};

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
  /** The account's plan. For an extra business on a Pro account this is copied from the first one. */
  plan: string;
  autopilot?: number;
  promo_plan?: string | null;
  promo_until?: string | null;
  promo_code?: string | null;
  extra_outlets?: number;
  videos_synced_at?: string | null;
  /** 1 when the account pays for the website changes add-on. Extra businesses copy it from the first one. */
  webcare?: number;
  /** The add-on was stopped; rounds can still be sent until this date. */
  webcare_until?: string | null;
  /** 1 when an admin switched the add-on on without a Stripe item. */
  webcare_comp?: number;
  /** Not a column. The plan the account pays for, when a promo lifts `plan` above it. */
  paid_plan?: string;
  stripe_customer_id: string | null;
  stripe_subscription_id?: string | null;
  windsor_api_key: string | null;
  created_at: string;
  /** Not a column. Set by runs.ts before an agent runs: what the owner has told this specialist. */
  owner_notes?: string;
};

export type VideoRow = {
  workspace_id: string;
  platform: "instagram" | "youtube" | "tiktok" | "facebook";
  external_id: string;
  /** Public link to the post. */
  url: string;
  title: string;
  caption: string;
  published_at: string | null;
  duration_seconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  transcript: string | null;
  /** none: not tried; done; unavailable: the platform doesn't share the file; skipped: outside the plan's limit; error */
  transcript_status: "none" | "done" | "unavailable" | "skipped" | "error";
  transcript_note: string;
  account_id: string;
  updated_at: string;
};

export type PromoRow = {
  code: string;
  plan: string;
  /** How long the access lasts after redeeming. Null: until you end it. */
  days: number | null;
  /** How many accounts can use it. Null: no limit. */
  max_uses: number | null;
  uses: number;
  /** Last moment the code can be redeemed. Null: no deadline. */
  redeem_by: string | null;
  note: string;
  active: number;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  workspace_id: string;
  agent: string;
  run_id: string | null;
  /** The idea or finding the feedback is about. Empty for feedback on the whole report. */
  item: string;
  verdict: "approve" | "reject" | "comment";
  comment: string;
  created_at: string;
  updated_at: string;
};

export type SupportMessageRow = {
  id: string;
  workspace_id: string;
  /** Who wrote it: the owner, or the admin who replied. Null once that user is deleted. */
  user_id: string | null;
  sender: "owner" | "team";
  body: string;
  created_at: string;
  seen_by_owner: number;
  seen_by_team: number;
};

export type WebsiteLoginRow = {
  workspace_id: string;
  login_url: string;
  username: string;
  /** encrypt(password, workspace id). Never sent to the browser; admins reveal it on the server. */
  password_enc: string | null;
  notes: string;
  updated_at: string;
};

export type WebsiteChangeRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  /** JSON: { text: string; detail?: string }[] */
  items: string;
  status: "submitted" | "in_progress" | "done";
  created_at: string;
  done_at: string | null;
  admin_note: string;
};

export type ConnectionRow = {
  id: string;
  workspace_id: string;
  provider: "google" | "meta" | "tiktok";
  external_user: string;
  scopes: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/** Ad accounts and Search Console for the specialists, and the organic social accounts for the video library. */
export type AccountKindName = "google_ads" | "meta_ads" | "search_console" | "facebook_page" | "instagram_account" | "youtube_channel" | "tiktok_account" | "gbp_location";

export type ConnectionAccountRow = {
  connection_id: string;
  provider_account_id: string;
  kind: AccountKindName;
  name: string;
  currency: string | null;
  selected: number;
  login_customer_id: string | null;
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
