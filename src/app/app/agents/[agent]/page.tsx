import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgent } from "@/lib/agents";
import { requireWorkspace } from "@/lib/auth";
import { db, type RunRow } from "@/lib/db";
import { agentAllowed } from "@/lib/runs";
import { AGENT_FORMS } from "@/components/forms";
import { Badge, ButtonLink, Card, Label, PageHeader, scoreTone } from "@/components/ui";
import type { AgentId } from "@/lib/agents/types";

export async function generateMetadata({ params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  return { title: getAgent(agent)?.name ?? "Specialist" };
}

export default async function AgentPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) notFound();
  const { ws } = await requireWorkspace();
  const runs = db().prepare("SELECT * FROM runs WHERE workspace_id = ? AND agent = ? ORDER BY created_at DESC LIMIT 20").all(ws.id, agent.id) as RunRow[];
  const lastInput = runs.find((r) => r.status === "done")?.input_json;
  const Form = AGENT_FORMS[agent.id as AgentId];
  const allowed = agentAllowed(ws, agent.id);

  return (
    <div>
      <PageHeader eyebrow="Specialist" title={agent.name}>
        {agent.description}
      </PageHeader>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 md:p-6">
          {allowed ? (
            <Form
              profile={{
                name: ws.name,
                website: ws.website,
                industry: ws.industry,
                location: ws.location,
                audience: ws.audience,
                offers: ws.offers,
                competitors: ws.competitors,
                goals: ws.goals,
                regulated: !!ws.regulated,
              }}
              windsorConnected={!!ws.windsor_api_key}
              lastInput={lastInput ? JSON.parse(lastInput) : null}
            />
          ) : (
            <div>
              <p className="font-display text-lg font-semibold">{agent.name} is on the paid plans.</p>
              <p className="mt-1 text-sm text-ink-2">The free Checkup plan includes Site Doctor. Upgrade to use every specialist.</p>
              <ButtonLink href="/app/settings#plan" className="mt-4">
                See plans
              </ButtonLink>
            </div>
          )}
        </Card>
        <div>
          <Label className="mb-2">Past visits</Label>
          {runs.length === 0 ? (
            <p className="text-sm text-ink-3">No reports yet. Your first one will show up here.</p>
          ) : (
            <Card className="divide-y divide-line">
              {runs.map((r) => (
                <Link key={r.id} href={`/app/runs/${r.id}`} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-paper">
                  <span className="flex-1 truncate">{r.title}</span>
                  {r.demo ? <Badge tone="amber">Sample</Badge> : null}
                  {r.status === "error" && <Badge tone="red">Failed</Badge>}
                  {(r.status === "running" || r.status === "queued") && <Badge tone="amber">Working</Badge>}
                  {r.score != null && <Badge tone={scoreTone(r.score)}>{r.score}</Badge>}
                  <span className="font-mono text-xs text-ink-3">{new Date(r.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}</span>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
