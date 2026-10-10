import { planById } from "./config";
import { decrypt, encrypt } from "./crypto";
import { db, id, now, type TaskRow, type WebsiteChangeRow, type WebsiteLoginRow, type WorkspaceRow } from "./db";
import { escapeHtml, sendEmail, teamEmail } from "./email";
import { formatPrice, marketFor } from "./markets";
import { monthStartSgt, parseTask } from "./runs";
import { alertSupportTeam } from "./whatsapp";

// "Website changes by PULSE": an add-on for Growth and Pro. Twice a month the owner sends a round of
// changes, as many as they like, and the PULSE team makes them on the owner's website with a login
// the owner shares once. The add-on is a Stripe item on the plan subscription (metadata.kind
// "webcare", see /api/billing/webcare) and workspaces.webcare on the first business. Extra outlets
// inherit it, and rounds are counted across the whole login, like reports.

export const ROUNDS_PER_MONTH = 2;
export const MAX_ITEMS = 40;
export const MAX_ITEM_CHARS = 1000;

export type ChangeItem = { text: string; detail?: string };

/** What a report or the prescriptions page needs to show the offer, or a link to send changes. */
export type WebcareOffer = { active: boolean; price: string };

/** The add-on can be bought on this plan. */
export function webcareAvailable(ws: Pick<WorkspaceRow, "plan">): boolean {
  return planById(ws.plan).websiteCare;
}

/** The account pays for the add-on (or it was switched on by an admin) and its plan includes it. */
export function webcareActive(ws: Pick<WorkspaceRow, "plan" | "webcare">): boolean {
  return webcareAvailable(ws) && ws.webcare === 1;
}

/** Null for plans without the add-on, so the nudge only reaches Growth and Pro owners. */
export function webcareOffer(ws: WorkspaceRow): WebcareOffer | null {
  if (!webcareAvailable(ws)) return null;
  const m = marketFor(ws.country);
  return { active: webcareActive(ws), price: formatPrice(m, m.prices.webcare) };
}

// Control characters other than new lines and tabs have no place in what owners type.
// eslint-disable-next-line no-control-regex
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

// ---------- Website login ----------

/** The saved login without the password: only whether one is saved. */
export type LoginSummary = { loginUrl: string; username: string; notes: string; hasPassword: boolean; updatedAt: string };

export function loginSummary(workspaceId: string): LoginSummary | null {
  const row = db().prepare("SELECT * FROM website_logins WHERE workspace_id = ?").get(workspaceId) as WebsiteLoginRow | undefined;
  if (!row) return null;
  return { loginUrl: row.login_url, username: row.username, notes: row.notes, hasPassword: Boolean(row.password_enc), updatedAt: row.updated_at };
}

/**
 * Checks and saves the login. A blank password keeps the saved one. Returns an error to show.
 * The password is encrypted with the business's id as associated data, so it can't be moved to another business.
 */
export function saveLogin(workspaceId: string, raw: { loginUrl?: unknown; username?: unknown; password?: unknown; notes?: unknown }): { error: string } | { ok: true } {
  const loginUrl = clean(raw.loginUrl, 500);
  const username = clean(raw.username, 200);
  const notes = clean(raw.notes, 1000);
  const password = typeof raw.password === "string" ? raw.password.slice(0, 500) : "";
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(loginUrl) ? loginUrl : `https://${loginUrl}`);
  } catch {
    return { error: "Add the address of your website's login page, for example https://yoursite.com/wp-admin." };
  }
  if (!loginUrl || !/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) {
    return { error: "Add the address of your website's login page, for example https://yoursite.com/wp-admin." };
  }
  if (!username) return { error: "Add the username or email PULSE should log in with." };
  const existing = db().prepare("SELECT password_enc FROM website_logins WHERE workspace_id = ?").get(workspaceId) as { password_enc: string | null } | undefined;
  if (!password && !existing?.password_enc) return { error: "Add the password for that login." };
  const passwordEnc = password ? encrypt(password, workspaceId) : existing!.password_enc;
  db()
    .prepare(
      `INSERT INTO website_logins (workspace_id, login_url, username, password_enc, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET login_url = excluded.login_url, username = excluded.username, password_enc = excluded.password_enc,
         notes = excluded.notes, updated_at = excluded.updated_at`,
    )
    .run(workspaceId, url.toString(), username, passwordEnc, notes, now());
  return { ok: true };
}

/** Admins only (callers check). Decrypts the saved password and records who looked. */
export function revealPassword(workspaceId: string, adminId: string, requestId: string): string | null {
  const row = db().prepare("SELECT password_enc FROM website_logins WHERE workspace_id = ?").get(workspaceId) as { password_enc: string | null } | undefined;
  if (!row?.password_enc) return null;
  const plain = decrypt(row.password_enc, workspaceId);
  db()
    .prepare("INSERT INTO admin_audit (id, admin_id, action, workspace_id, ref, created_at) VALUES (?, ?, 'reveal_website_password', ?, ?, ?)")
    .run(id("aa_"), adminId, workspaceId, requestId, now());
  console.info(`[webcare] admin ${adminId} revealed the website password for ${workspaceId} (request ${requestId})`);
  return plain;
}

// ---------- Rounds ----------

/** Rounds sent this calendar month (Singapore time, like reports) across every business on the login. */
export function roundsUsed(ownerId: string): number {
  return (
    db()
      .prepare(
        `SELECT COUNT(*) n FROM website_change_requests WHERE created_at >= ?
           AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)`,
      )
      .get(monthStartSgt(), ownerId) as { n: number }
  ).n;
}

/** When the next month's rounds open: the 1st of next month, Singapore time. */
export function nextRoundOpens(d = new Date()): Date {
  const start = new Date(monthStartSgt(d));
  const sg = new Date(start.getTime() + 8 * 3_600_000);
  return new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth() + 1, 1) - 8 * 3_600_000);
}

export function parseItems(json: string): ChangeItem[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((x): x is ChangeItem => typeof x?.text === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Builds a round from what the owner typed (one change per line) and open prescriptions they picked.
 * Returns an error to show, or the items.
 */
export function buildItems(workspaceId: string, raw: { text?: unknown; taskIds?: unknown }): { error: string } | { items: ChangeItem[] } {
  const typed = clean(raw.text, MAX_ITEMS * MAX_ITEM_CHARS)
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
  if (typed.some((l) => l.length > MAX_ITEM_CHARS)) return { error: `Keep each change under ${MAX_ITEM_CHARS.toLocaleString("en")} characters.` };
  const ids = Array.isArray(raw.taskIds) ? [...new Set(raw.taskIds.filter((x): x is string => typeof x === "string"))].slice(0, MAX_ITEMS) : [];
  const tasks = ids.length
    ? (db()
        .prepare(`SELECT * FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing') AND id IN (${ids.map(() => "?").join(",")})`)
        .all(workspaceId, ...ids) as TaskRow[])
    : [];
  const fromTasks: ChangeItem[] = tasks.map((t) => {
    const steps = parseTask(t).steps.filter((s) => typeof s === "string" && s);
    const detail = [t.where_to && `Where: ${t.where_to}`, ...steps.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join("\n").slice(0, 1500);
    return { text: `From the prescriptions: ${t.title}`, ...(detail ? { detail } : {}) };
  });
  const items = [...typed.map((text) => ({ text })), ...fromTasks];
  if (!items.length) return { error: "List at least one change, or pick one from your prescriptions." };
  if (items.length > MAX_ITEMS) return { error: `Send up to ${MAX_ITEMS} changes in one round. Put the rest in your next round.` };
  return { items };
}

/** Saves a round if the login has one left this month. Null when both are used. */
export function submitRound(ws: Pick<WorkspaceRow, "id" | "owner_id">, userId: string, items: ChangeItem[]): WebsiteChangeRow | null {
  return db().transaction(() => {
    if (roundsUsed(ws.owner_id) >= ROUNDS_PER_MONTH) return null;
    const row: WebsiteChangeRow = {
      id: id("wc_"),
      workspace_id: ws.id,
      user_id: userId,
      items: JSON.stringify(items),
      status: "submitted",
      created_at: now(),
      done_at: null,
      admin_note: "",
    };
    db()
      .prepare(
        `INSERT INTO website_change_requests (id, workspace_id, user_id, items, status, created_at, done_at, admin_note)
         VALUES (@id, @workspace_id, @user_id, @items, @status, @created_at, @done_at, @admin_note)`,
      )
      .run(row);
    return row;
  })();
}

/** The open business's rounds, newest first. */
export function roundsFor(workspaceId: string, limit = 24): WebsiteChangeRow[] {
  return db().prepare("SELECT * FROM website_change_requests WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(workspaceId, limit) as WebsiteChangeRow[];
}

export const STATUS_LABEL: Record<WebsiteChangeRow["status"], string> = { submitted: "Sent to PULSE", in_progress: "PULSE is working on it", done: "Done" };
export const STATUS_TONE = { submitted: "red", in_progress: "amber", done: "green" } as const;

/**
 * Tells the team about a new round by email, and on WhatsApp when that's set up. Best effort: the
 * round is saved either way. The password never goes in either message; admins reveal it on the
 * admin page.
 */
export async function notifyTeam(
  round: WebsiteChangeRow,
  ctx: { business: string; ownerName: string; ownerEmail: string; website: string; planName: string; appUrl: string },
): Promise<void> {
  const items = parseItems(round.items);
  const login = loginSummary(round.workspace_id);
  const link = `${ctx.appUrl}/admin/website-changes/${round.id}`;
  const lines = [
    `${ctx.business} sent a round of website changes (${items.length} ${items.length === 1 ? "change" : "changes"}).`,
    "",
    `Business: ${ctx.business} (${ctx.planName})`,
    `Owner: ${ctx.ownerName} <${ctx.ownerEmail}>`,
    `Website: ${ctx.website || "not set"}`,
    `Login page: ${login?.loginUrl || "not saved"}`,
    `Username: ${login?.username || "not saved"}`,
    `Password: reveal it on the admin page`,
    "",
    "Changes:",
    ...items.flatMap((it, i) => [`${i + 1}. ${it.text}`, ...(it.detail ? it.detail.split("\n").map((d) => `   ${d}`) : [])]),
    "",
    `Open it, reveal the password and update the status: ${link}`,
  ];
  const html = `<p>${escapeHtml(lines[0])}</p>
<table cellpadding="4">${(
    [
      ["Business", `${ctx.business} (${ctx.planName})`],
      ["Owner", `${ctx.ownerName} <${ctx.ownerEmail}>`],
      ["Website", ctx.website || "not set"],
      ["Login page", login?.loginUrl || "not saved"],
      ["Username", login?.username || "not saved"],
      ["Password", "reveal it on the admin page"],
    ] as const
  )
    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(v)}</td></tr>`)
    .join("")}</table>
<p><b>Changes</b></p>
<ol>${items.map((it) => `<li>${escapeHtml(it.text)}${it.detail ? `<br><span style="white-space:pre-wrap;color:#555">${escapeHtml(it.detail)}</span>` : ""}</li>`).join("")}</ol>
<p><a href="${escapeHtml(link)}">Open it on the admin page</a> to reveal the password and update the status.</p>`;
  await Promise.all([
    sendEmail({ to: teamEmail(), subject: `Website changes: ${ctx.business}`, text: lines.join("\n"), html, replyTo: ctx.ownerEmail }),
    alertSupportTeam(`webcare:${round.workspace_id}`, ctx.business, `Website changes sent (${items.length}). ${link}`).catch(() => {}),
  ]);
}
