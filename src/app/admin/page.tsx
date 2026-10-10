import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, planPrice } from "@/lib/config";
import { formatPrice, marketFor } from "@/lib/markets";
import { aiEnabled, MODEL } from "@/lib/ai";
import { Logo } from "@/components/brand";
import { Card, Label, PageHeader } from "@/components/ui";
import { AdminPlanSelect } from "@/components/admin-plan-select";
import { AdminPromos, type AdminPromo } from "@/components/admin-promos";
import type { PromoRow } from "@/lib/db";
import { planById } from "@/lib/config";
import { promoActive } from "@/lib/promos";
import { waitingThreads } from "@/lib/support";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

type Row = { id: string; name: string; website: string; industry: string; country: string; plan: string; promo_plan: string | null; promo_until: string | null; promo_code: string | null; extra_outlets: number; created_at: string; email: string; owner: string; runs: number; runs_month: number; done: number; open: number; last_run: string | null };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) redirect("/app");
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const rows = db()
    .prepare(
      `SELECT w.id, w.name, w.website, w.industry, w.country, w.plan, w.promo_plan, w.promo_until, w.promo_code, w.extra_outlets, w.created_at, u.email, u.name AS owner,
        (SELECT COUNT(*) FROM runs r WHERE r.workspace_id = w.id) AS runs,
        (SELECT COUNT(*) FROM runs r WHERE r.workspace_id = w.id AND r.created_at >= ?) AS runs_month,
        (SELECT COUNT(*) FROM tasks t WHERE t.workspace_id = w.id AND t.status = 'done') AS done,
        (SELECT COUNT(*) FROM tasks t WHERE t.workspace_id = w.id AND t.status IN ('todo','doing')) AS open,
        (SELECT MAX(created_at) FROM runs r WHERE r.workspace_id = w.id) AS last_run
       FROM workspaces w JOIN users u ON u.id = w.owner_id ORDER BY w.created_at DESC`,
    )
    .all(month.toISOString()) as Row[];
  // List-price MRR per currency (comped plans included, so treat it as an upper bound).
  const mrrByCurrency = new Map<string, { market: ReturnType<typeof marketFor>; total: number }>();
  for (const r of rows) {
    const plan = PLANS.find((p) => p.id === r.plan);
    if (!plan || plan.id === "free") continue;
    const m = marketFor(r.country);
    const cur = mrrByCurrency.get(m.currency) ?? { market: m, total: 0 };
    cur.total += planPrice(plan, m);
    mrrByCurrency.set(m.currency, cur);
  }
  const mrr = [...mrrByCurrency.values()].map((v) => formatPrice(v.market, v.total)).join(" + ") || "0";
  const leads = db()
    .prepare(
      `SELECT l.email, l.website, l.score, l.country, l.created_at, EXISTS(SELECT 1 FROM users u WHERE u.email = l.email) AS signed_up
       FROM leads l ORDER BY l.created_at DESC LIMIT 50`,
    )
    .all() as { email: string; website: string; score: number | null; country: string; created_at: string; signed_up: number }[];
  const leadTotals = db()
    .prepare("SELECT COUNT(*) AS n, SUM(EXISTS(SELECT 1 FROM users u WHERE u.email = l.email)) AS converted FROM leads l")
    .get() as { n: number; converted: number | null };
  const redemptions = db()
    .prepare(
      `SELECT r.code, r.workspace_id, r.email, r.until, r.redeemed_at, w.name AS business, w.promo_code, w.promo_until
       FROM promo_redemptions r JOIN workspaces w ON w.id = r.workspace_id ORDER BY r.redeemed_at DESC`,
    )
    .all() as { code: string; workspace_id: string; email: string; until: string | null; redeemed_at: string; business: string; promo_code: string | null; promo_until: string | null }[];
  const promos: AdminPromo[] = (db().prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all() as PromoRow[]).map((p) => ({
    code: p.code,
    plan: p.plan,
    planName: planById(p.plan).name,
    days: p.days,
    max_uses: p.max_uses,
    uses: p.uses,
    redeem_by: p.redeem_by,
    note: p.note,
    active: p.active === 1,
    redemptions: redemptions
      .filter((r) => r.code === p.code)
      .map((r) => ({
        workspaceId: r.workspace_id,
        business: r.business,
        email: r.email,
        until: r.until,
        redeemedAt: r.redeemed_at,
        // Still running on this code (a later code would have replaced it).
        live: r.promo_code === p.code && (!r.promo_until || Date.parse(r.promo_until) > Date.now()),
      })),
  }));
  const waiting = waitingThreads();
  const byAgent = db().prepare("SELECT agent, COUNT(*) n FROM runs WHERE created_at >= ? GROUP BY agent ORDER BY n DESC").all(month.toISOString()) as { agent: string; n: number }[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Logo className="mb-6" />
      <PageHeader eyebrow="PULSE Digital" title="Admin console">
        AI: {aiEnabled() ? `live (${MODEL})` : "demo mode, no API key"}.
      </PageHeader>
      <a
        href="/admin/support"
        className="mb-8 flex items-center justify-between gap-4 rounded-3xl bg-card px-5 py-4 shadow-[var(--shadow-box)] ring-1 ring-line/70 transition hover:ring-scrub"
      >
        <span className="font-display text-lg font-bold">Support inbox</span>
        <span className={waiting ? "rounded-full bg-pulse px-3 py-1 text-sm font-semibold text-white" : "text-sm text-ink-3"}>
          {waiting ? `${waiting} waiting for a reply` : "Nothing waiting"}
        </span>
      </a>
      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        {[
          ["Businesses", rows.length],
          ["Paying", rows.filter((r) => r.plan !== "free").length],
          ["List-price MRR", mrr],
          ["Runs this month", rows.reduce((n, r) => n + r.runs_month, 0)],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <Label>{k}</Label>
            <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{v}</div>
          </Card>
        ))}
      </div>
      <Label className="mb-2">Runs by specialist this month</Label>
      <p className="mb-8 text-sm text-ink-2">{byAgent.map((a) => `${a.agent} ${a.n}`).join(" · ") || "None yet."}</p>
      <div className="mb-2 flex items-end justify-between gap-4">
        <Label>
          Free-checkup leads: {leadTotals.n} captured, {leadTotals.converted ?? 0} created an account
        </Label>
        <a href="/api/admin/leads" className="text-sm font-semibold text-scrub hover:underline">
          Download CSV
        </a>
      </div>
      <Card className="mb-10 overflow-x-auto">
        {leads.length === 0 ? (
          <p className="p-5 text-sm text-ink-3">No leads yet. They appear here when someone enters their email after the free checkup on the homepage.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Website</th>
                <th className="px-4 py-2.5 text-right">Score</th>
                <th className="px-4 py-2.5">Country</th>
                <th className="px-4 py-2.5">Account</th>
                <th className="px-4 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.email + l.website} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <a className="font-semibold text-scrub" href={`mailto:${l.email}`}>
                      {l.email}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">{l.website}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.score ?? ""}</td>
                  <td className="px-4 py-2.5">{l.country ? marketFor(l.country).name : ""}</td>
                  <td className="px-4 py-2.5">{l.signed_up ? "Yes" : "Not yet"}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-3">{l.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Label className="mb-2">Promo codes</Label>
      <div id="promos" className="mb-10">
        <AdminPromos promos={promos} />
      </div>
      <Label className="mb-2">Businesses</Label>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2 text-right">Runs (month)</th>
              <th className="px-3 py-2 text-right">Fixes done / open</th>
              <th className="px-3 py-2">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-ink-3">{marketFor(r.country).name} · {r.industry} · {r.website}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{r.owner}</div>
                  <a className="text-xs text-scrub" href={`mailto:${r.email}`}>{r.email}</a>
                </td>
                <td className="px-3 py-2">
                  <AdminPlanSelect workspaceId={r.id} plan={r.plan} outlets={r.extra_outlets} />
                  {promoActive(r) && (
                    <div className="mt-1 text-xs text-scrub-dark">
                      {planById(r.promo_plan!).name} free {r.promo_until ? `until ${r.promo_until.slice(0, 10)}` : "until ended"} ({r.promo_code})
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{r.runs} ({r.runs_month})</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{r.done} / {r.open}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.last_run ? r.last_run.slice(0, 10) : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
