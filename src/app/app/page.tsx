import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { marketFor } from "@/lib/markets";
import { db, type RunRow, type TaskRow } from "@/lib/db";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { latestRun, parseTask, pulseScore } from "@/lib/runs";
import { agentAllowed } from "@/lib/runs";
import { Meter, ScoreDial } from "@/components/brand";
import { RxSlip } from "@/components/rx-slip";
import { Badge, Card, EmptyState, Label, scoreColor, scoreTone } from "@/components/ui";
import { agentColor } from "@/lib/agent-colors";
import { SiteForm } from "@/components/forms/site-form";
import { Sparkline } from "@/components/sparkline";
import { connectedSources } from "@/lib/connectors";
import { getConnection, selectedAccounts } from "@/lib/connectors/store";
import { PROVIDERS } from "@/lib/connectors/oauth";
import { planById } from "@/lib/config";
import { SetupChecklist, type SetupStep } from "@/components/setup-checklist";

export const metadata = { title: "Chart" };

const PRIORITY_ORDER = "CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

export default async function Dashboard() {
  const { user, ws } = await requireWorkspace();
  const tz = marketFor(ws.country).timeZone;
  const pulse = pulseScore(ws.id);
  const history = db().prepare("SELECT day, score FROM score_history WHERE workspace_id = ? ORDER BY day DESC LIMIT 30").all(ws.id).reverse() as { day: string; score: number }[];
  // Top open prescriptions, taking the best one from each specialist in turn so one report can't fill the list.
  const openSorted = db()
    .prepare(`SELECT * FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing') ORDER BY ${PRIORITY_ORDER}, CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC`)
    .all(ws.id) as TaskRow[];
  const queues = new Map<string, TaskRow[]>();
  for (const t of openSorted) queues.set(t.agent, [...(queues.get(t.agent) ?? []), t]);
  const picked: TaskRow[] = [];
  while (picked.length < 4 && [...queues.values()].some((q) => q.length)) {
    const heads = [...queues.values()].filter((q) => q.length).map((q) => q[0]);
    const rank = (t: TaskRow) => ["urgent", "high", "medium", "low"].indexOf(t.priority);
    heads.sort((a, b) => rank(a) - rank(b));
    for (const h of heads) {
      if (picked.length >= 4) break;
      if (rank(h) > rank(heads[0]) + 1) continue;
      picked.push(h);
      queues.get(h.agent)!.shift();
    }
  }
  const tasks = picked.map(parseTask);
  const counts = db()
    .prepare("SELECT status, COUNT(*) n FROM tasks WHERE workspace_id = ? GROUP BY status")
    .all(ws.id) as { status: string; n: number }[];
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const recent = db().prepare("SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 5").all(ws.id) as RunRow[];
  const hasRuns = recent.length > 0;
  const today = new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const hour = Number(new Date().toLocaleString("en-SG", { hour: "numeric", hour12: false, timeZone: tz }));
  const partOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  const firstName = user.name.split(" ")[0];
  const plan = planById(ws.plan);
  const steps: SetupStep[] = [
    {
      id: "profile",
      label: "Tell us who you serve and what you sell",
      why: "Your area, services and customers go into every report.",
      href: "/app/settings",
      action: "Edit profile",
      done: [ws.industry, ws.location, ws.offers, ws.audience].every((v) => String(v ?? "").trim().length > 2),
    },
    { id: "site", label: "Check your website", why: "About a minute. Most of your first fixes come from here.", href: "/app/agents/site", action: "Run it", done: !!latestRun(ws.id, "site") },
    plan.id === "free"
      ? { id: "connect", label: "Connect Google, Meta and your socials", why: "On the paid plans: reports read your real numbers and your own posts.", href: "/app/settings#plan", action: "See plans", done: false }
      : {
          id: "connect",
          label: "Connect Google, Meta and your socials",
          why: "Reports read your real numbers and your own posts instead of guesses.",
          href: "/app/settings/connections",
          action: "Connect",
          done: PROVIDERS.some((p) => getConnection(ws.id, p)),
        },
    ...(plan.gbp
      ? [{ id: "gbp", label: "Pick this outlet's Google Business Profile", why: "Unlocks profile fixes, posts and review replies.", href: "/app/settings/connections", action: "Pick it", done: selectedAccounts(ws.id, "gbp_location").length > 0 }]
      : []),
    ...(plan.specialists.includes("content")
      ? [{ id: "content", label: "Get your first content plan", why: "Ideas with the script, caption and shoot style written out.", href: "/app/agents/content", action: "Write it", done: !!latestRun(ws.id, "content") }]
      : []),
    { id: "fix", label: "Mark your first fix done", why: "Your Pulse Score moves when fixes are done, not just found.", href: "/app/plan", action: "Open board", done: count("done") > 0 },
  ];
  const profile = {
    name: ws.name,
    website: ws.website,
    industry: ws.industry,
    location: ws.location,
    country: ws.country,
    audience: ws.audience,
    offers: ws.offers,
    competitors: ws.competitors,
    goals: ws.goals,
    regulated: !!ws.regulated,
  };

  return (
    <div className="space-y-12">
      <div className="rise flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Label className="text-scrub">{today}</Label>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-[-0.035em] md:text-6xl">
            {hasRuns ? `${partOfDay} check, ${firstName}.` : `Welcome, ${firstName}.`}
          </h1>
        </div>
        <div className="flex gap-2 text-sm font-semibold">
          <span className="rounded-full bg-card px-4 py-2 shadow-[var(--shadow-box)]">
            <span className="tabular-nums">{count("todo") + count("doing")}</span> to do
          </span>
          <span className="rounded-full bg-good/10 px-4 py-2 text-good">
            <span className="tabular-nums">{count("done")}</span> done
          </span>
        </div>
      </div>

      {!hasRuns && (
        <section className="pillbox rise grid gap-6 bg-tangerine p-6 md:grid-cols-[1fr_1.1fr] md:p-10">
          <div>
            <span className="inline-flex rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">Start here</span>
            <h2 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">Run your first checkup</h2>
            <p className="mt-3 max-w-md text-[17px] leading-relaxed text-ink/80">
              Site Doctor opens your website the way Google and your customers see it, then writes a prescription for every problem it finds. It takes about a minute, and the
              rest of this page fills in from there.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-box)]">
            <SiteForm profile={profile} connected={connectedSources(ws)} lastInput={null} />
          </div>
        </section>
      )}

      {hasRuns && <SetupChecklist steps={steps} />}

      {/* On a phone the to-do list comes before the scoreboard: it's what you open the app for. */}
      <div className="flex flex-col gap-12">
        {hasRuns && (
          <section className="rise order-2 grid gap-4 md:order-none lg:grid-cols-[1.1fr_1fr_1fr]">
            <div className="pillbox flex items-center gap-6 bg-ink p-6 text-white">
              <div className="rounded-full bg-white p-1.5">
                <ScoreDial score={pulse.score} label="Pulse" />
              </div>
              <div>
                <p className="font-display text-xl font-bold">Your marketing pulse</p>
                <p className="mt-1 text-sm leading-relaxed text-white/70">From the latest report of each specialist, plus how many fixes you&apos;ve done.</p>
              </div>
            </div>
            <Card className="space-y-3.5 p-6">
              {pulse.parts.map((p) => (
                <Meter key={p.key} label={p.label} value={p.value} />
              ))}
            </Card>
            <Card className="flex flex-col p-6">
              <Label>Pulse over time</Label>
              <div className="flex-1 pt-3">
                {history.length > 1 ? (
                  <Sparkline points={history.map((h) => h.score)} labels={history.map((h) => h.day)} />
                ) : (
                  <p className="text-sm leading-relaxed text-ink-3">Your trend line starts once you have scores on two different days. Mark fixes done and re-run checkups to see it move.</p>
                )}
              </div>
            </Card>
          </section>
        )}

        {hasRuns && (
          <section className="order-1 md:order-none">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Do these next</h2>
              <Link href="/app/plan" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-scrub hover:underline">
                All prescriptions <ArrowRight size={15} />
              </Link>
            </div>
            {tasks.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {tasks.map((t) => (
                  <RxSlip pulseLink={false} key={t.id} data={{ ...t, where: t.where_to, agentName: AGENTS[t.agent as keyof typeof AGENTS]?.name }} />
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing open. Nice work.">Re-run a checkup to confirm your fixes worked, or try a specialist you haven&apos;t used yet.</EmptyState>
            )}
          </section>
        )}
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Who do you want to see?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_ORDER.map((id) => {
            const a = AGENTS[id];
            const last = latestRun(ws.id, id);
            const locked = !agentAllowed(ws, id);
            return (
              <Link key={id} href={`/app/agents/${id}`} className={`pillbox group flex min-h-[176px] flex-col p-6 ${agentColor(id).box}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-white/60 px-2.5 py-0.5 font-display text-sm font-extrabold italic">℞</span>
                  {locked ? (
                    <Badge className="bg-white/70 ring-transparent">{id === "gbp" ? "Pro" : "Paid plans"}</Badge>
                  ) : last?.score != null ? (
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-bold tabular-nums" style={{ color: scoreColor(last.score) }}>
                      {last.score}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.02em]">{a.name}</h3>
                <p className="mt-1 text-[15px] leading-snug text-ink/75">{a.blurb}</p>
                <p className="mt-auto pt-4 text-xs font-semibold text-ink/60">
                  {last ? `Last visit ${new Date(last.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: tz })}` : "Not seen yet"}
                </p>
              </Link>
            );
          })}
          <Link href="/app/ask" className="pillbox group flex min-h-[176px] flex-col bg-ink p-6 text-white">
            <span className="w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">Chat</span>
            <h3 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.02em]">Ask PULSE</h3>
            <p className="mt-1 text-[15px] leading-snug text-white/70">A strategist that has read all your reports. Ask what to do next.</p>
          </Link>
        </div>
      </section>

      {hasRuns && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Recent reports</h2>
            <Link href="/app/reports" className="text-sm font-semibold text-scrub hover:underline">
              All reports
            </Link>
          </div>
          <Card className="divide-y divide-line overflow-hidden">
            {recent.map((r) => (
              <Link key={r.id} href={`/app/runs/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-paper">
                <span className={`h-3 w-3 shrink-0 rounded-full ${agentColor(r.agent).dot}`} aria-hidden />
                <span className="flex-1 truncate font-medium">{r.title}</span>
                {r.demo ? <Badge tone="amber">Sample</Badge> : null}
                {r.status === "error" && <Badge tone="red">Failed</Badge>}
                {(r.status === "running" || r.status === "queued") && <Badge tone="amber">Working</Badge>}
                {r.score != null && <Badge tone={scoreTone(r.score)}>{r.score}</Badge>}
                <span className="hidden text-xs text-ink-3 sm:inline">
                  {new Date(r.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: tz })}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
