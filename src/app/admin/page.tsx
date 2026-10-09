import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, planPrice } from "@/lib/config";
import { formatPrice, marketFor } from "@/lib/markets";
import { aiEnabled, MODEL } from "@/lib/ai";
import { Logo } from "@/components/brand";
import { Card, Label, PageHeader } from "@/components/ui";
import { AdminPlanSelect } from "@/components/admin-plan-select";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

type Row = { id: string; name: string; website: string; industry: string; country: string; plan: string; created_at: string; email: string; owner: string; runs: number; runs_month: number; done: number; open: number; last_run: string | null };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) redirect("/app");
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const rows = db()
    .prepare(
      `SELECT w.id, w.name, w.website, w.industry, w.country, w.plan, w.created_at, u.email, u.name AS owner,
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
  const byAgent = db().prepare("SELECT agent, COUNT(*) n FROM runs WHERE created_at >= ? GROUP BY agent ORDER BY n DESC").all(month.toISOString()) as { agent: string; n: number }[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Logo className="mb-6" />
      <PageHeader eyebrow="PULSE Digital" title="Admin console">
        AI: {aiEnabled() ? `live (${MODEL})` : "demo mode, no API key"}.
      </PageHeader>
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
                <td className="px-3 py-2"><AdminPlanSelect workspaceId={r.id} plan={r.plan} /></td>
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
