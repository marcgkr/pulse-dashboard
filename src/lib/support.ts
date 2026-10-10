import { db, id, now, type SupportMessageRow } from "./db";

// The Help chat: one thread per business between its owner and the PULSE team.
// Owners write from /app/help; admins reply from /admin/support.

export const SUPPORT_MAX_CHARS = 2000;
export const SUPPORT_PER_HOUR = 30;

/** What the browser gets for each message. */
export type SupportMessage = { id: string; sender: "owner" | "team"; body: string; created_at: string };

const COLUMNS = "id, sender, body, created_at";
const LIMIT = 300;

function latest(workspaceId: string): SupportMessage[] {
  return (
    db()
      .prepare(`SELECT ${COLUMNS} FROM support_messages WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ${LIMIT}`)
      .all(workspaceId) as SupportMessage[]
  ).reverse();
}

/** Trims a message and checks its length. Returns an error to show, or the clean text. */
export function cleanSupportBody(raw: unknown): { body: string } | { error: string } {
  // Control characters other than new lines and tabs have no place in a chat message.
  // eslint-disable-next-line no-control-regex
  const body = String(raw ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > SUPPORT_MAX_CHARS) return { error: `Keep it under ${SUPPORT_MAX_CHARS.toLocaleString("en")} characters.` };
  return { body };
}

function insert(workspaceId: string, userId: string, sender: "owner" | "team", body: string): SupportMessage {
  const row: SupportMessageRow = {
    id: id("sm_"),
    workspace_id: workspaceId,
    user_id: userId,
    sender,
    body,
    created_at: now(),
    // The writer has seen their own message.
    seen_by_owner: sender === "owner" ? 1 : 0,
    seen_by_team: sender === "team" ? 1 : 0,
  };
  db()
    .prepare(
      `INSERT INTO support_messages (id, workspace_id, user_id, sender, body, created_at, seen_by_owner, seen_by_team)
       VALUES (@id, @workspace_id, @user_id, @sender, @body, @created_at, @seen_by_owner, @seen_by_team)`,
    )
    .run(row);
  return { id: row.id, sender, body, created_at: row.created_at };
}

// ---------- Owner side ----------

/** The owner's thread. Opening it marks the team's replies as read. */
export function ownerThread(workspaceId: string): SupportMessage[] {
  db().prepare("UPDATE support_messages SET seen_by_owner = 1 WHERE workspace_id = ? AND sender = 'team' AND seen_by_owner = 0").run(workspaceId);
  return latest(workspaceId);
}

/** Team replies the owner hasn't opened yet (the badge on Help in the sidebar). */
export function unreadForOwner(workspaceId: string): number {
  return (
    db().prepare("SELECT COUNT(*) n FROM support_messages WHERE workspace_id = ? AND sender = 'team' AND seen_by_owner = 0").get(workspaceId) as { n: number }
  ).n;
}

export function postOwnerMessage(workspaceId: string, userId: string, body: string): SupportMessage {
  return insert(workspaceId, userId, "owner", body);
}

// ---------- Team side (admins only; callers check) ----------

/** One business's thread for the team. Opening it marks the owner's messages as read. */
export function teamThread(workspaceId: string): SupportMessage[] {
  db().prepare("UPDATE support_messages SET seen_by_team = 1 WHERE workspace_id = ? AND sender = 'owner' AND seen_by_team = 0").run(workspaceId);
  return latest(workspaceId);
}

export function postTeamReply(workspaceId: string, adminId: string, body: string): SupportMessage {
  // Replying means the team has read everything before it.
  db().prepare("UPDATE support_messages SET seen_by_team = 1 WHERE workspace_id = ? AND sender = 'owner' AND seen_by_team = 0").run(workspaceId);
  return insert(workspaceId, adminId, "team", body);
}

export type SupportThreadSummary = {
  workspace_id: string;
  business: string;
  plan: string;
  promo_plan: string | null;
  promo_until: string | null;
  owner: string;
  email: string;
  messages: number;
  /** Owner messages the team hasn't opened. */
  unread: number;
  last_at: string;
  last_sender: "owner" | "team";
  last_body: string;
};

/** Every thread, newest activity first. */
export function supportThreads(limit = 200): SupportThreadSummary[] {
  return db()
    .prepare(
      `WITH last AS (
         SELECT workspace_id, sender, body, created_at,
           ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at DESC, rowid DESC) AS rn
         FROM support_messages
       ), counts AS (
         SELECT workspace_id, COUNT(*) AS messages, SUM(sender = 'owner' AND seen_by_team = 0) AS unread
         FROM support_messages GROUP BY workspace_id
       )
       SELECT w.id AS workspace_id, w.name AS business, w.plan, w.promo_plan, w.promo_until, u.name AS owner, u.email,
         c.messages, c.unread, l.created_at AS last_at, l.sender AS last_sender, l.body AS last_body
       FROM last l
       JOIN counts c ON c.workspace_id = l.workspace_id
       JOIN workspaces w ON w.id = l.workspace_id
       JOIN users u ON u.id = w.owner_id
       WHERE l.rn = 1
       ORDER BY l.created_at DESC
       LIMIT ?`,
    )
    .all(limit) as SupportThreadSummary[];
}

/** Threads whose latest message is from the owner, so the team owes a reply. */
export function waitingThreads(): number {
  return (
    db()
      .prepare(
        `SELECT COUNT(*) n FROM (
           SELECT sender, ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at DESC, rowid DESC) AS rn FROM support_messages
         ) WHERE rn = 1 AND sender = 'owner'`,
      )
      .get() as { n: number }
  ).n;
}
