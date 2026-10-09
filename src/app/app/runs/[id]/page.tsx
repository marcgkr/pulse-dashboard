import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAgent } from "@/lib/agents";
import { requireWorkspace } from "@/lib/auth";
import { marketFor } from "@/lib/markets";
import { db, type RunRow, type TaskRow } from "@/lib/db";
import { feedbackForRun } from "@/lib/memory";
import { parseTask } from "@/lib/runs";
import { AGENT_REPORTS } from "@/components/reports";
import { RunProgress } from "@/components/run-agent";
import { RxSlip } from "@/components/rx-slip";
import { ReportNotes } from "@/components/feedback-bar";
import { ScoreDial } from "@/components/brand";
import { Badge, ButtonLink, Card, Label } from "@/components/ui";
import { agentColor } from "@/lib/agent-colors";
import { RerunButton } from "@/components/rerun-button";
import type { AgentId } from "@/lib/agents/types";
import { clientInput } from "@/lib/client-input";

export const metadata = { title: "Report" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ws } = await requireWorkspace();
  const tz = marketFor(ws.country).timeZone;
  const run = db().prepare("SELECT * FROM runs WHERE id = ? AND workspace_id = ?").get(id, ws.id) as RunRow | undefined;
  if (!run) notFound();
  const agent = getAgent(run.agent);
  const input = clientInput(run.agent, JSON.parse(run.input_json) as Record<string, unknown>);
  const parent = run.parent_run_id ? (db().prepare("SELECT id, title FROM runs WHERE id = ? AND workspace_id = ?").get(run.parent_run_id, ws.id) as { id: string; title: string } | undefined) : undefined;

  const header = (
    <div className="mb-6">
      <Link href={`/app/agents/${run.agent}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> {agent?.name ?? "Back"}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${agentColor(run.agent).box}`}>℞ {agent?.name ?? run.agent}</span>
        <Label>{new Date(run.created_at).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: tz })}</Label>
        {run.demo ? <Badge tone="amber">Sample output</Badge> : null}
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">{run.title}</h1>
      {parent && (
        <p className="mt-1 text-sm text-ink-3">
          Follow-up to <Link href={`/app/runs/${parent.id}`} className="text-scrub hover:underline">{parent.title}</Link>
        </p>
      )}
    </div>
  );

  if (run.status === "queued" || run.status === "running") {
    return (
      <div className="max-w-2xl">
        {header}
        <RunProgress runId={run.id} initial={run.progress} />
      </div>
    );
  }

  if (run.status === "error") {
    return (
      <div className="max-w-2xl">
        {header}
        <Card className="border-pulse/30 p-6">
          <p className="font-display text-lg font-semibold text-pulse">This checkup didn&apos;t finish.</p>
          <p className="mt-1 text-ink-2">{run.error}</p>
          <div className="mt-4 flex gap-2">
            <RerunButton agent={run.agent} rerunOf={run.id} label="Try again" />
            <ButtonLink href={`/app/agents/${run.agent}`} variant="secondary">
              Change the input
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const result = JSON.parse(run.result_json ?? "{}") as { summary?: string; score?: number | null; demo?: boolean };
  const tasks = (db().prepare("SELECT * FROM tasks WHERE run_id = ? AND workspace_id = ? ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END").all(run.id, ws.id) as TaskRow[]).map(parseTask);
  const Report = AGENT_REPORTS[run.agent as AgentId];
  const feedback = Object.fromEntries(feedbackForRun(ws.id, run.id).map((f) => [f.item, { verdict: f.verdict, comment: f.comment }]));

  return (
    <div>
      {header}
      <Card className="mb-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
        {run.score != null && <ScoreDial score={run.score} label="Score" />}
        <div className="flex-1">
          <Label className="mb-1.5 text-scrub">Diagnosis</Label>
          <p className="font-display text-xl font-semibold leading-snug tracking-[-0.01em] md:text-[22px]">{result.summary}</p>
          {result.demo && (
            <p className="mt-2 text-sm text-amber">
              This is sample output because no Anthropic API key is set. Real checks (like the website crawl) still ran where possible.
            </p>
          )}
        </div>
        <div className="shrink-0">
          <RerunButton agent={run.agent} rerunOf={run.id} label="Re-check" />
        </div>
      </Card>

      {tasks.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Your prescriptions</h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">They&apos;re on your Prescriptions board too. Mark them done as you go.</p>
          <div className="grid gap-4 xl:grid-cols-2">
            {tasks.map((t, i) => (
              <RxSlip key={t.id} defaultOpen={i === 0} data={{ ...t, where: t.where_to }} />
            ))}
          </div>
        </section>
      )}

      <div style={{ "--rx-accent": agentColor(run.agent).accent } as CSSProperties}>
        {Report && <Report result={result} run={{ id: run.id, agent: run.agent, title: run.title, created_at: run.created_at, input }} feedback={feedback} />}
        <div className="mt-12">
          <ReportNotes runId={run.id} agentName={getAgent(run.agent)?.name ?? "This specialist"} initial={feedback[""]} />
        </div>
      </div>
    </div>
  );
}
