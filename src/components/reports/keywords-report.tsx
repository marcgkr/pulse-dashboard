"use client";

import { useState } from "react";
import { ExternalLink, FileText, Search, Zap } from "lucide-react";
import type { AeoQuestion, ContentBrief, DataColumn, KeywordCluster, ParsedData } from "@/lib/agents/keywords-demo";
import { isQuickWinRow } from "@/lib/agents/keywords-demo";
import { Badge, Card, Label, cx } from "../ui";
import { CopyButton } from "../copy-button";
import { useRunAgent } from "../run-agent";

type KeywordsResult = {
  mode?: "discover" | "expand";
  seeds?: string[];
  location?: string;
  expand?: string;
  clusters?: KeywordCluster[];
  aeo_questions?: AeoQuestion[];
  content_briefs?: ContentBrief[];
  quick_wins?: string[];
  data?: ParsedData | null;
  score_note?: string | null;
  sources?: { title: string; url: string }[];
};

type RunRef = { id: string; input: Record<string, unknown> } | undefined;

type Tone = "neutral" | "green" | "red" | "amber" | "ink";
const intentTone: Record<string, Tone> = { buy: "green", local: "green", compare: "amber", learn: "neutral" };
const intentLabel: Record<string, string> = { buy: "Buy", local: "Local", compare: "Compare", learn: "Learn" };
const priorityTone: Record<string, Tone> = { high: "ink", medium: "neutral", low: "neutral" };
const difficultyTone: Record<string, Tone> = { easy: "green", medium: "amber", hard: "red" };

// ---------- Expand (drill-down) ----------

function useExpand(run: RunRef) {
  const { start, pending, error } = useRunAgent("keywords");
  const go = (keyword: string) => {
    if (!run) return;
    void start({ ...run.input, focus: "expand", expand: keyword }, run.id);
  };
  return { go, pending, error, enabled: Boolean(run) };
}

function KeywordChip({ keyword, run, primary }: { keyword: string; run: RunRef; primary?: boolean }) {
  const { go, pending, error, enabled } = useExpand(run);
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-stretch overflow-hidden rounded border text-sm",
        primary ? "border-scrub/40 bg-mint" : "border-line bg-paper",
        error && "border-pulse/50",
      )}
      title={error ?? undefined}
    >
      <span className={cx("break-words px-2 py-1", primary && "font-semibold text-scrub-dark")}>{keyword}</span>
      {enabled && (
        <button
          type="button"
          onClick={() => go(keyword)}
          disabled={pending}
          aria-label={`Expand "${keyword}"`}
          title={error ?? `Expand "${keyword}" into long-tail keywords and questions`}
          className="inline-flex shrink-0 items-center gap-1 border-l border-line px-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3 hover:bg-card hover:text-scrub disabled:opacity-50"
        >
          <Search size={11} />
          <span className="hidden sm:inline">{pending ? "..." : "Expand"}</span>
        </button>
      )}
    </span>
  );
}

function ExpandClusterButton({ keyword, run }: { keyword: string; run: RunRef }) {
  const { go, pending, error, enabled } = useExpand(run);
  if (!enabled) return null;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => go(keyword)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-scrub/40 bg-white px-2 py-1 text-xs font-semibold text-scrub hover:bg-mint disabled:opacity-50"
      >
        <Search size={13} /> {pending ? "Starting..." : `Expand "${keyword}"`}
      </button>
      {error && <span className="text-xs text-pulse">{error}</span>}
    </span>
  );
}

// ---------- Sections ----------

function ClusterCard({ c, run }: { c: KeywordCluster; run: RunRef }) {
  const primary = c.keywords[0] ?? c.name;
  return (
    <Card className="flex flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold leading-snug">{c.name}</h3>
        <Badge tone={priorityTone[c.priority] ?? "neutral"}>{c.priority} priority</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={intentTone[c.intent] ?? "neutral"}>Intent: {intentLabel[c.intent] ?? c.intent}</Badge>
        <Badge tone="neutral" title="Estimate relative to the other clusters, not a search volume">
          Demand (est.): {c.relative_demand}
        </Badge>
        <Badge tone={difficultyTone[c.difficulty] ?? "neutral"}>Difficulty: {c.difficulty}</Badge>
      </div>

      <div className="mt-3 rounded-md border border-line bg-paper/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{c.target_page.action === "create" ? "New page to create" : "Page to optimise"}</Label>
          <CopyButton text={c.target_page.slug} label="Copy URL" />
        </div>
        <p className="mt-1 text-sm font-semibold">{c.target_page.page}</p>
        <p className="break-all font-mono text-xs text-ink-2">{c.target_page.slug}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.keywords.map((k, i) => (
          <KeywordChip key={k} keyword={k} run={run} primary={i === 0} />
        ))}
      </div>

      {c.why && <p className="mt-3 text-sm text-ink-2">{c.why}</p>}

      <div className="mt-auto flex flex-wrap items-start gap-2 pt-4">
        <CopyButton text={c.keywords.join("\n")} label="Copy keywords" />
        <ExpandClusterButton keyword={primary} run={run} />
      </div>
    </Card>
  );
}

function briefText(b: ContentBrief): string {
  return [
    `Title tag: ${b.title}`,
    `URL: ${b.slug}`,
    `H1: ${b.h1}`,
    "",
    "Outline:",
    ...b.outline.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Must include:",
    ...b.must_include.map((s) => `- ${s}`),
    "",
    "Internal links:",
    ...b.internal_links.map((s) => `- ${s}`),
  ].join("\n");
}

function BriefCard({ b }: { b: ContentBrief }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label className="mb-1 flex items-center gap-1.5">
            <FileText size={12} /> Page brief
          </Label>
          <h3 className="font-display text-lg font-semibold leading-snug">{b.h1}</h3>
          <p className="break-all font-mono text-xs text-ink-3">{b.slug}</p>
        </div>
        <CopyButton text={briefText(b)} label="Copy brief" />
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-md border border-line bg-paper/60 px-3 py-2 text-sm">
        <span className="w-16 shrink-0 font-mono text-[11px] uppercase tracking-wider text-ink-3">Title</span>
        <span className="min-w-0 flex-1 break-words">{b.title}</span>
        <CopyButton text={b.title} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label>Outline</Label>
            <CopyButton text={b.outline.join("\n")} label="Copy outline" />
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm marker:font-mono marker:text-ink-3">
            {b.outline.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          {b.must_include.length > 0 && (
            <div>
              <Label className="mb-1.5">Must include</Label>
              <ul className="space-y-1 text-sm text-ink-2">
                {b.must_include.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-scrub" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {b.internal_links.length > 0 && (
            <div>
              <Label className="mb-1.5">Internal links</Label>
              <ul className="space-y-1 text-sm text-ink-2">
                {b.internal_links.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

const colLabel: Record<DataColumn, string> = {
  clicks: "Clicks",
  impressions: "Impr.",
  ctr: "CTR",
  position: "Pos.",
  searches: "Avg. monthly searches",
  competition: "Competition",
};

function DataTable({ data }: { data: ParsedData }) {
  const [all, setAll] = useState(false);
  const rows = all ? data.rows : data.rows.slice(0, 25);
  const num = (n: number | null) => (n == null ? "" : n.toLocaleString("en-SG"));
  const gsc = data.source === "search_console";
  const wins = gsc ? data.rows.filter(isQuickWinRow).length : 0;
  return (
    <section>
      <Label className="mb-2">Your data</Label>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm">
          <Badge tone="ink">{gsc ? "Search Console" : data.source === "keyword_planner" ? "Keyword Planner" : "Keyword list"}</Badge>
          <span className="text-ink-2">
            {data.total_rows.toLocaleString("en-SG")} rows read{data.skipped ? `, ${data.skipped} lines skipped` : ""}
          </span>
          {data.totals && (
            <span className="font-mono text-xs text-ink-2">
              {num(data.totals.clicks)} clicks / {num(data.totals.impressions)} impr.
              {data.totals.ctr != null && ` / ${data.totals.ctr}% CTR`}
              {data.totals.avg_position != null && ` / avg pos ${data.totals.avg_position}`}
            </span>
          )}
          {wins > 0 && <Badge tone="amber">{wins} at positions 5-15</Badge>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2">Query</th>
                {data.columns.map((c) => (
                  <th key={c} className={cx("whitespace-nowrap px-3 py-2", c !== "competition" && "text-right")}>
                    {colLabel[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const win = gsc && isQuickWinRow(r);
                return (
                  <tr key={r.query} className={cx("border-b border-line last:border-0", win && "bg-amber/5")}>
                    <td className="min-w-[10rem] px-4 py-2">
                      {r.query}
                      {win && (
                        <Badge tone="amber" className="ml-2 align-middle">
                          Quick win
                        </Badge>
                      )}
                    </td>
                    {data.columns.map((c) => (
                      <td key={c} className={cx("whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums", c !== "competition" && "text-right")}>
                        {c === "searches"
                          ? r.searches != null
                            ? num(r.searches)
                            : r.searches_label ?? ""
                          : c === "ctr"
                            ? r.ctr == null
                              ? ""
                              : `${r.ctr}%`
                            : c === "competition"
                              ? r.competition ?? ""
                              : num(r[c])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.rows.length > 25 && (
          <div className="border-t border-line px-4 py-2">
            <button type="button" className="text-sm font-semibold text-scrub hover:underline" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${data.rows.length} rows`}
            </button>
          </div>
        )}
      </Card>
    </section>
  );
}

// ---------- Report ----------

export function KeywordsReport({ result, run }: { result: KeywordsResult; run?: RunRef }) {
  const clusters = result.clusters ?? [];
  const questions = result.aeo_questions ?? [];
  const briefs = result.content_briefs ?? [];
  const wins = result.quick_wins ?? [];
  const sources = result.sources ?? [];
  const runRef: RunRef = run?.id ? { id: run.id, input: run.input ?? {} } : undefined;

  return (
    <div className="space-y-8">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="ink">{result.expand ? "Drill-down" : "Keyword map"}</Badge>
          {result.expand && (
            <span>
              Expanding <span className="font-semibold">&lsquo;{result.expand}&rsquo;</span>
            </span>
          )}
          {result.location && <Badge tone="neutral">{result.location}</Badge>}
          {!result.expand &&
            (result.seeds ?? []).slice(0, 6).map((s) => (
              <Badge key={s} tone="green">
                {s}
              </Badge>
            ))}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Demand and difficulty are estimates for comparing clusters, not search volumes.
          {result.data ? " Numbers in the data table come from the export you pasted." : " For real monthly searches, check Google Keyword Planner."}
          {runRef && " Click Expand on any keyword to drill deeper; the new report links back here."}
        </p>
        {result.score_note && <p className="mt-2 border-t border-line pt-2 text-sm text-ink-2">{result.score_note}</p>}
      </Card>

      {clusters.length > 0 && (
        <section>
          <Label className="mb-2">{result.expand ? "Variants by modifier" : "Keyword clusters"}</Label>
          <div className="grid gap-3 lg:grid-cols-2">
            {clusters.map((c, i) => (
              <ClusterCard key={`${c.name}-${i}`} c={c} run={runRef} />
            ))}
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <Label>Questions people ask AI assistants</Label>
            <CopyButton text={questions.map((q) => q.question).join("\n")} label="Copy all questions" />
          </div>
          <Card className="divide-y divide-line">
            <div className="hidden grid-cols-[2fr_2fr_1.2fr_1fr_auto] gap-3 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-3 md:grid">
              <span>Question</span>
              <span>Answer angle</span>
              <span>Where to answer</span>
              <span>Format</span>
              <span className="w-[4.5rem]" />
            </div>
            {questions.map((q, i) => (
              <div key={i} className="grid gap-1.5 px-4 py-3 text-sm md:grid-cols-[2fr_2fr_1.2fr_1fr_auto] md:gap-3">
                <div className="flex items-start justify-between gap-2 md:block">
                  <p className="font-semibold">{q.question}</p>
                  <span className="md:hidden">
                    <CopyButton text={q.question} />
                  </span>
                </div>
                <p className="text-ink-2">{q.answer_angle}</p>
                <p className="text-ink-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3 md:hidden">Where: </span>
                  {q.where_to_answer}
                </p>
                <div>
                  <Badge tone="neutral">{q.format}</Badge>
                </div>
                <div className="hidden md:block">
                  <CopyButton text={q.question} />
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {briefs.length > 0 && (
        <section>
          <Label className="mb-2">Briefs for new pages</Label>
          <div className="space-y-3">
            {briefs.map((b, i) => (
              <BriefCard key={`${b.slug}-${i}`} b={b} />
            ))}
          </div>
        </section>
      )}

      {wins.length > 0 && (
        <section>
          <Label className="mb-2">Quick wins</Label>
          <Card className="divide-y divide-line">
            {wins.map((w, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 text-sm">
                <Zap size={15} className="mt-0.5 shrink-0 text-amber" />
                <p>{w}</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      {result.data && result.data.rows.length > 0 && <DataTable data={result.data} />}

      {sources.length > 0 && (
        <section>
          <Label className="mb-2">Pages we looked at</Label>
          <Card className="divide-y divide-line">
            {sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-4 py-2 text-sm hover:bg-paper"
              >
                <ExternalLink size={13} className="mt-1 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block truncate">{s.title || s.url}</span>
                  <span className="block truncate font-mono text-[11px] text-ink-3">{(() => {
                    try {
                      return new URL(s.url).hostname;
                    } catch {
                      return s.url;
                    }
                  })()}</span>
                </span>
              </a>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
