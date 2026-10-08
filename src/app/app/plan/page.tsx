import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { requireWorkspace } from "@/lib/auth";
import { db, type TaskRow } from "@/lib/db";
import { parseTask } from "@/lib/runs";
import { RxSlip } from "@/components/rx-slip";
import { ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";

export const metadata = { title: "Prescriptions" };

const TABS = [
  { id: "open", label: "Open", where: "status IN ('todo','doing')" },
  { id: "done", label: "Done", where: "status = 'done'" },
  { id: "skipped", label: "Not relevant", where: "status = 'skipped'" },
] as const;

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ tab?: string; agent?: string }> }) {
  const sp = await searchParams;
  const { ws } = await requireWorkspace();
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const agentFilter = sp.agent && sp.agent in AGENTS ? sp.agent : null;
  const rows = db()
    .prepare(
      `SELECT * FROM tasks WHERE workspace_id = ? AND ${tab.where} ${agentFilter ? "AND agent = ?" : ""}
       ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC`,
    )
    .all(...(agentFilter ? [ws.id, agentFilter] : [ws.id])) as TaskRow[];
  const tasks = rows.map(parseTask);
  const byAgent = db().prepare("SELECT agent, COUNT(*) n FROM tasks WHERE workspace_id = ? AND " + tab.where + " GROUP BY agent").all(ws.id) as { agent: string; n: number }[];
  const quick = tasks.filter((t) => t.effort === "quick" && t.status !== "done").length;

  const href = (p: { tab?: string; agent?: string | null }) => {
    const q = new URLSearchParams();
    const t = p.tab ?? tab.id;
    if (t !== "open") q.set("tab", t);
    const a = p.agent === undefined ? agentFilter : p.agent;
    if (a) q.set("agent", a);
    return `/app/plan${q.size ? `?${q}` : ""}`;
  };

  return (
    <div>
      <PageHeader eyebrow="Your treatment plan" title="Prescriptions">
        Every fix your specialists recommended, most important first. Do them yourself, mark them done, then re-run the specialist to confirm.
        {tab.id === "open" && quick > 0 && (
          <span className="mt-2 block text-sm text-scrub">
            {quick} of these take under 30 minutes. Start there.
          </span>
        )}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={href({ tab: t.id })}
            className={cx("rounded-md px-3 py-1.5 text-sm font-semibold", t.id === tab.id ? "bg-ink text-white" : "text-ink-2 hover:bg-mint")}
          >
            {t.label}
          </Link>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />
        <Link href={href({ agent: null })} className={cx("rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wider", !agentFilter ? "bg-mint text-scrub-dark" : "text-ink-3 hover:text-ink")}>
          All
        </Link>
        {byAgent.map((b) => (
          <Link
            key={b.agent}
            href={href({ agent: b.agent })}
            className={cx("rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wider", agentFilter === b.agent ? "bg-mint text-scrub-dark" : "text-ink-3 hover:text-ink")}
          >
            {AGENTS[b.agent as keyof typeof AGENTS]?.name ?? b.agent} ({b.n})
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title={tab.id === "open" ? "No open prescriptions" : tab.id === "done" ? "Nothing marked done yet" : "Nothing here"}
          action={tab.id === "open" ? <ButtonLink href="/app/agents/site">Run a Site Doctor checkup</ButtonLink> : undefined}
        >
          {tab.id === "open" ? "Run a specialist and its fixes will land here." : undefined}
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {tasks.map((t) => (
            <RxSlip key={t.id} data={{ ...t, where: t.where_to, agentName: AGENTS[t.agent as keyof typeof AGENTS]?.name }} />
          ))}
        </div>
      )}
    </div>
  );
}
