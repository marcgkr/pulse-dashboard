import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { db, type RunRow, type TaskRow } from "@/lib/db";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { latestRun, parseTask, pulseScore } from "@/lib/runs";
import { agentAllowed } from "@/lib/runs";
import { Meter, ScoreDial } from "@/components/brand";
import { RxSlip } from "@/components/rx-slip";
import { Badge, ButtonLink, Card, EmptyState, Label, scoreTone } from "@/components/ui";
import { SiteForm } from "@/components/forms/site-form";
import { Sparkline } from "@/components/sparkline";

export const metadata = { title: "Chart" };

const PRIORITY_ORDER = "CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

export default async function Dashboard() {
  const { user, ws } = await requireWorkspace();
  const pulse = pulseScore(ws.id);
  const history = db().prepare("SELECT day, score FROM score_history WHERE workspace_id = ? ORDER BY day DESC LIMIT 30").all(ws.id).reverse() as { day: string; score: number }[];
  const tasks = (db()
    .prepare(`SELECT * FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing') ORDER BY ${PRIORITY_ORDER}, created_at DESC LIMIT 4`)
    .all(ws.id) as TaskRow[]).map(parseTask);
  const counts = db()
    .prepare("SELECT status, COUNT(*) n FROM tasks WHERE workspace_id = ? GROUP BY status")
    .all(ws.id) as { status: string; n: number }[];
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const recent = db().prepare("SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 5").all(ws.id) as RunRow[];
  const hasRuns = recent.length > 0;
  const today = new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <Label>Chart · {today}</Label>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {hasRuns ? `Morning check, ${user.name.split(" ")[0]}.` : `Welcome, ${user.name.split(" ")[0]}.`}
          </h1>
        </div>
        <p className="text-sm text-ink-2">
          <span className="font-mono tabular-nums">{count("todo") + count("doing")}</span> open ·{" "}
          <span className="font-mono tabular-nums">{count("done")}</span> done
        </p>
      </div>

      {!hasRuns && (
        <Card className="chart-grid grid gap-6 p-6 md:grid-cols-[1fr_1.1fr] md:p-8">
          <div>
            <Label>Step 1 of 1</Label>
            <h2 className="mt-1 font-display text-2xl font-semibold">Run your first checkup</h2>
            <p className="mt-2 text-ink-2">
              Site Doctor opens your website like Google and a customer would, then writes a prescription for every problem it finds. It takes about a minute. Everything else on
              this chart fills in from there.
            </p>
          </div>
          <div className="rounded-md border border-line bg-white p-5">
            <SiteForm
              profile={{ name: ws.name, website: ws.website, industry: ws.industry, location: ws.location, audience: ws.audience, offers: ws.offers, competitors: ws.competitors, goals: ws.goals, regulated: !!ws.regulated }}
              windsorConnected={!!ws.windsor_api_key}
              lastInput={null}
            />
          </div>
        </Card>
      )}

      {hasRuns && (
        <section className="grid gap-4 lg:grid-cols-[auto_1fr_1fr]">
          <Card className="flex items-center gap-5 p-5">
            <ScoreDial score={pulse.score} label="Pulse" />
            <div className="max-w-[12rem] text-sm text-ink-2">
              Your overall marketing health, from the latest report of each specialist plus how many fixes you&apos;ve done.
            </div>
          </Card>
          <Card className="space-y-3 p-5">
            {pulse.parts.map((p) => (
              <Meter key={p.key} label={p.label} value={p.value} />
            ))}
          </Card>
          <Card className="flex flex-col p-5">
            <Label>Pulse over time</Label>
            <div className="flex-1 pt-3">
              {history.length > 1 ? (
                <Sparkline points={history.map((h) => h.score)} labels={history.map((h) => h.day)} />
              ) : (
                <p className="text-sm text-ink-3">Your trend line starts once you have scores on two different days. Mark fixes done and re-run checkups to see it move.</p>
              )}
            </div>
          </Card>
        </section>
      )}

      {hasRuns && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <Label>Next up</Label>
              <h2 className="font-display text-xl font-semibold">Your most important prescriptions</h2>
            </div>
            <Link href="/app/plan" className="inline-flex items-center gap-1 text-sm font-semibold text-scrub hover:underline">
              All prescriptions <ArrowRight size={15} />
            </Link>
          </div>
          {tasks.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {tasks.map((t) => (
                <RxSlip
                  key={t.id}
                  data={{ ...t, where: t.where_to, agentName: AGENTS[t.agent as keyof typeof AGENTS]?.name }}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing open. Nice work.">Re-run a checkup to confirm your fixes worked, or try a specialist you haven&apos;t used yet.</EmptyState>
          )}
        </section>
      )}

      <section>
        <Label>Specialists</Label>
        <h2 className="mb-3 font-display text-xl font-semibold">Who do you want to see?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_ORDER.map((id) => {
            const a = AGENTS[id];
            const last = latestRun(ws.id, id);
            const locked = !agentAllowed(ws, id);
            return (
              <Link key={id} href={`/app/agents/${id}`} className="group rounded-lg border border-line bg-card p-4 transition hover:border-scrub">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold group-hover:text-scrub">{a.name}</h3>
                  {locked ? <Badge>Paid</Badge> : last?.score != null ? <Badge tone={scoreTone(last.score)}>{last.score}</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-ink-2">{a.blurb}</p>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  {last ? `Last seen ${new Date(last.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}` : "Not run yet"}
                </p>
              </Link>
            );
          })}
          <Link href="/app/ask" className="group rounded-lg border border-ink bg-ink p-4 text-white transition hover:bg-ink/90">
            <h3 className="font-display text-lg font-semibold">Ask PULSE</h3>
            <p className="mt-1 text-sm text-white/70">A strategist that has read all your reports. Ask what to do next.</p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-white/50">Chat</p>
          </Link>
        </div>
      </section>

      {hasRuns && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <Label>Recent reports</Label>
            <ButtonLink href="/app/reports" variant="ghost" className="px-2 py-1">
              All reports
            </ButtonLink>
          </div>
          <Card className="divide-y divide-line">
            {recent.map((r) => (
              <Link key={r.id} href={`/app/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                <span className="flex-1 truncate font-medium">{r.title}</span>
                {r.demo ? <Badge tone="amber">Sample</Badge> : null}
                {r.status === "error" && <Badge tone="red">Failed</Badge>}
                {(r.status === "running" || r.status === "queued") && <Badge tone="amber">Working</Badge>}
                {r.score != null && <Badge tone={scoreTone(r.score)}>{r.score}</Badge>}
                <span className="hidden font-mono text-xs text-ink-3 sm:inline">{new Date(r.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}</span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
