import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import type { SiteAudit, Check } from "@/lib/agents/site-audit";
import { Meter } from "../brand";
import { Badge, Card, Label } from "../ui";
import { CopyButton } from "../copy-button";

type SiteResult = {
  strengths?: string[];
  rewrite?: { title: string; meta_description: string; h1: string } | null;
  faq?: { question: string; answer: string }[];
  audit: SiteAudit;
};

const icon = {
  pass: <CheckCircle2 size={16} className="text-scrub" />,
  warn: <CircleAlert size={16} className="text-amber" />,
  fail: <CircleX size={16} className="text-pulse" />,
};

export function SiteReport({ result }: { result: SiteResult }) {
  const a = result.audit;
  const groups = Object.keys(a.groupScores) as (keyof typeof a.groupScores)[];
  return (
    <div className="space-y-8">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Badge tone="ink">{a.platform}</Badge>
          <span className="font-mono text-xs">{a.finalUrl}</span>
          {a.pageSpeed?.performance != null && <Badge tone="neutral">Mobile speed {a.pageSpeed.performance}/100</Badge>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {groups.map((g) => (
            <Meter key={g} label={g} value={a.groupScores[g]} />
          ))}
        </div>
      </Card>

      {result.strengths && result.strengths.length > 0 && (
        <section>
          <Label className="mb-2">Already working</Label>
          <ul className="grid gap-2 md:grid-cols-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-scrub" /> {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.rewrite && (
        <section>
          <Label className="mb-2">Copy to paste into your homepage</Label>
          <Card className="divide-y divide-line">
            {(
              [
                ["Title tag", result.rewrite.title],
                ["Meta description", result.rewrite.meta_description],
                ["H1 headline", result.rewrite.h1],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-start gap-4 p-4">
                <div className="w-36 shrink-0 text-sm font-semibold">{k}</div>
                <div className="flex-1 text-sm">{v}</div>
                <CopyButton text={v} />
              </div>
            ))}
          </Card>
        </section>
      )}

      {result.faq && result.faq.length > 0 && (
        <section>
          <Label className="mb-2">FAQ drafts for AI search</Label>
          <div className="grid gap-3 md:grid-cols-2">
            {result.faq.map((f, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{f.question}</p>
                  <CopyButton text={`${f.question}\n${f.answer}`} />
                </div>
                <p className="mt-1 text-sm text-ink-2">{f.answer}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <Label className="mb-2">Every check we ran</Label>
        <Card className="divide-y divide-line">
          {a.checks
            .slice()
            .sort((x: Check, y: Check) => ["fail", "warn", "pass"].indexOf(x.status) - ["fail", "warn", "pass"].indexOf(y.status))
            .map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5">{icon[c.status]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{c.label}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{c.group}</span>
                  </div>
                  <p className="break-words text-sm text-ink-2">{c.detail}</p>
                </div>
              </div>
            ))}
        </Card>
      </section>

      {a.pages.length > 0 && (
        <section>
          <Label className="mb-2">Pages we opened</Label>
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2">Page</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2 text-right">Words</th>
                </tr>
              </thead>
              <tbody>
                {a.pages.map((p) => (
                  <tr key={p.url} className="border-b border-line last:border-0">
                    <td className="max-w-[16rem] truncate px-4 py-2 font-mono text-xs">{new URL(p.url).pathname}</td>
                    <td className="px-4 py-2">
                      <Badge tone={p.status >= 200 && p.status < 400 ? "green" : "red"}>{p.status || "fail"}</Badge>
                    </td>
                    <td className="px-4 py-2">{p.title || <span className="text-pulse">Missing</span>}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{p.wordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
