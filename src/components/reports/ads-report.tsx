import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, ChevronRight } from "lucide-react";
import {
  PLATFORM_LABEL as PLAT,
  PLATFORMS,
  type Entity,
  type Flag,
  type FlagType,
  type PauseCandidate,
  type Platform,
  type PlatformSummary,
  type ScaleCandidate,
  type SourceInfo,
  type WastedTerm,
} from "@/lib/agents/ads-data";
import type { AdsAIResult, AdsCreative } from "@/lib/agents/ads";
import { Badge, Card, Label, ReportSection, cx, scoreTone } from "../ui";
import { CopyButton } from "../copy-button";

type AdsResult = {
  sample?: boolean;
  sources_used?: SourceInfo[];
  period?: string;
  warnings?: string[];
  platforms?: Partial<Record<Platform, PlatformSummary>>;
  flags?: Flag[];
  wasted_search_terms?: WastedTerm[];
  wasted_spend_total?: number;
  negative_candidates?: string[];
  scale_candidates?: ScaleCandidate[];
  pause_candidates?: PauseCandidate[];
  tracking?: string[];
  creative?: AdsCreative;
  ai?: AdsAIResult | null;
};

type Tone = "neutral" | "green" | "red" | "amber" | "ink";
const FLAG: Record<FlagType, { label: string; tone: Tone }> = {
  zero_conv: { label: "No conv.", tone: "red" },
  high_cpa: { label: "High CPA", tone: "amber" },
  low_ctr: { label: "Low CTR", tone: "amber" },
  high_frequency: { label: "Freq > 3", tone: "amber" },
  concentration: { label: "Most spend", tone: "neutral" },
  tracking: { label: "Tracking", tone: "red" },
  objective: { label: "Objective", tone: "red" },
  conv_gt_clicks: { label: "Double count", tone: "red" },
};

function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || !Number.isFinite(n)) return "--";
  return n.toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d });
}
const money = (n: number | null | undefined, d = 2) => (n == null ? "--" : fmt(n, n >= 10000 ? 0 : d));
const pct = (n: number | null | undefined, d = 1) => (n == null ? "--" : `${(n * 100).toFixed(d)}%`);
const conv = (n: number) => fmt(n, n % 1 ? 1 : 0);

function levelName(p: Platform, plural = false) {
  const s = p === "meta" ? "ad set" : "ad group";
  return plural ? `${s}s` : s;
}

// ---------- Pieces ----------

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <Label className="truncate">{label}</Label>
      <div className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

function FlagBadges({ flags }: { flags: FlagType[] }) {
  if (!flags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} tone={FLAG[f]?.tone ?? "neutral"}>
          {FLAG[f]?.label ?? f}
        </Badge>
      ))}
    </span>
  );
}

/** Spend per 1,000 impressions. */
const cpm = (spend: number, impressions: number) => (impressions > 0 ? (spend / impressions) * 1000 : null);

function EntityTable({ rows, p, showParent, parentLabel }: { rows: Entity[]; p: PlatformSummary; showParent?: boolean; parentLabel?: string }) {
  const meta = p.platform === "meta";
  // Last column: frequency on Meta, search impression share on Google, CPM on ChatGPT Ads (it reports neither of the others).
  const chatgpt = p.platform === "chatgpt";
  const roas = rows.some((r) => r.roas != null);
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="text-xs font-semibold uppercase tracking-wide text-ink-2">
          <tr className="border-b border-line">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Spend</th>
            <th className="px-3 py-2 text-right">Share</th>
            <th className="px-3 py-2 text-right">Clicks</th>
            <th className="px-3 py-2 text-right">CTR</th>
            <th className="px-3 py-2 text-right">Conv.</th>
            <th className="px-3 py-2 text-right">CPA</th>
            {roas && <th className="px-3 py-2 text-right">ROAS</th>}
            <th className="px-3 py-2 text-right">{meta ? "Freq." : chatgpt ? "CPM" : "Impr. share"}</th>
            <th className="px-3 py-2">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={`${e.parent}|${e.name}|${i}`} className={cx("border-b border-line last:border-0", e.flags.some((f) => FLAG[f]?.tone === "red") && "bg-pulse/[0.03]")}>
              <td className="max-w-[18rem] px-3 py-2">
                <div className="break-words font-semibold">{e.name}</div>
                {showParent && e.parent && (
                  <div className="break-words text-xs text-ink-3">
                    {parentLabel ? `${parentLabel}: ` : ""}
                    {e.parent}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{money(e.spend)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-3">{pct(e.spend_share, 0)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(e.clicks)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{pct(e.ctr, 2)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{e.conv_known ? conv(e.conversions) : "n/a"}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{money(e.cpa)}</td>
              {roas && <td className="px-3 py-2 text-right font-mono tabular-nums">{e.roas != null ? e.roas.toFixed(2) : "--"}</td>}
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {meta ? (e.frequency != null ? e.frequency.toFixed(2) : "--") : chatgpt ? money(cpm(e.spend, e.impressions)) : pct(e.impr_share, 0)}
              </td>
              <td className="px-3 py-2">
                <FlagBadges flags={e.flags} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PlatformSection({ p, diagnosis }: { p: PlatformSummary; diagnosis?: { verdict: string; points: string[] } }) {
  const meta = p.platform === "meta";
  const cur = p.currency || "SGD";
  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: `Spend (${cur})`, value: money(p.spend, 0) },
    { label: "Impressions", value: fmt(p.impressions) },
    { label: meta ? "Link clicks" : "Clicks", value: fmt(p.clicks) },
    { label: "CTR", value: pct(p.ctr, 2) },
    { label: `CPC (${cur})`, value: money(p.cpc) },
    { label: meta ? "Results" : "Conversions", value: p.conv_known ? conv(p.conversions) : "n/a" },
    { label: `CPA (${cur})`, value: money(p.cpa) },
    { label: "Conv. rate", value: pct(p.conv_rate, 2) },
  ];
  if (p.roas != null) kpis.push({ label: "ROAS", value: `${p.roas.toFixed(2)}x` });
  if (meta && p.frequency != null) kpis.push({ label: "Frequency", value: p.frequency.toFixed(2), sub: "approx." });
  if (p.platform === "chatgpt") kpis.push({ label: `CPM (${cur})`, value: money(cpm(p.spend, p.impressions)) });
  const hasAdsets = p.adsets.length > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[28px]">{PLAT[p.platform]}</h2>
        <Badge tone={scoreTone(p.score)}>Health {p.score}/100</Badge>
        <span className="text-sm text-ink-2">
          {p.campaign_count} campaign{p.campaign_count === 1 ? "" : "s"}
          {hasAdsets ? ` · ${p.adset_count} ${levelName(p.platform, p.adset_count !== 1)}` : ""}
        </span>
        {p.platform === "chatgpt" && (
          <p className="basis-full max-w-3xl text-sm leading-relaxed text-ink-2">ChatGPT Ads is in beta, so there are no fair benchmarks yet. These numbers are compared with your own account only.</p>
        )}
      </div>

      <Card className="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-5 [&>*]:border-b [&>*]:border-line">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </Card>

      {diagnosis && (
        <Card className="p-5">
          <p className="max-w-3xl font-semibold leading-snug">{diagnosis.verdict}</p>
          {diagnosis.points.length > 0 && (
            <ul className="mt-3 max-w-3xl list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
              {diagnosis.points.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {p.campaigns.length > 0 && (
        <ReportSection title="Campaigns by spend" className="pt-4">
          <EntityTable rows={p.campaigns.slice(0, 25)} p={p} />
        </ReportSection>
      )}

      {hasAdsets && (
        <details className="group" open={p.campaigns.length <= 1}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-[15px] font-semibold text-ink hover:text-scrub [&::-webkit-details-marker]:hidden">
            <ChevronRight size={16} className="shrink-0 transition group-open:rotate-90" />
            <span className="first-letter:uppercase">{levelName(p.platform, true)} by spend</span>
            <span className="font-mono text-sm font-normal tabular-nums text-ink-3">({p.adset_count})</span>
          </summary>
          <div className="mt-2">
            <EntityTable rows={p.adsets.slice(0, 40)} p={p} showParent parentLabel="Campaign" />
          </div>
        </details>
      )}

      {p.keywords.length > 0 && (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-[15px] font-semibold text-ink hover:text-scrub [&::-webkit-details-marker]:hidden">
            <ChevronRight size={16} className="shrink-0 transition group-open:rotate-90" />
            Keywords by spend
            <span className="font-mono text-sm font-normal tabular-nums text-ink-3">({p.keywords.length})</span>
          </summary>
          <div className="mt-2">
            <EntityTable rows={p.keywords.slice(0, 40)} p={p} showParent parentLabel="Ad group" />
          </div>
        </details>
      )}
    </section>
  );
}

function ActionCard({
  icon,
  title,
  empty,
  children,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <ReportSection
      navLabel={title}
      title={
        <>
          {icon}
          {title}
        </>
      }
    >
      <Card className="divide-y divide-line">{children.length ? children : <p className="px-5 py-4 text-[15px] leading-relaxed text-ink-2">{empty}</p>}</Card>
    </ReportSection>
  );
}

function CharCopy({ text, max }: { text: string; max: number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1 break-words text-[15px]">{text}</span>
      <span className={cx("shrink-0 font-mono text-xs tabular-nums", text.length > max ? "text-pulse" : "text-ink-3")}>
        {text.length}/{max}
      </span>
      <CopyButton text={text} />
    </div>
  );
}

// ---------- Report ----------

export function AdsReport({ result }: { result: AdsResult }) {
  const platforms = PLATFORMS.map((k) => result.platforms?.[k]).filter(Boolean) as PlatformSummary[];
  const ai = result.ai ?? null;
  const curOf = (p: Platform) => result.platforms?.[p]?.currency || "SGD";
  const tracking = [...new Set([...(result.tracking ?? []), ...(ai?.tracking_issues ?? [])])];
  const pause = result.pause_candidates ?? [];
  const scale = result.scale_candidates ?? [];
  const aiPauseReason = (name: string) => ai?.what_to_pause.find((x) => x.name.toLowerCase() === name.toLowerCase())?.reason;
  const aiScale = (name: string) => ai?.what_to_scale.find((x) => x.name.toLowerCase() === name.toLowerCase());
  const extraPause = (ai?.what_to_pause ?? []).filter((x) => !pause.some((p) => p.name.toLowerCase() === x.name.toLowerCase()));
  const extraScale = (ai?.what_to_scale ?? []).filter((x) => !scale.some((p) => p.name.toLowerCase() === x.name.toLowerCase()));
  const wasted = result.wasted_search_terms ?? [];
  const negatives = result.negative_candidates ?? [];
  const aiNegatives = (ai?.negative_keywords ?? []).filter((k) => !negatives.some((n) => n.toLowerCase() === k.toLowerCase()));
  const creative = result.creative;
  const sources = result.sources_used ?? [];
  const gCur = curOf("google");

  return (
    <div className="space-y-12">
      {/* Data sources */}
      <Card className="flex flex-wrap items-center gap-2 p-5 text-sm">
        {result.sample && <Badge tone="amber">Sample data</Badge>}
        {result.period && <span className="font-mono text-xs text-ink-2">{result.period}</span>}
        {sources.map((s, i) => (
          <Badge key={i} tone={s.ok && s.rows > 0 ? "neutral" : "red"} title={s.error} className="max-w-full break-all">
            {s.label}
            {s.ok && s.rows > 0 ? ` · ${s.rows} rows` : " · failed"}
          </Badge>
        ))}
        {result.sample && (
          <p className="basis-full text-sm leading-relaxed text-ink-2">
            <span className="block max-w-3xl">These numbers come from a built-in sample account, not yours. Connect your ad accounts or upload your own exports to get your real checkup.</span>
          </p>
        )}
      </Card>

      {/* Tracking warnings */}
      {tracking.length > 0 && (
        <ReportSection
          title={
            <>
              <AlertTriangle size={18} className="shrink-0 text-pulse" />
              Tracking warnings
            </>
          }
          hint="Fix these first. The conversion numbers below depend on tracking working."
        >
          <ul className="space-y-2 rounded-lg border border-pulse/40 bg-pulse/5 p-5 text-[15px] leading-relaxed text-pulse">
            {tracking.map((t, i) => (
              <li key={i} className="max-w-3xl">
                {t}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {platforms.map((p) => (
        <PlatformSection key={p.platform} p={p} diagnosis={ai?.diagnosis.find((d) => d.platform === p.platform)} />
      ))}

      {/* Pause and scale */}
      <div>
        <div className="grid gap-x-6 gap-y-12 lg:grid-cols-2">
          <ActionCard icon={<ArrowDownRight size={18} className="shrink-0 text-pulse" />} title="Pause or cut" empty="Nothing is wasting enough to pause.">
            {[
              ...pause.map((c, i) => (
                <div key={`p${i}`} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{c.name}</p>
                      <p className="text-[13px] text-ink-3">
                        {PLAT[c.platform]} · {c.level === "adset" ? levelName(c.platform) : c.level.replace("_", " ")}
                      </p>
                    </div>
                    <Badge tone={c.action === "pause" ? "red" : "amber"}>{c.action === "pause" ? "Pause" : `Cut ${c.reduce_pct ?? 25}%`}</Badge>
                  </div>
                  <p className="mt-1.5 font-mono text-[13px] tabular-nums text-ink-2">
                    {curOf(c.platform)} {money(c.spend)} spent · {conv(c.conversions)} conv. · CPA {money(c.cpa)}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">{aiPauseReason(c.name) ?? c.reason}</p>
                </div>
              )),
              ...extraPause.map((x, i) => (
                <div key={`xp${i}`} className="px-5 py-4">
                  <p className="break-words font-semibold">{x.name}</p>
                  <p className="text-[13px] text-ink-3">{PLAT[x.platform]} · review</p>
                  <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">{x.reason}</p>
                </div>
              )),
            ]}
          </ActionCard>

          <ActionCard icon={<ArrowUpRight size={18} className="shrink-0 text-scrub" />} title="Scale up" empty="No clear winner yet. Fix the flagged items first, then check again in 2 weeks.">
            {[
              ...scale.map((c, i) => {
                const a = aiScale(c.name);
                return (
                  <div key={`s${i}`} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-semibold">{c.name}</p>
                        <p className="text-[13px] text-ink-3">
                          {PLAT[c.platform]} · {c.level === "adset" ? levelName(c.platform) : c.level}
                        </p>
                      </div>
                      <Badge tone="green">+{a?.budget_shift_pct ?? c.budget_shift_pct}% budget</Badge>
                    </div>
                    <p className="mt-1.5 font-mono text-[13px] tabular-nums text-ink-2">
                      {curOf(c.platform)} {money(c.spend)} spent · {conv(c.conversions)} conv. · CPA {money(c.cpa)}
                      {c.roas != null ? ` · ROAS ${c.roas.toFixed(2)}` : ""}
                    </p>
                    <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">{a?.reason ?? c.reason}</p>
                  </div>
                );
              }),
              ...extraScale.map((x, i) => (
                <div key={`xs${i}`} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words font-semibold">{x.name}</p>
                    <Badge tone="green">+{x.budget_shift_pct}% budget</Badge>
                  </div>
                  <p className="text-[13px] text-ink-3">{PLAT[x.platform]}</p>
                  <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">{x.reason}</p>
                </div>
              )),
            ]}
          </ActionCard>
        </div>
        {(pause.length > 0 || scale.length > 0) && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">Change budgets by 20 to 30% at a time and wait 3 to 5 days between changes so the platforms can settle.</p>
        )}
      </div>

      {/* Wasted search terms */}
      {(wasted.length > 0 || aiNegatives.length > 0) && (
        <ReportSection
          title={
            <>
              <Ban size={18} className="shrink-0 text-pulse" />
              Wasted search terms
            </>
          }
          hint={
            wasted.length > 0 ? (
              <>
                <span className="font-mono font-semibold tabular-nums text-pulse">
                  {gCur} {money(result.wasted_spend_total ?? 0)}
                </span>{" "}
                spent on searches that brought no conversions.
              </>
            ) : undefined
          }
          actions={negatives.length > 0 ? <CopyButton text={negatives.join("\n")} label={`Copy as negative keywords (${negatives.length})`} /> : undefined}
        >
          {wasted.length > 0 && (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-ink-2">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2">Search term</th>
                    <th className="px-3 py-2">Campaign / ad group</th>
                    <th className="px-3 py-2 text-right">Clicks</th>
                    <th className="px-3 py-2 text-right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {wasted.slice(0, 40).map((w, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <span className="break-words font-semibold">{w.term}</span>
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {w.is_brand && <Badge tone="green">Brand, keep</Badge>}
                          {!w.enough_data && <Badge>Low data</Badge>}
                          {w.match_type && <Badge>{w.match_type.replace(/ match$/i, "")}</Badge>}
                        </span>
                      </td>
                      <td className="max-w-[14rem] break-words px-3 py-2 text-xs text-ink-2">
                        {w.campaign}
                        {w.ad_group ? ` / ${w.ad_group}` : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(w.clicks)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{money(w.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {wasted.length > 0 && <p className="mt-2 text-sm text-ink-3">The copy button includes terms with enough spend to judge, and leaves out your brand name.</p>}
          {aiNegatives.length > 0 && (
            <Card className="mt-4 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">More negatives to block whole families of bad searches</p>
                <CopyButton text={aiNegatives.join("\n")} label="Copy" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {aiNegatives.map((k) => (
                  <span key={k} className="rounded border border-line bg-paper px-2 py-0.5 font-mono text-xs">
                    {k}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </ReportSection>
      )}

      {/* Creative */}
      {creative && (creative.google_headlines.length > 0 || creative.google_descriptions.length > 0 || creative.meta.length > 0) && (
        <ReportSection
          title="Ad copy and creative"
          hint={creative.source === "template" ? "Starter templates built from your profile. Edit them before use." : undefined}
        >
          <div className="space-y-6">
            {creative.google_headlines.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold">Google RSA headlines (max 30 characters)</p>
                  <CopyButton text={creative.google_headlines.join("\n")} label="Copy all" />
                </div>
                <Card className="divide-y divide-line">
                  {creative.google_headlines.map((h, i) => (
                    <CharCopy key={i} text={h} max={30} />
                  ))}
                </Card>
              </div>
            )}
            {creative.google_descriptions.length > 0 && (
              <div>
                <p className="mb-2 text-[15px] font-semibold">Google RSA descriptions (max 90 characters)</p>
                <Card className="divide-y divide-line">
                  {creative.google_descriptions.map((d, i) => (
                    <CharCopy key={i} text={d} max={90} />
                  ))}
                </Card>
              </div>
            )}
            {creative.meta.length > 0 && (
              <div>
                <p className="mb-2 text-[15px] font-semibold">Meta creative feedback</p>
                <Card className="p-5">
                  <ul className="max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2">
                    {creative.meta.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        </ReportSection>
      )}

      {/* Audience notes */}
      {ai && ai.audience_notes.length > 0 && (
        <ReportSection title="Audience and targeting">
          <Card className="p-5">
            <ul className="max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2">
              {ai.audience_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Card>
        </ReportSection>
      )}

      {(result.warnings?.length ?? 0) > 0 && (
        <ReportSection title="Notes on your files">
          <ul className="max-w-3xl space-y-1.5 text-sm leading-relaxed text-ink-2">
            {result.warnings!.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </ReportSection>
      )}

      <p className="border-t border-line pt-4 text-sm leading-relaxed text-ink-3">
        <span className="block max-w-3xl">
          Every number above is calculated from your data and compared with your own account averages, not industry benchmarks. Frequency above 3 is a common rule of thumb, not a hard limit.
        </span>
      </p>
    </div>
  );
}
