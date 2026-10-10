import { BRAND } from "./config";

// Email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend). Without them
// nothing is sent and callers carry on. Never put passwords or other secrets in an email.

/** Where team notifications go: TEAM_EMAIL, else the enquiry inbox. */
export function teamEmail(): string {
  return process.env.TEAM_EMAIL?.trim() || BRAND.contactEmail;
}

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type Email = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };

/** Sends one email. Returns false (and logs why) instead of throwing, so a failed email never fails the request. */
export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn("[email] not sent: RESEND_API_KEY or EMAIL_FROM is not set");
    return false;
  }
  // RESEND_API_BASE points at a local stub in end-to-end tests. Never set it in production.
  const base = (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(email.to) ? email.to : [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
      console.warn(`[email] Resend refused the email (${res.status}${err.name ? `, ${err.name}` : ""}): ${err.message ?? "no details"}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] sending failed:", (e as Error).name);
    return false;
  }
}

/** Escapes text for an HTML email body. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
