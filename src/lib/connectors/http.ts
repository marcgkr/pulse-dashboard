// Shared HTTP plumbing for the Google and Meta connectors: timeouts, bounded bodies, retries and
// error scrubbing. Nothing here logs; callers decide what to log and must never log tokens.

import type { AdRow } from "../agents/ads-data";
import type { AccountKindName } from "../db";

export type ConnectorErrorCode = "auth" | "rate_limit" | "permission" | "not_approved" | "too_much_data" | "timeout" | "api" | "config";

export class ConnectorError extends Error {
  constructor(
    message: string,
    public code: ConnectorErrorCode = "api",
    public status = 0,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

/** One account found on a connected login. */
export type DiscoveredAccount = {
  id: string;
  kind: AccountKindName;
  name: string;
  currency: string | null;
  /** Google Ads manager account to send as login-customer-id, when the account is reached through one. */
  login_customer_id?: string | null;
};

export type FetchedAds = { rows: AdRow[]; warnings: string[] };

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

/** Removes secrets and anything that looks like a token from a message before it is shown or logged. */
export function scrub(message: string, secrets: (string | null | undefined)[] = []): string {
  let out = String(message ?? "");
  for (const s of secrets) if (s && s.length >= 8) out = out.split(s).join("***");
  return out
    .replace(/(access_token|refresh_token|client_secret|appsecret_proof|code|fb_exchange_token)=[^&\s"]+/gi, "$1=***")
    .replace(/\bya29\.[\w.-]+/g, "***")
    .replace(/\bEAA[A-Za-z0-9]{20,}/g, "***")
    .slice(0, 300);
}

/** Reads a response body as text, refusing anything over maxBytes. */
export async function readBounded(res: Response, maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new ConnectorError("The response was too large to read. Try a shorter period.", "too_much_data");
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ConnectorError("The response was too large to read. Try a shorter period.", "too_much_data");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export type JsonResponse = { ok: boolean; status: number; body: unknown; retryAfter: number | null };

/** fetch + bounded JSON parse. Never throws on HTTP errors (callers read the provider's error body); throws on timeouts and bad JSON. */
export async function fetchJson(url: string | URL, init: RequestInit = {}, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<JsonResponse> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000) });
  } catch (e) {
    const err = e as Error;
    if (err.name === "TimeoutError" || err.name === "AbortError") throw new ConnectorError("The request timed out.", "timeout");
    throw new ConnectorError("Couldn't reach the service.", "api");
  }
  const text = await readBounded(res, opts.maxBytes);
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (res.ok) throw new ConnectorError("The service sent a response we couldn't read.", "api", res.status);
      body = { error: { message: text.slice(0, 200) } };
    }
  }
  const ra = Number(res.headers.get("retry-after"));
  return { ok: res.ok, status: res.status, body, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null };
}

/** Base delay between retries. Tests set CONNECTOR_RETRY_BASE_MS=1. */
export function retryDelayMs(attempt: number, retryAfterSeconds: number | null = null): number {
  const base = Number(process.env.CONNECTOR_RETRY_BASE_MS) || 2000;
  const wanted = retryAfterSeconds != null ? retryAfterSeconds * 1000 : base * (attempt + 1) ** 2;
  return Math.min(wanted, 20_000);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Number from an API value that may be a string ("123") or number. */
export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** YYYY-MM-DD (UTC) n days before d. */
export function isoDay(d: Date, minusDays = 0): string {
  return new Date(d.getTime() - minusDays * 864e5).toISOString().slice(0, 10);
}
