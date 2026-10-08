import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban } from "lucide-react";
import type { Entity, Flag, FlagType, PauseCandidate, Platform, PlatformSummary, ScaleCandidate, SourceInfo, WastedTerm } from "@/lib/agents/ads-data";
import type { AdsAIResult, AdsCreative } from "@/lib/agents/ads";
import { Badge, Card, Label, cx, scoreTone } from "../ui";
import { CopyButton } from "../copy-button";

type AdsResult = {
  sample?: boolean;
  sources_used?: SourceInfo[];
  period?: string;
  warnings?: string[];
  platforms?: { google?: PlatformSummary; meta?: PlatformSummary };
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

const PLAT: Record<Platform, string> = { google: "Google Ads", meta: "Meta Ads" };

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
  const s = p === "google" ? "ad group" : "ad set";
  return plural ? `${s}s` : s;
}

// ---------- Pieces ----------

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <Label className="truncate">{label}</Label>
      <div className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="font-mono text-[11px] text-ink-3">{sub}</div>}
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

function EntityTable({ rows, p, showParent, parentLabel }: { rows: Entity[]; p: PlatformSummary; showParent?: boolean; parentLabel?: string }) {
  const meta = p.platform === "meta";
  const roas = rows.some((r) => r.roas != null);
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
          <tr className="border-b border-line">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Spend</th>
            <th className="px-3 py-2 text-right">Share</th>
            <th className="px-3 py-2 text-right">Clicks</th>
            <th className="px-3 py-2 text-right">CTR</th>
            <th className="px-3 py-2 text-right">Conv.</th>
            <th className="px-3 py-2 text-right">CPA</th>
            {roas && <th className="px-3 py-2 text-right">ROAS</th>}
            <th className="px-3 py-2 text-right">{meta ? "Freq." : "Impr. share"}</th>
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
              <td className="px-3 py-2 text-right font-mono tabular-nums">{meta ? (e.frequency != null ? e.frequency.toFixed(2) : "--") : pct(e.impr_share, 0)}</td>
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
  const hasAdsets = p.adsets.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-semibold">{PLAT[p.platform]}</h2>
        <Badge tone={scoreTone(p.score)}>Health {p.score}/100</Badge>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {p.campaign_count} campaign{p.campaign_count === 1 ? "" : "s"}
          {hasAdsets ? ` · ${p.adset_count} ${levelName(p.platform, p.adset_count !== 1)}` : ""}
        </span>
      </div>

      <Card className="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-5 [&>*]:border-b [&>*]:border-line">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </Card>

      {diagnosis && (
        <Card className="p-4">
          <p className="font-semibold">{diagnosis.verdict}</p>
          {diagnosis.points.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {diagnosis.points.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {p.campaigns.length > 0 && (
        <div>
          <Label className="mb-2">Campaigns by spend</Label>
          <EntityTable rows={p.campaigns.slice(0, 25)} p={p} />
        </div>
      )}

      {hasAdsets && (
        <details className="group" open={p.campaigns.length <= 1}>
          <summary className="cursor-pointer list-none">
            <Label className="inline-flex items-center gap-1 hover:text-ink">
              <span className="transition group-open:rotate-90">›</span> {levelName(p.platform, true)} by spend ({p.adset_count})
            </Label>
          </summary>
          <div className="mt-2">
            <EntityTable rows={p.adsets.slice(0, 40)} p={p} showParent parentLabel="Campaign" />
          </div>
        </details>
      )}

      {p.keywords.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <Label className="inline-flex items-center gap-1 hover:text-ink">
              <span className="transition group-open:rotate-90">›</span> Keywords by spend ({p.keywords.length})
            </Label>
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
    <section>
      <Label className="mb-2 flex items-center gap-1.5">
        {icon} {title}
      </Label>
      <Card className="divide-y divide-line">{children.length ? children : <p className="px-4 py-3 text-sm text-ink-3">{empty}</p>}</Card>
    </section>
  );
}

function CharCopy({ text, max }: { text: string; max: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1 break-words text-sm">{text}</span>
      <span className={cx("shrink-0 font-mono text-[11px] tabular-nums", text.length > max ? "text-pulse" : "text-ink-3")}>
        {text.length}/{max}
      </span>
      <CopyButton text={text} />
    </div>
  );
}

// ---------- Report ----------

export function AdsReport({ result }: { result: AdsResult }) {
  const platforms = (["google", "meta"] as const).map((k) => result.platforms?.[k]).filter(Boolean) as PlatformSummary[];
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
    <div className="space-y-8">
      {/* Data sources */}
      <Card className="flex flex-wrap items-center gap-2 p-4 text-sm">
        {result.sample && <Badge tone="amber">Sample data</Badge>}
        {result.period && <span className="font-mono text-xs text-ink-2">{result.period}</span>}
        {sources.map((s, i) => (
          <Badge key={i} tone={s.ok && s.rows > 0 ? "neutral" : "red"} title={s.error} className="max-w-full break-all">
            {s.label}
            {s.ok && s.rows > 0 ? ` · ${s.rows} rows` : " · failed"}
          </Badge>
        ))}
        {result.sample && <p className="w-full text-xs text-ink-3">These numbers come from a built-in sample account, not yours. Upload your own exports to get your real checkup.</p>}
      </Card>

      {/* Tracking warnings */}
      {tracking.length > 0 && (
        <section className="rounded-lg border border-pulse/40 bg-pulse/5 p-4">
          <Label className="mb-2 flex items-center gap-1.5 text-pulse">
            <AlertTriangle size={14} /> Tracking warnings
          </Label>
          <ul className="space-y-1.5 text-sm text-pulse">
            {tracking.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {platforms.map((p) => (
        <PlatformSection key={p.platform} p={p} diagnosis={ai?.diagnosis.find((d) => d.platform === p.platform)} />
      ))}

      {/* Pause and scale */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActionCard icon={<ArrowDownRight size={14} className="text-pulse" />} title="Pause or cut" empty="Nothing is wasting enough to pause.">
          {[
            ...pause.map((c, i) => (
              <div key={`p${i}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{c.name}</p>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                      {PLAT[c.platform]} · {c.level === "adset" ? levelName(c.platform) : c.level.replace("_", " ")}
                    </p>
                  </div>
                  <Badge tone={c.action === "pause" ? "red" : "amber"}>{c.action === "pause" ? "Pause" : `Cut ${c.reduce_pct ?? 25}%`}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs tabular-nums text-ink-2">
                  {curOf(c.platform)} {money(c.spend)} spent · {conv(c.conversions)} conv. · CPA {money(c.cpa)}
                </p>
                <p className="mt-1 text-sm text-ink-2">{aiPauseReason(c.name) ?? c.reason}</p>
              </div>
            )),
            ...extraPause.map((x, i) => (
              <div key={`xp${i}`} className="px-4 py-3">
                <p className="break-words font-semibold">{x.name}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{PLAT[x.platform]} · review</p>
                <p className="mt-1 text-sm text-ink-2">{x.reason}</p>
              </div>
            )),
          ]}
        </ActionCard>

        <ActionCard icon={<ArrowUpRight size={14} className="text-scrub" />} title="Scale up" empty="No clear winner yet. Fix the flagged items first, then check again in 2 weeks.">
          {[
            ...scale.map((c, i) => {
              const a = aiScale(c.name);
              return (
                <div key={`s${i}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{c.name}</p>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                        {PLAT[c.platform]} · {c.level === "adset" ? levelName(c.platform) : c.level}
                      </p>
                    </div>
                    <Badge tone="green">+{a?.budget_shift_pct ?? c.budget_shift_pct}% budget</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs tabular-nums text-ink-2">
                    {curOf(c.platform)} {money(c.spend)} spent · {conv(c.conversions)} conv. · CPA {money(c.cpa)}
                    {c.roas != null ? ` · ROAS ${c.roas.toFixed(2)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink-2">{a?.reason ?? c.reason}</p>
                </div>
              );
            }),
            ...extraScale.map((x, i) => (
              <div key={`xs${i}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="break-words font-semibold">{x.name}</p>
                  <Badge tone="green">+{x.budget_shift_pct}% budget</Badge>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{PLAT[x.platform]}</p>
                <p className="mt-1 text-sm text-ink-2">{x.reason}</p>
              </div>
            )),
          ]}
        </ActionCard>
      </div>
      {(pause.length > 0 || scale.length > 0) && (
        <p className="-mt-5 text-xs text-ink-3">Change budgets by 20 to 30% at a time and wait 3 to 5 days between changes so the platforms can settle.</p>
      )}

      {/* Wasted search terms */}
      {(wasted.length > 0 || aiNegatives.length > 0) && (
        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <Label className="flex items-center gap-1.5">
                <Ban size={14} className="text-pulse" /> Wasted search terms
              </Label>
              {wasted.length > 0 && (
                <p className="mt-1 text-sm text-ink-2">
                  <span className="font-mono tabular-nums text-pulse">
                    {gCur} {money(result.wasted_spend_total ?? 0)}
                  </span>{" "}
                  spent on searches that brought no conversions.
                </p>
              )}
            </div>
            {negatives.length > 0 && <CopyButton text={negatives.join("\n")} label={`Copy as negative keywords (${negatives.length})`} />}
          </div>
          {wasted.length > 0 && (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
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
          {wasted.length > 0 && <p className="mt-2 text-xs text-ink-3">The copy button includes terms with enough spend to judge, and leaves out your brand name.</p>}
          {aiNegatives.length > 0 && (
            <Card className="mt-3 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">More negatives to block whole families of bad searches</p>
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
        </section>
      )}

      {/* Creative */}
      {creative && (creative.google_headlines.length > 0 || creative.google_descriptions.length > 0 || creative.meta.length > 0) && (
        <section className="space-y-4">
          <div>
            <Label>Ad copy and creative</Label>
            {creative.source === "template" && <p className="mt-1 text-xs text-ink-3">Starter templates built from your profile. Edit them before use.</p>}
          </div>
          {creative.google_headlines.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Google RSA headlines (max 30 characters)</p>
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
              <p className="mb-2 text-sm font-semibold">Google RSA descriptions (max 90 characters)</p>
              <Card className="divide-y divide-line">
                {creative.google_descriptions.map((d, i) => (
                  <CharCopy key={i} text={d} max={90} />
                ))}
              </Card>
            </div>
          )}
          {creative.meta.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Meta creative feedback</p>
              <Card className="p-4">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
                  {creative.meta.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </section>
      )}

      {/* Audience notes */}
      {ai && ai.audience_notes.length > 0 && (
        <section>
          <Label className="mb-2">Audience and targeting</Label>
          <Card className="p-4">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
              {ai.audience_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {(result.warnings?.length ?? 0) > 0 && (
        <section>
          <Label className="mb-2">Notes on your files</Label>
          <ul className="space-y-1 text-xs text-ink-3">
            {result.warnings!.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-ink-3">
        Every number above is calculated from your data and compared with your own account averages, not industry benchmarks. Frequency above 3 is a common rule of thumb, not a hard limit.
      </p>
    </div>
  );
}
