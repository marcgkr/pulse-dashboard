import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import type { SiteAudit, Check } from "@/lib/agents/site-audit";
import { Meter } from "../brand";
import { Badge, Card, ReportSection } from "../ui";
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
    <div className="space-y-12">
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
        <ReportSection title="Already working" hint="Keep these as they are.">
          <ul className="grid gap-2 md:grid-cols-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex gap-2.5 rounded-md border border-line bg-card px-4 py-3 text-[15px] leading-relaxed">
                <CheckCircle2 size={16} className="mt-1 shrink-0 text-scrub" /> {s}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {result.rewrite && (
        <ReportSection title="Copy to paste into your homepage" hint="Replace the current title tag, meta description and main headline with these.">
          <Card className="divide-y divide-line">
            {(
              [
                ["Title tag", result.rewrite.title],
                ["Meta description", result.rewrite.meta_description],
                ["H1 headline", result.rewrite.h1],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-5 sm:flex-nowrap">
                <div className="w-full shrink-0 text-sm font-semibold text-ink-2 sm:w-36 sm:pt-0.5">{k}</div>
                <div className="min-w-0 max-w-3xl flex-1 break-words text-[15px] leading-relaxed">{v}</div>
                <CopyButton text={v} />
              </div>
            ))}
          </Card>
        </ReportSection>
      )}

      {result.faq && result.faq.length > 0 && (
        <ReportSection title="FAQ drafts for AI search" hint="Add these questions and answers to your site so AI assistants have clear answers to quote.">
          <div className="grid gap-3 md:grid-cols-2">
            {result.faq.map((f, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">{f.question}</p>
                  <CopyButton text={`${f.question}\n${f.answer}`} />
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.answer}</p>
              </Card>
            ))}
          </div>
        </ReportSection>
      )}

      <ReportSection title="Every check we ran" hint="Failed checks first, then warnings, then passes.">
        <Card className="divide-y divide-line">
          {a.checks
            .slice()
            .sort((x: Check, y: Check) => ["fail", "warn", "pass"].indexOf(x.status) - ["fail", "warn", "pass"].indexOf(y.status))
            .map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-1">{icon[c.status]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{c.group}</span>
                  </div>
                  <p className="mt-0.5 max-w-3xl break-words text-[15px] leading-relaxed text-ink-2">{c.detail}</p>
                </div>
              </div>
            ))}
        </Card>
      </ReportSection>

      {a.pages.length > 0 && (
        <ReportSection title="Pages we opened">
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-ink-2">
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
        </ReportSection>
      )}
    </div>
  );
}
