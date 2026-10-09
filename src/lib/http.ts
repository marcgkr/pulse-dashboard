// Small helpers for route handlers: bounded JSON bodies, client IP, and an in-memory rate limiter.

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Reads a JSON body, refusing anything larger than maxBytes. */
export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 16_000): Promise<T> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError("That request is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) return {} as T;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError("That request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    return (parsed && typeof parsed === "object" ? parsed : {}) as T;
  } catch {
    throw new HttpError("The request wasn't valid JSON.");
  }
}

/**
 * Client IP as seen by our edge proxy. Railway sets x-real-ip.
 * Behind Cloudflare, x-real-ip is a Cloudflare address, so we read cf-connecting-ip instead, but only
 * when the request also carries the secret header our Cloudflare rule adds (CLOUDFLARE_ORIGIN_KEY).
 * Without that check anyone could send a fake cf-connecting-ip and dodge the limits.
 */
export function clientIp(req: Request): string {
  const key = process.env.CLOUDFLARE_ORIGIN_KEY;
  if (key && req.headers.get("x-origin-key") === key) {
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // The rightmost entry is the one our proxy added; earlier ones can be forged by the client.
    return parts[parts.length - 1] || "unknown";
  }
  return "unknown";
}

const buckets = new Map<string, number[]>();

/** Returns true if the action is allowed. Sliding window, per process. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 50_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  throw e;
}
