"use client";

import { useState } from "react";
import { ExternalLink, FileText, PenLine, Search, Zap } from "lucide-react";
import type { AeoQuestion, ContentBrief, DataColumn, KeywordCluster, ParsedData } from "@/lib/agents/keywords-demo";
import { isQuickWinRow } from "@/lib/agents/keywords-demo";
import { PAGE_TYPES, briefKeyword, suggestPageType, type Article, type PageType } from "@/lib/agents/article-format";
import { Badge, Card, Label, ReportSection, cx } from "../ui";
import { CopyButton } from "../copy-button";
import { useRunAgent } from "../run-agent";
import { ArticleReport, type ArticleResultView } from "./article-report";

type KeywordsResult = {
  mode?: "discover" | "expand" | "article";
  seeds?: string[];
  location?: string;
  expand?: string;
  clusters?: KeywordCluster[];
  aeo_questions?: AeoQuestion[];
  content_briefs?: ContentBrief[];
  quick_wins?: string[];
  data?: ParsedData | null;
  data_from?: string | null;
  score_note?: string | null;
  sources?: { title: string; url: string }[];
  /** Article mode ("Write this article" on a brief). */
  article?: Article;
  brief?: ArticleResultView["brief"];
  video_note?: string | null;
  regulated?: boolean;
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
    // The public sample report (/sample) has no account behind it: send visitors to sign up.
    if (run.id === "sample") return window.location.assign("/signup?from=sample");
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
          className="inline-flex shrink-0 items-center gap-1 border-l border-line px-2 text-xs font-semibold text-ink-2 hover:bg-card hover:text-scrub disabled:opacity-50"
        >
          <Search size={12} />
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
    <Card className="flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-display text-lg font-semibold leading-snug">{c.name}</h4>
        <Badge tone={priorityTone[c.priority] ?? "neutral"}>{c.priority} priority</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={intentTone[c.intent] ?? "neutral"}>Intent: {intentLabel[c.intent] ?? c.intent}</Badge>
        <Badge tone="neutral" title="Estimate relative to the other clusters, not a search volume">
          Demand (est.): {c.relative_demand}
        </Badge>
        <Badge tone={difficultyTone[c.difficulty] ?? "neutral"}>Difficulty: {c.difficulty}</Badge>
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Label>{c.target_page.action === "create" ? "New page to create" : "Page to optimise"}</Label>
          <CopyButton text={c.target_page.slug} label="Copy URL" />
        </div>
        <p className="mt-1 text-[15px] font-semibold">{c.target_page.page}</p>
        <p className="break-all font-mono text-xs text-ink-2">{c.target_page.slug}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.keywords.map((k, i) => (
          <KeywordChip key={k} keyword={k} run={run} primary={i === 0} />
        ))}
      </div>

      {c.why && <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{c.why}</p>}

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

/** Starts a Keyword Lab run in article mode from one brief, as a blog article or a website page. */
function WriteArticleButton({ b, run }: { b: ContentBrief; run: RunRef }) {
  const { start, pending, error } = useRunAgent("keywords");
  const [type, setType] = useState<PageType>(() => suggestPageType(b));
  if (!run) return null;
  const go = () => {
    // The public sample report (/sample) has no account behind it: send visitors to sign up.
    if (run.id === "sample") return window.location.assign("/signup?from=sample");
    void start(
      {
        ...run.input,
        article: {
          page_type: type,
          title: b.title,
          target_keyword: briefKeyword(b),
          slug: b.slug,
          h1: b.h1,
          outline: b.outline,
          must_include: b.must_include,
          internal_links: b.internal_links,
        },
      },
      run.id,
    );
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-stretch">
        <select
          aria-label="Page type"
          value={type}
          onChange={(e) => setType(e.target.value as PageType)}
          disabled={pending}
          className="rounded-l border border-r-0 border-scrub/40 bg-white px-1.5 py-1 text-xs font-semibold text-ink-2 disabled:opacity-50"
        >
          {PAGE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={go}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-r border border-scrub/40 bg-white px-2 py-1 text-xs font-semibold text-scrub hover:bg-mint disabled:opacity-50"
        >
          <PenLine size={13} /> {pending ? "Starting..." : type === "article" ? "Write this article" : "Write this page"}
        </button>
      </span>
      {error && <span className="text-xs text-pulse">{error}</span>}
    </span>
  );
}

function BriefCard({ b, run }: { b: ContentBrief; run: RunRef }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label className="mb-1 flex items-center gap-1.5">
            <FileText size={13} /> Page brief
          </Label>
          <h4 className="font-display text-lg font-semibold leading-snug">{b.h1}</h4>
          <p className="break-all font-mono text-xs text-ink-2">{b.slug}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
          <CopyButton text={briefText(b)} label="Copy brief" />
          <WriteArticleButton b={b} run={run} />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-md border border-line bg-paper/60 px-4 py-3 text-[15px]">
        <span className="w-12 shrink-0 pt-0.5 text-[13px] font-semibold text-ink-2">Title</span>
        <span className="min-w-0 flex-1 break-words">{b.title}</span>
        <CopyButton text={b.title} />
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[3fr_2fr]">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label>Outline</Label>
            <CopyButton text={b.outline.join("\n")} label="Copy outline" />
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed marker:font-mono marker:text-ink-3">
            {b.outline.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          {b.must_include.length > 0 && (
            <div>
              <Label className="mb-1.5">Must include</Label>
              <ul className="space-y-1.5 text-[15px] leading-relaxed text-ink-2">
                {b.must_include.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-scrub" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {b.internal_links.length > 0 && (
            <div>
              <Label className="mb-1.5">Internal links</Label>
              <ul className="space-y-1.5 text-[15px] leading-relaxed text-ink-2">
                {b.internal_links.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
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
    <ReportSection title="Your data">
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
            <thead className="text-xs font-semibold uppercase tracking-wide text-ink-2">
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
    </ReportSection>
  );
}

// ---------- Report ----------

export function KeywordsReport({ result, run }: { result: KeywordsResult; run?: RunRef }) {
  if (result.article) return <ArticleReport result={{ ...result, article: result.article }} />;
  return <KeywordMapReport result={result} run={run} />;
}

function KeywordMapReport({ result, run }: { result: KeywordsResult; run?: RunRef }) {
  const clusters = result.clusters ?? [];
  const questions = result.aeo_questions ?? [];
  const briefs = result.content_briefs ?? [];
  const wins = result.quick_wins ?? [];
  const sources = result.sources ?? [];
  const runRef: RunRef = run?.id ? { id: run.id, input: run.input ?? {} } : undefined;

  return (
    <div className="space-y-12">
      <Card className="p-5">
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
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
          Demand and difficulty are estimates for comparing clusters, not search volumes.
          {result.data_from ? ` Numbers in the data table come from your connected ${result.data_from}.` : result.data ? " Numbers in the data table come from the export you pasted." : " For real monthly searches, check Google Keyword Planner."}
          {runRef && " Click Expand on any keyword to drill deeper; the new report links back here."}
        </p>
        {result.score_note && <p className="mt-3 max-w-3xl border-t border-line pt-3 text-[15px] leading-relaxed text-ink-2">{result.score_note}</p>}
      </Card>

      {clusters.length > 0 && (
        <ReportSection
          title={result.expand ? "Variants by modifier" : "Keyword clusters"}
          hint={result.expand ? undefined : "Groups of searches that one page can answer, with the page to build or improve for each."}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {clusters.map((c, i) => (
              <ClusterCard key={`${c.name}-${i}`} c={c} run={runRef} />
            ))}
          </div>
        </ReportSection>
      )}

      {questions.length > 0 && (
        <ReportSection
          title="Questions people ask AI assistants"
          hint="Answer these on your site so assistants like ChatGPT have something of yours to quote."
          actions={<CopyButton text={questions.map((q) => q.question).join("\n")} label="Copy all questions" />}
        >
          <Card className="divide-y divide-line">
            <div className="hidden grid-cols-[2fr_2fr_1.2fr_1fr_auto] gap-3 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-2 md:grid">
              <span>Question</span>
              <span>Answer angle</span>
              <span>Where to answer</span>
              <span>Format</span>
              <span className="w-[4.5rem]" />
            </div>
            {questions.map((q, i) => (
              <div key={i} className="grid gap-1.5 px-5 py-3.5 text-sm leading-relaxed md:grid-cols-[2fr_2fr_1.2fr_1fr_auto] md:gap-3">
                <div className="flex items-start justify-between gap-2 md:block">
                  <p className="font-semibold">{q.question}</p>
                  <span className="md:hidden">
                    <CopyButton text={q.question} />
                  </span>
                </div>
                <p className="text-ink-2">{q.answer_angle}</p>
                <p className="text-ink-2">
                  <span className="text-xs font-semibold text-ink-3 md:hidden">Where: </span>
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
        </ReportSection>
      )}

      {briefs.length > 0 && (
        <ReportSection
          title="Briefs for new pages"
          hint={runRef ? "What to put on each new page. Copy a brief for whoever writes the page, or pick a page type and click Write to get the full blog article or website page." : "What to put on each new page. Copy a brief and hand it to whoever writes the page."}
        >
          <div className="space-y-4">
            {briefs.map((b, i) => (
              <BriefCard key={`${b.slug}-${i}`} b={b} run={runRef} />
            ))}
          </div>
        </ReportSection>
      )}

      {wins.length > 0 && (
        <ReportSection title="Quick wins">
          <Card className="divide-y divide-line">
            {wins.map((w, i) => (
              <div key={i} className="flex gap-3 px-5 py-3.5 text-[15px] leading-relaxed">
                <Zap size={15} className="mt-1 shrink-0 text-amber" />
                <p className="max-w-3xl">{w}</p>
              </div>
            ))}
          </Card>
        </ReportSection>
      )}

      {result.data && result.data.rows.length > 0 && <DataTable data={result.data} />}

      {sources.length > 0 && (
        <ReportSection title="Pages we looked at">
          <Card className="divide-y divide-line">
            {sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-5 py-2.5 text-sm hover:bg-paper"
              >
                <ExternalLink size={13} className="mt-1 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block truncate">{s.title || s.url}</span>
                  <span className="block truncate font-mono text-xs text-ink-3">{(() => {
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
        </ReportSection>
      )}
    </div>
  );
}
