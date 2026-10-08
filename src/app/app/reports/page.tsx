import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { requireWorkspace } from "@/lib/auth";
import { db, type RunRow } from "@/lib/db";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, scoreTone } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { ws } = await requireWorkspace();
  const runs = db().prepare("SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200").all(ws.id) as RunRow[];
  return (
    <div>
      <PageHeader eyebrow="Medical records" title="Reports">
        Every checkup you&apos;ve run, newest first.
      </PageHeader>
      {runs.length === 0 ? (
        <EmptyState title="No reports yet" action={<ButtonLink href="/app/agents/site">Run your first checkup</ButtonLink>} />
      ) : (
        <Card className="divide-y divide-line">
          {runs.map((r) => (
            <Link key={r.id} href={`/app/runs/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper">
              <span className="w-32 font-mono text-[11px] uppercase tracking-wider text-ink-3">{AGENTS[r.agent as keyof typeof AGENTS]?.name ?? r.agent}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
              {r.demo ? <Badge tone="amber">Sample</Badge> : null}
              {r.status === "error" && <Badge tone="red">Failed</Badge>}
              {(r.status === "running" || r.status === "queued") && <Badge tone="amber">Working</Badge>}
              {r.score != null && <Badge tone={scoreTone(r.score)}>{r.score}</Badge>}
              <span className="font-mono text-xs text-ink-3">{new Date(r.created_at).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" })}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
