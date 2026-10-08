import dns from "node:dns/promises";
import net from "node:net";

// Fetches user-supplied URLs without letting them reach internal network addresses.

// Test-only escape hatch so the crawler can run against a local fixture site. Never set in production.
const ALLOW_PRIVATE = process.env.PULSERX_ALLOW_PRIVATE === "1";

const UA = "Mozilla/5.0 (compatible; MarketingRxBot/1.0; +https://marketingrx.ai/bot)";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!s) throw new Error("Enter a website address.");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error("That doesn't look like a website address.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https addresses can be checked.");
  if (!url.hostname.includes(".") && !ALLOW_PRIVATE) throw new Error("That doesn't look like a public website address.");
  return url;
}

async function assertPublic(url: URL) {
  if (ALLOW_PRIVATE) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Only public websites can be checked.");
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error(`Couldn't find ${host}. Check the address is spelled correctly.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Only public websites can be checked.");
}

export type FetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Headers;
  body: string;
  ms: number;
  redirects: string[];
};

export async function safeFetch(
  input: string | URL,
  opts: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number } = {},
): Promise<FetchResult> {
  let url = typeof input === "string" ? normalizeUrl(input) : input;
  const started = Date.now();
  const redirects: string[] = [];
  const maxBytes = opts.maxBytes ?? 3_000_000;

  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      });
    } catch (e) {
      clearTimeout(timer);
      const reason = (e as Error).name === "AbortError" ? "timed out" : "could not be reached";
      throw new Error(`${url.hostname} ${reason}.`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      redirects.push(url.toString());
      url = new URL(res.headers.get("location")!, url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("The site redirected to an unsupported address.");
      continue;
    }

    let body = "";
    if (opts.method !== "HEAD" && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel();
          break;
        }
      }
      body = new TextDecoder("utf-8").decode(Buffer.concat(chunks));
    }
    clearTimeout(timer);
    return {
      url: typeof input === "string" ? input : input.toString(),
      finalUrl: url.toString(),
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      body,
      ms: Date.now() - started,
      redirects,
    };
  }
  throw new Error("The site redirected too many times.");
}
