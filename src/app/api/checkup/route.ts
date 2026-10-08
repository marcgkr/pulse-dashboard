import { NextResponse } from "next/server";
import { auditSite, type Check } from "@/lib/agents/site-audit";
import { clientIp, HttpError, readJson } from "@/lib/http";
import { rulePrescriptions } from "@/lib/agents/site";
import { normalizeUrl } from "@/lib/safe-fetch";

// Free public checkup used by the landing page hero. Rules-only (no AI), so it is cheap to run.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
// Stay just under maxDuration so the owner gets a readable message instead of a platform timeout.
const TIMEOUT_MS = 55_000;

// In-memory, per-instance limiter. Good enough to stop casual abuse; swap for a shared store if we scale out.
const g = globalThis as unknown as { __checkupHits?: Map<string, number[]> };
const hits = (g.__checkupHits ??= new Map<string, number[]>());


function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing forever.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

class TimeoutError extends Error {}

/** Races the work against a deadline and aborts it (stops further page fetches) when the deadline wins. */
function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work(controller.signal),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TimeoutError("timeout"));
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

const statusRank = { fail: 0, warn: 1, pass: 2 } as const;

export async function POST(req: Request) {
  let body: { url?: unknown } | null;
  try {
    body = await readJson(req, 4000);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!raw) return NextResponse.json({ error: "Enter your website address, for example yourclinic.sg." }, { status: 400 });
  if (raw.length > 300) return NextResponse.json({ error: "That address is too long. Enter just your homepage, like yourclinic.sg." }, { status: 400 });

  let url: string;
  try {
    url = normalizeUrl(raw).toString();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const limit = rateLimit(clientIp(req));
  if (!limit.ok) {
    const mins = Math.max(1, Math.ceil(limit.retryAfter / 60));
    return NextResponse.json(
      { error: `You've run ${MAX_PER_WINDOW} free checkups in the last 10 minutes. Try again in about ${mins} minute${mins === 1 ? "" : "s"}, or create a free account to keep going.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    const audit = await withTimeout((signal) => auditSite(url, { maxPages: 3, signal }), TIMEOUT_MS);
    const topIssues: Check[] = audit.checks
      .filter((c) => c.status !== "pass")
      .sort((a, b) => b.weight - a.weight || statusRank[a.status] - statusRank[b.status])
      .slice(0, 5);
    return NextResponse.json({
      host: audit.host,
      score: audit.score,
      groupScores: audit.groupScores,
      platform: audit.platform,
      topIssues,
      prescriptions: rulePrescriptions(audit).slice(0, 3),
    });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return NextResponse.json(
        { error: "The site took too long to respond, so we stopped the checkup. Check that it loads in your browser, then try again." },
        { status: 504 },
      );
    }
    // auditSite / safeFetch throw owner-readable messages (unreachable host, HTTP errors, private addresses).
    const message = e instanceof Error && e.message ? e.message : "We couldn't check that site.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
