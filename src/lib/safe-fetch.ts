import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// Fetches user-supplied URLs without letting them reach internal network addresses.
// IPv4 rules also match IPv4-mapped IPv6 (::ffff:a.b.c.d) in net.BlockList.
// The resolved IP is checked inside the connection's own DNS lookup, so a hostname can't
// pass the check with a public IP and then connect to a private one (DNS rebinding).

// Test-only escape hatch so the crawler can run against a local fixture site. Never set in production.
const ALLOW_PRIVATE = process.env.PULSERX_ALLOW_PRIVATE === "1";
if (ALLOW_PRIVATE) console.warn("[safe-fetch] PULSERX_ALLOW_PRIVATE=1: private network addresses can be fetched. Never use this in production.");

const UA = "Mozilla/5.0 (compatible; MarketingRxBot/1.0; +https://marketingrx.ai/bot)";

const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(net4, prefix, "ipv4");
for (const [net6, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::", 96],
  ["64:ff9b::", 96],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net6, prefix, "ipv6");

export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return true;
  return blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

class PrivateAddressError extends Error {
  code = "EPRIVATE";
}

const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return callback(err, [] as unknown as string, 4);
        if (!ALLOW_PRIVATE && (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address)))) {
          return callback(new PrivateAddressError("Only public websites can be checked."), [] as unknown as string, 4);
        }
        if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
  headersTimeout: 20_000,
  bodyTimeout: 20_000,
});

export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!s) throw new Error("Enter a website address.");
  if (s.length > 2000) throw new Error("That address is too long.");
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

/** Cheap early checks. The real guard is the pinned lookup in `dispatcher`. */
async function assertPublic(url: URL) {
  if (ALLOW_PRIVATE) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) throw new Error("Only public websites can be checked.");
  if (host === "localhost" || /\.(local|internal|localhost)$/i.test(host)) throw new Error("Only public websites can be checked.");
  // The connect-time lookup isn't used for IP literals, so check them here.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Only public websites can be checked.");
    return;
  }
  const addrs = await dns.promises.lookup(host, { all: true }).catch(() => []);
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
  opts: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number; signal?: AbortSignal } = {},
): Promise<FetchResult> {
  let url = typeof input === "string" ? normalizeUrl(input) : input;
  const started = Date.now();
  const redirects: string[] = [];
  const maxBytes = opts.maxBytes ?? 3_000_000;

  for (let hop = 0; hop < 6; hop++) {
    if (opts.signal?.aborted) throw new Error("The check was stopped.");
    await assertPublic(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const done = () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    };
    let res: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      res = await undiciFetch(url, {
        method: opts.method ?? "GET",
        redirect: "manual",
        signal: controller.signal,
        dispatcher,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      });
    } catch (e) {
      done();
      const cause = (e as { cause?: { code?: string } }).cause;
      if (cause?.code === "EPRIVATE") throw new Error("Only public websites can be checked.");
      const reason = (e as Error).name === "AbortError" ? "timed out" : "could not be reached";
      throw new Error(`${url.hostname} ${reason}.`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      done();
      await res.body?.cancel().catch(() => {});
      redirects.push(url.toString());
      try {
        url = new URL(res.headers.get("location")!, url);
      } catch {
        throw new Error("The site redirected to an invalid address.");
      }
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("The site redirected to an unsupported address.");
      continue;
    }

    let body = "";
    try {
      if (opts.method !== "HEAD" && res.body) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done: end, value } = await reader.read();
          if (end) break;
          chunks.push(value);
          total += value.length;
          if (total > maxBytes) {
            await reader.cancel();
            break;
          }
        }
        body = new TextDecoder("utf-8").decode(Buffer.concat(chunks));
      }
    } catch {
      throw new Error(`${url.hostname} stopped sending the page.`);
    } finally {
      done();
    }
    return {
      url: typeof input === "string" ? input : input.toString(),
      finalUrl: url.toString(),
      status: res.status,
      ok: res.ok,
      headers: res.headers as unknown as Headers,
      body,
      ms: Date.now() - started,
      redirects,
    };
  }
  throw new Error("The site redirected too many times.");
}
