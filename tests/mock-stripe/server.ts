/**
 * Local stand-in for the Stripe API endpoints MarketingRx uses, for end-to-end tests without a key.
 *
 *   npx tsx tests/mock-stripe/server.ts     # 127.0.0.1:4700 (MOCK_STRIPE_PORT to change)
 *
 * Point the app at it with STRIPE_SECRET_KEY=sk_test_mock STRIPE_API_BASE=http://127.0.0.1:4700.
 * GET /pay/:session plays the customer paying on Stripe's checkout page: it marks the session paid,
 * creates the subscription and redirects to the session's success_url.
 * GET /__requests lists every API call received (method, path, decoded form body) for assertions.
 *
 * It also stands in for Resend (src/lib/email.ts) at /resend, so tests can check what the team is
 * emailed: point RESEND_API_BASE at http://127.0.0.1:4700/resend. GET /__emails lists the JSON bodies.
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_STRIPE_PORT || 4700);
type Obj = Record<string, unknown>;
const sessions = new Map<string, Obj>();
const subs = new Map<string, Obj>();
const products = new Map<string, Obj>();
const requests: { method: string; path: string; body: Record<string, string> }[] = [];
const emails: { auth: string; body: unknown }[] = [];
let n = 0;
const nextId = (p: string) => `${p}_mock${++n}`;
const periodEnd = () => Math.floor(Date.now() / 1000) + 30 * 86400;

/** Stripe's form encoding, flattened: "line_items[0][price_data][unit_amount]" -> "4900". */
function parse(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

function metadataOf(b: Record<string, string>, prefix = "metadata"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(b)) {
    const m = new RegExp(`^${prefix.replace(/[[\]]/g, "\\$&")}\\[([^\\]]+)\\]$`).exec(k);
    if (m) out[m[1]] = v;
  }
  return out;
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const path = url.pathname;
    if (path === "/__emails") return send(res, 200, emails);
    if (path === "/resend/emails" && req.method === "POST") {
      emails.push({ auth: req.headers.authorization ?? "", body: JSON.parse(raw || "{}") });
      return send(res, 200, { id: nextId("email") });
    }
    const b = parse(raw);
    if (path === "/__requests") return send(res, 200, requests);
    if (path.startsWith("/v1/")) requests.push({ method: req.method ?? "", path, body: b });

    if (path === "/v1/products/search") return send(res, 200, { object: "search_result", data: [...products.values()].filter((p) => url.searchParams.get("query")?.includes(`'${(p.metadata as Obj).mrx_plan}'`)), has_more: false });
    if (path === "/v1/products" && req.method === "POST") {
      const p = { id: nextId("prod"), object: "product", name: b.name, metadata: metadataOf(b), active: true };
      products.set(p.id, p);
      return send(res, 200, p);
    }

    if (path === "/v1/checkout/sessions" && req.method === "POST") {
      const id = nextId("cs_test");
      const s = { id, object: "checkout.session", client_reference_id: b.client_reference_id, metadata: metadataOf(b), customer: b.customer ?? null, subscription: null, payment_status: "unpaid", success_url: b.success_url, url: `http://127.0.0.1:${PORT}/pay/${id}`, _sub_metadata: metadataOf(b, "subscription_data[metadata]") };
      sessions.set(id, s);
      return send(res, 200, s);
    }
    const sessionGet = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(path);
    if (sessionGet) {
      const s = sessions.get(sessionGet[1]);
      return s ? send(res, 200, s) : send(res, 404, { error: { type: "invalid_request_error", message: "No such session" } });
    }
    const pay = /^\/pay\/([^/]+)$/.exec(path);
    if (pay) {
      const s = sessions.get(pay[1]);
      if (!s) return send(res, 404, {});
      const subId = nextId("sub");
      subs.set(subId, { id: subId, object: "subscription", status: "active", metadata: s._sub_metadata, items: { object: "list", data: [{ id: nextId("si"), price: { id: nextId("price") }, current_period_end: periodEnd() }] } });
      Object.assign(s, { payment_status: "paid", status: "complete", subscription: subId, customer: s.customer ?? nextId("cus") });
      res.writeHead(303, { location: String(s.success_url).replace("{CHECKOUT_SESSION_ID}", String(s.id)) });
      return res.end();
    }

    const subPath = /^\/v1\/subscriptions\/([^/]+)$/.exec(path);
    if (subPath) {
      const sub = subs.get(subPath[1]);
      if (!sub) return send(res, 404, { error: { type: "invalid_request_error", message: "No such subscription" } });
      if (req.method === "POST") {
        if (b.cancel_at_period_end) sub.cancel_at_period_end = b.cancel_at_period_end === "true";
        const meta = metadataOf(b);
        if (Object.keys(meta).length) sub.metadata = meta;
        // items[i][id|deleted|quantity|price_data...|metadata...]
        const list = (sub.items as { data: Obj[] }).data;
        for (let i = 0; b[`items[${i}][id]`] !== undefined || Object.keys(b).some((k) => k.startsWith(`items[${i}]`)); i++) {
          const id = b[`items[${i}][id]`];
          const existing = id ? list.find((x) => x.id === id) : undefined;
          if (existing && b[`items[${i}][deleted]`] === "true") {
            list.splice(list.indexOf(existing), 1);
            continue;
          }
          const target = existing ?? { id: nextId("si"), price: { id: nextId("price") }, quantity: 1, metadata: {}, current_period_end: periodEnd() };
          if (!existing) list.push(target);
          if (b[`items[${i}][quantity]`]) target.quantity = Number(b[`items[${i}][quantity]`]);
          if (b[`items[${i}][price_data][unit_amount]`]) target.price = { id: nextId("price") };
          const im = metadataOf(b, `items[${i}][metadata]`);
          if (Object.keys(im).length) target.metadata = im;
        }
      }
      return send(res, 200, sub);
    }

    if (path === "/v1/billing_portal/sessions" && req.method === "POST") return send(res, 200, { id: nextId("bps"), url: `http://127.0.0.1:${PORT}/portal` });
    send(res, 404, { error: { type: "invalid_request_error", message: `Mock has no ${req.method} ${path}` } });
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock stripe on http://127.0.0.1:${PORT}`));
