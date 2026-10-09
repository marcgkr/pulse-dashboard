import { z } from "zod";
import { aiEnabled, businessContext, normalizePrescription, PrescriptionSchema, structured, type Prescription } from "../ai";
import type { WorkspaceRow } from "../db";
import type { AgentContext, AgentDef } from "./types";
import {
  analyzeAds,
  levelLabel,
  parseReport,
  sampleReports,
  type AdRow,
  type AdsAnalysis,
  type Entity,
  type Platform,
  type PlatformSummary,
  type ReportInput,
  type SourceInfo,
} from "./ads-data";
import { marketFor, type Market } from "../markets";
import { connectedSources, fetchLiveAds } from "../connectors";

type Source = "upload" | "live" | "sample";
type Input = { source: Source; reports: ReportInput[]; days: number; notes: string };

const MAX_REPORTS = 6;
const MAX_CSV_CHARS = 2_500_000;
const DAY_OPTIONS = [7, 14, 30, 90];

// ---------- AI output schema (plain types only; normalised in code) ----------

const AdsAI = z.object({
  summary: z.string().describe("2-4 sentence verdict for the owner. Lead with the single biggest money leak or risk. Use only numbers from the tables."),
  diagnosis: z
    .array(
      z.object({
        platform: z.string().describe("Exactly one of: google, meta"),
        verdict: z.string().describe("1-2 sentences on how this platform is doing for this business"),
        points: z.array(z.string()).describe("2-5 short observations backed by the tables"),
      }),
    )
    .describe("One entry per platform that has data"),
  what_to_pause: z
    .array(
      z.object({
        platform: z.string().describe("Exactly one of: google, meta"),
        name: z.string().describe("Exact campaign / ad set / ad group / keyword name copied from the tables"),
        reason: z.string().describe("One sentence why, citing the table numbers"),
      }),
    )
    .describe("Items to pause or cut, most wasteful first. Only items that appear in the tables."),
  what_to_scale: z
    .array(
      z.object({
        platform: z.string().describe("Exactly one of: google, meta"),
        name: z.string().describe("Exact name copied from the tables"),
        reason: z.string().describe("One sentence why"),
        budget_shift_pct: z.number().describe("Suggested budget increase as a whole percent, usually 20 or 30. Never a currency amount."),
      }),
    )
    .describe("Items that deserve more budget, best first. Only items that appear in the tables."),
  negative_keywords: z
    .array(z.string())
    .describe("Google negative keywords to add, lower case. Include the wasted search terms that clearly show the wrong intent plus short root words (e.g. 'jobs', 'course', 'free') that block whole families of bad searches. Never include the business's own brand name. Empty if no Google search data."),
  creative_feedback: z.object({
    meta: z.array(z.string()).describe("3-6 Meta creative notes: fatigue fixes and new angles to test, specific to this business. Empty if no Meta data."),
    google_headlines: z.array(z.string()).describe("8-12 Responsive Search Ad headlines, each 30 characters or fewer including spaces. Empty if no Google data."),
    google_descriptions: z.array(z.string()).describe("3-4 Responsive Search Ad descriptions, each 90 characters or fewer including spaces. Empty if no Google data."),
  }),
  audience_notes: z.array(z.string()).describe("2-5 audience and targeting notes (locations, exclusions, lookalikes, retargeting windows, search match types)"),
  tracking_issues: z.array(z.string()).describe("Tracking or measurement problems visible in the data. Empty if none."),
  prescriptions: z.array(PrescriptionSchema).describe("5-9 fixes ordered by priority. Steps must use exact Google Ads or Meta Ads Manager click paths."),
});
type AdsAIOut = z.infer<typeof AdsAI>;

export type AdsAIResult = {
  diagnosis: { platform: Platform; verdict: string; points: string[] }[];
  what_to_pause: { platform: Platform; name: string; reason: string }[];
  what_to_scale: { platform: Platform; name: string; reason: string; budget_shift_pct: number }[];
  negative_keywords: string[];
  audience_notes: string[];
  tracking_issues: string[];
};

export type AdsCreative = { source: "ai" | "template"; google_headlines: string[]; google_descriptions: string[]; meta: string[] };

// ---------- Helpers ----------

function cleanReports(raw: unknown): ReportInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const platform = x.platform === "google" || x.platform === "meta" ? x.platform : "auto";
      return { platform, filename: String(x.filename ?? "pasted report").slice(0, 120), csv: String(x.csv ?? "") } as ReportInput;
    })
    .filter((r) => r.csv.trim().length > 0);
}

function serviceWord(ws: WorkspaceRow): string {
  const first = (ws.offers || "").split(/[,\n;/|]+/)[0]?.trim();
  const s = first && first.length <= 28 ? first : (ws.industry || "").split(/[,\n;/|]+/)[0]?.trim();
  return (s && s.length <= 28 ? s : "service").toLowerCase();
}

function locationWord(ws: WorkspaceRow): string {
  const l = (ws.location || "").split(/[,\n;/|]+/)[0]?.trim();
  const m = marketFor(ws.country);
  return l && l.length <= 20 ? l : m.code === "INTL" ? "your area" : m.name;
}

/** Ad wording for how customers in this market usually contact a business. */
function adsChat(m: Market) {
  if (m.messaging === "SMS")
    return {
      button: "tap your call button",
      via: "phone or text",
      convo: "calls from ads and clicks on your call button",
      objTitle: "Leads campaigns",
      objStep: "choose the Leads objective",
      location: "Instant forms, Calls or Website with your lead event",
      click: "call button click",
      heard: "on the phone",
      headline: "Call or Text Us Today",
      desc: "Call or text us to check a slot.",
      cta: "'Call or text us to check a slot this week'",
    };
  const app = m.messaging;
  return {
    button: `tap your ${app} button`,
    via: `${app} or phone`,
    convo: `${app} button clicks and calls from ads`,
    objTitle: `Leads or ${app} campaigns`,
    objStep: `choose the Leads objective (or Engagement > Messaging for ${app})`,
    location: `Instant forms, Messaging apps (${app}) or Website with your lead event`,
    click: `${app} click`,
    heard: `on ${app}`,
    headline: `Message Us on ${app}`,
    desc: `Message us on ${app} to check a slot.`,
    cta: app === "WhatsApp" ? "'WhatsApp us to check a slot this week'" : `'Message us on ${app} to check a slot this week'`,
  };
}

const COMMON_NAME_WORDS = new Set(["clinic", "clinics", "aesthetic", "aesthetics", "salon", "studio", "group", "medical", "dental", "beauty", "the", "and", "pte", "ltd", "law", "legal", "llc", "centre", "center", "spa", "skin", "hair", "singapore", "sg", "co"]);
function brandTerms(ws: WorkspaceRow): string[] {
  const name = (ws.name || "").toLowerCase().replace(/\b(pte|ltd|llp|llc)\b\.?/g, "").trim();
  const out = name ? [name] : [];
  const first = name.split(/\s+/)[0];
  // The first word alone counts as brand only if it isn't also the service ("Lash Lab" must not swallow "lash extensions").
  const serviceText = `${ws.offers} ${ws.industry}`.toLowerCase();
  if (first && first.length >= 4 && !COMMON_NAME_WORDS.has(first) && !serviceText.includes(first)) out.push(first);
  return out;
}

const PLAT: Record<Platform, string> = { google: "Google Ads", meta: "Meta Ads" };

function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(n: number | null | undefined, d = 1): string {
  return n == null ? "-" : `${(n * 100).toFixed(d)}%`;
}
function money(n: number | null | undefined, cur: string): string {
  return n == null ? "-" : `${cur} ${fmt(n, n >= 1000 ? 0 : 2)}`;
}

type Gathered = { rows: AdRow[]; sources: SourceInfo[]; period: string; currency: Partial<Record<Platform, string | null>>; warnings: string[]; sample: boolean };

async function gather(input: Input, ctx: AgentContext, opts: { fallbackToSample: boolean }): Promise<Gathered> {
  const warnings: string[] = [];
  const currency: Partial<Record<Platform, string | null>> = {};
  const periods = new Set<string>();

  const fromReports = (reports: ReportInput[], source: SourceInfo["source"]) => {
    const rows: AdRow[] = [];
    const sources: SourceInfo[] = [];
    for (const r of reports) {
      const p = parseReport(r);
      warnings.push(...p.warnings);
      if (p.platform && p.currency && !currency[p.platform]) currency[p.platform] = p.currency;
      if (p.period) periods.add(p.period);
      sources.push({ source, label: r.filename, platform: p.platform, level: p.level, rows: p.rows.length, ok: p.rows.length > 0, error: p.rows.length ? undefined : p.warnings[0] });
      rows.push(...p.rows);
    }
    return { rows, sources };
  };

  const sample = () => {
    const s = fromReports(sampleReports({ service: serviceWord(ctx.ws), location: locationWord(ctx.ws), brand: ctx.ws.name, currency: marketFor(ctx.ws.country).currency }), "sample");
    return { ...s, period: [...periods].join(" / ") || "Sample month", currency, warnings, sample: true };
  };

  if (input.source === "sample") {
    ctx.progress("Loading the sample ad account");
    return sample();
  }

  if (input.source === "live") {
    ctx.progress(`Pulling the last ${input.days} days from your connected ad accounts`);
    const w = await fetchLiveAds(ctx.ws, input.days, ctx.progress);
    warnings.push(...w.warnings);
    Object.assign(currency, w.currency);
    if (w.rows.length === 0) {
      const failed = w.sources.filter((s) => !s.ok || s.rows === 0);
      if (opts.fallbackToSample) {
        warnings.unshift("Your connected ad accounts returned no data for this period, so this report uses sample data.");
        const s = sample();
        return { ...s, sources: [...w.sources, ...s.sources] };
      }
      throw new Error(
        `Couldn't read ad data from your connected accounts. ${failed.map((f) => `${f.label}: ${f.error ?? "no rows"}`).join(" ")} Check Settings > Connected accounts, or upload your exports instead.`.slice(0, 600),
      );
    }
    return { rows: w.rows, sources: w.sources, period: `Last ${input.days} days`, currency, warnings, sample: false };
  }

  ctx.progress(`Reading ${input.reports.length} export${input.reports.length === 1 ? "" : "s"}`);
  const r = fromReports(input.reports, "upload");
  if (r.rows.length === 0) {
    if (opts.fallbackToSample && input.reports.length === 0) return sample();
    throw new Error(warnings[0] ?? "No ad data found in the files.");
  }
  return { ...r, period: [...periods].join(" / ") || "Period as exported", currency, warnings, sample: false };
}

// ---------- Prompt tables (computed metrics, capped; never the raw CSV) ----------

function entityLine(e: Entity, cur: string, meta: boolean): string {
  return [
    e.name,
    e.parent || "",
    money(e.spend, cur),
    pct(e.spend_share, 0),
    fmt(e.impressions),
    fmt(e.clicks),
    pct(e.ctr, 2),
    money(e.cpc, cur),
    e.conv_known ? fmt(e.conversions, e.conversions % 1 ? 1 : 0) : "n/a",
    money(e.cpa, cur),
    e.roas != null ? e.roas.toFixed(2) : "-",
    meta ? (e.frequency != null ? e.frequency.toFixed(2) : "-") : e.impr_share != null ? pct(e.impr_share, 0) : "-",
    e.flags.join(" ") || "-",
  ].join(" | ");
}

function platformBlock(p: PlatformSummary): string {
  const meta = p.platform === "meta";
  const cur = p.currency;
  const head = `name | parent | spend | share of spend | impr | clicks | CTR | CPC | conv | CPA | ROAS | ${meta ? "frequency" : "search impr share"} | flags`;
  const lines = [
    `== ${PLAT[p.platform]} (currency ${cur}) ==`,
    `Totals: spend ${money(p.spend, cur)}, impressions ${fmt(p.impressions)}, clicks ${fmt(p.clicks)}, CTR ${pct(p.ctr, 2)}, CPC ${money(p.cpc, cur)}, conversions ${p.conv_known ? fmt(p.conversions, 1) : "not in export"}, CPA ${money(p.cpa, cur)}, conv rate ${pct(p.conv_rate, 2)}${p.roas != null ? `, ROAS ${p.roas.toFixed(2)}` : ""}${meta && p.frequency != null ? `, frequency ${p.frequency.toFixed(2)}` : ""}. Health score ${p.score}/100.`,
    `Campaigns (${p.campaign_count}, top 25 by spend):`,
    head,
    ...p.campaigns.slice(0, 25).map((e) => entityLine(e, cur, meta)),
  ];
  if (p.adsets.length) lines.push(`${meta ? "Ad sets" : "Ad groups"} (${p.adset_count}, top 30 by spend):`, head, ...p.adsets.slice(0, 30).map((e) => entityLine(e, cur, meta)));
  if (p.keywords.length) lines.push(`Keywords (top 20 by spend):`, head, ...p.keywords.slice(0, 20).map((e) => entityLine(e, cur, false)));
  if (p.result_types.length) lines.push(`Meta result types: ${p.result_types.map((r) => `${r.indicator} (${r.rows} rows, ${r.counts_as_conversion ? "counted as conversion" : "NOT a conversion"})`).join("; ")}`);
  return lines.join("\n");
}

function promptTables(a: AdsAnalysis): string {
  const plats = Object.values(a.platforms) as PlatformSummary[];
  const g = a.platforms.google;
  const cur = g?.currency ?? "SGD";
  return [
    ...plats.map(platformBlock),
    "",
    "FLAGS (computed against this account's own averages, highest severity first):",
    ...(a.flags.slice(0, 40).map((f) => `- [${f.severity}] ${PLAT[f.platform]} ${f.level === "account" ? "account" : levelLabel(f.platform, f.level)} "${f.name}" ${f.type}: ${f.detail}`) || []),
    a.flags.length === 0 ? "- none" : "",
    "",
    a.wasted_search_terms.length
      ? `SEARCH TERMS WITH SPEND AND ZERO CONVERSIONS (total ${money(a.wasted_spend_total, cur)}, top 40 by spend; term | campaign | ad group | match | clicks | spend | enough data | brand):\n${a.wasted_search_terms
          .slice(0, 40)
          .map((w) => `${w.term} | ${w.campaign} | ${w.ad_group} | ${w.match_type || "-"} | ${w.clicks} | ${money(w.spend, cur)} | ${w.enough_data ? "yes" : "no"} | ${w.is_brand ? "brand" : ""}`)
          .join("\n")}`
      : "No search terms report was provided.",
    "",
    `SCALE CANDIDATES (rules): ${a.scale_candidates.map((s) => `${PLAT[s.platform]} ${levelLabel(s.platform, s.level)} "${s.name}" +${s.budget_shift_pct}%: ${s.reason}`).join("; ") || "none"}`,
    `PAUSE / CUT CANDIDATES (rules): ${a.pause_candidates.map((s) => `${PLAT[s.platform]} ${levelLabel(s.platform, s.level)} "${s.name}" ${s.action}${s.reduce_pct ? ` ${s.reduce_pct}%` : ""}: ${s.reason}`).join("; ") || "none"}`,
    `TRACKING CHECKS: ${a.tracking.join(" ") || "no problems detected"}`,
  ].join("\n");
}

// ---------- Rules-based prescriptions (demo mode, and the fallback content) ----------

function list(names: string[], n = 6) {
  const shown = names.slice(0, n).map((x) => `"${x}"`);
  return shown.join(", ") + (names.length > n ? ` and ${names.length - n} more` : "");
}

export function rulePrescriptions(a: AdsAnalysis, ws: WorkspaceRow): Prescription[] {
  const out: Prescription[] = [];
  const market = marketFor(ws.country);
  const chat = adsChat(market);
  const regulated = Boolean(ws.regulated);
  const g = a.platforms.google;
  const m = a.platforms.meta;
  const has = (p: Platform, t: string) => a.flags.some((f) => f.platform === p && f.type === t);

  if (g && has("google", "tracking"))
    out.push({
      title: "Fix Google Ads conversion tracking before spending more",
      diagnosis: `Google Ads spent ${money(g.spend, g.currency)} and recorded zero conversions. Without conversions Google can't tell good clicks from bad ones, and neither can you.`,
      steps: [
        "In Google Ads, go to Goals > Conversions > Summary.",
        "Look at the Status column for each Primary action. 'Inactive', 'Unverified' or 'No recent conversions' means the tag isn't firing.",
        `Open tagassistant.google.com, connect your website, submit a test enquiry or ${chat.button}, and confirm the conversion fires.`,
        `If most enquiries come by ${chat.via}, add conversion actions for ${chat.convo} (Goals > Conversions > + New conversion action).`,
        "Check each campaign uses these goals: Campaigns > (campaign) > Settings > Goals.",
      ],
      where: "Google Ads > Goals > Conversions > Summary",
      priority: "urgent", impact: "high", effort: "half-day", category: "Google Ads", recheck_days: 7,
    });
  if (m && has("meta", "tracking"))
    out.push({
      title: "Fix Meta conversion tracking before spending more",
      diagnosis: `Meta Ads spent ${money(m.spend, m.currency)} and recorded zero leads or sales. Meta is optimising blind.`,
      steps: [
        "Open Meta Events Manager > Data sources and pick your Pixel / dataset.",
        "On the Overview tab, check your Lead, Contact or Purchase event received activity in the last 7 days.",
        "Use the Test events tab: open your site, submit a test enquiry, and confirm the event shows up.",
        "In Ads Manager, open each ad set > Conversion section and confirm the conversion event is your lead event, not Page View.",
      ],
      where: "Meta Events Manager > Data sources",
      priority: "urgent", impact: "high", effort: "half-day", category: "Meta Ads", recheck_days: 7,
    });
  if (m && has("meta", "objective")) {
    const f = a.flags.find((x) => x.platform === "meta" && x.type === "objective")!;
    out.push({
      title: `Move Meta budget from Traffic campaigns to ${chat.objTitle}`,
      diagnosis: `${f.detail} Traffic campaigns find people who click, not people who book.`,
      steps: [
        `In Meta Ads Manager, click + Create and ${chat.objStep}.`,
        `Set the conversion location to ${chat.location}.`,
        "Copy your best-performing ads into the new campaign so you keep the creative that works.",
        "Shift budget across gradually over 1 to 2 weeks, then switch the Traffic campaign off on the Campaigns tab.",
      ],
      where: "Meta Ads Manager > Campaigns > + Create",
      priority: f.severity === "high" ? "urgent" : "high", impact: "high", effort: "half-day", category: "Meta Ads", recheck_days: 14,
    });
  }
  if (g && has("google", "conv_gt_clicks"))
    out.push({
      title: "Stop double counting Google Ads conversions",
      diagnosis: "Google reports more conversions than clicks, which usually means several conversion actions count the same enquiry. Your CPA looks better than it is.",
      steps: [
        "Go to Goals > Conversions > Summary.",
        `Keep only real enquiries (form submit, ${chat.click}, call) as Primary. Set page views and scroll goals to Secondary.`,
        "For lead actions, set Count to 'One' instead of 'Every' (open the action > Edit settings > Count).",
      ],
      where: "Google Ads > Goals > Conversions",
      priority: "high", impact: "high", effort: "quick", category: "Google Ads", recheck_days: 14,
    });

  for (const p of ["google", "meta"] as const) {
    const items = a.pause_candidates.filter((c) => c.platform === p);
    if (!items.length) continue;
    const ps = a.platforms[p]!;
    const toPause = items.filter((c) => c.action === "pause");
    const toCut = items.filter((c) => c.action === "reduce");
    const lvl = (c: (typeof items)[number]) => levelLabel(p, c.level);
    const steps: string[] = [];
    if (p === "google") {
      if (toPause.length)
        steps.push(
          toPause.some((c) => c.level !== "campaign") ? "Open Google Ads > Campaigns, then the Ad groups or Keywords tab for ad groups and keywords." : "Open Google Ads > Campaigns.",
          `Tick ${list(toPause.map((c) => c.name))}, then click Edit > Pause.`,
        );
      if (toCut.length) steps.push(`Lower the daily budget on ${list(toCut.map((c) => c.name))} by ${toCut[0].reduce_pct ?? 25}%: click the budget in the Budget column, change it, Save.`);
      steps.push("Leave everything else alone for 7 days, then run Ads Doctor again with a fresh export.");
    } else {
      if (toPause.length) steps.push(`Open Meta Ads Manager > Ad sets tab.`, `Switch off the toggle for ${list(toPause.map((c) => c.name))}.`);
      if (toCut.length) steps.push(`Lower the budget on ${list(toCut.map((c) => c.name))} by ${toCut[0].reduce_pct ?? 25}%. If the budget is set at campaign level (Advantage campaign budget), change it on the Campaigns tab.`);
      steps.push("Avoid other edits for a few days so Meta's learning phase isn't reset.");
    }
    const wastedSpend = items.reduce((n, c) => n + c.spend, 0);
    out.push({
      title: `${toPause.length ? "Pause" : "Cut budget on"} the ${PLAT[p]} ${items.length === 1 ? lvl(items[0]) : "items"} costing the most per result`,
      diagnosis: `${items.length} ${PLAT[p]} item${items.length === 1 ? "" : "s"} spent ${money(wastedSpend, ps.currency)} with no conversions or at well above your average cost per conversion (${money(ps.cpa, ps.currency)}). ${items[0].reason}`,
      steps,
      where: p === "google" ? "Google Ads > Campaigns" : "Meta Ads Manager > Ad sets",
      priority: toPause.length ? "high" : "medium", impact: "high", effort: "quick", category: PLAT[p], recheck_days: 7,
    });
  }

  if (g && a.negative_candidates.length)
    out.push({
      title: `Add ${a.negative_candidates.length} negative keyword${a.negative_candidates.length === 1 ? "" : "s"} to stop paying for searches that never convert`,
      diagnosis: `Search terms with spend and zero conversions cost ${money(a.wasted_spend_total, g.currency)} in this period. The biggest was "${a.wasted_search_terms[0]?.term}".`,
      steps: [
        "Click 'Copy as negative keywords' in the Wasted search terms section of this report.",
        "In Google Ads, go to Tools > Shared library > Exclusion lists (Negative keyword lists) and click +.",
        "Name it 'MarketingRx negatives', paste the list, and Save.",
        "Tick the new list > Apply to campaigns, and pick your Search campaigns.",
        "Every week, check Campaigns > Insights and reports > Search terms and add new irrelevant terms to the same list.",
      ],
      where: "Google Ads > Tools > Shared library > Exclusion lists",
      priority: "high", impact: "medium", effort: "quick", category: "Google Ads", recheck_days: 14,
    });

  if (a.scale_candidates.length) {
    const s = a.scale_candidates;
    out.push({
      title: "Give more budget to the campaigns that bring the cheapest enquiries",
      diagnosis: `${list(s.map((c) => c.name), 4)} ${s.length === 1 ? "brings" : "bring"} conversions below your account's average cost. ${s[0].reason}`,
      steps: [
        ...s.slice(0, 5).map((c) => `${PLAT[c.platform]}: raise the budget on "${c.name}" by ${c.budget_shift_pct}%.`),
        "Fund it from the items you paused so total spend stays the same.",
        "Wait 3 to 5 days between increases. Big jumps reset the learning phase and can push cost per result up.",
      ],
      where: s.every((c) => c.platform === "google") ? "Google Ads > Campaigns > Budget column" : s.every((c) => c.platform === "meta") ? "Meta Ads Manager > Ad sets > Budget" : "Google Ads > Campaigns and Meta Ads Manager > Ad sets",
      priority: "medium", impact: "high", effort: "quick", category: s[0].platform === "google" ? "Google Ads" : "Meta Ads", recheck_days: 7,
    });
  }

  const tired = a.flags.filter((f) => f.type === "high_frequency" && f.level !== "campaign");
  if (m && tired.length)
    out.push({
      title: "Refresh tired Meta ads where people see them too often",
      diagnosis: `${list(tired.map((f) => f.name), 4)} ${tired.length === 1 ? "has" : "have"} frequency above 3 (a common rule of thumb; retargeting can run higher). Results usually get pricier as the same people keep seeing the same ad.`,
      steps: [
        "In Ads Manager, open the ad set and click + Create (or duplicate an ad) to add 2 to 3 new ads with a different hook.",
        regulated
          ? `Angles to try: a short what-to-expect walkthrough, a doctor or practitioner answering a common question, a clinic tour. Avoid before-and-after photos and testimonials (${market.code === "SG" ? "not allowed for healthcare advertising in Singapore" : `often restricted for healthcare advertising; check the rules in ${market.inPhrase}`}).`
          : `Angles to try: a before-and-after or process shot, an answer to the question you get most ${chat.heard}, a short founder or staff video.`,
        "Broaden the audience a little, or exclude people who engaged in the last 30 days for prospecting ad sets.",
        "Once the new ads have a week of data, switch off the old ads with the lowest CTR.",
      ],
      where: "Meta Ads Manager > Ad sets > (ad set) > Ads",
      priority: "medium", impact: "medium", effort: "half-day", category: "Meta Ads", recheck_days: 14,
    });

  const lowCtr = a.flags.filter((f) => f.type === "low_ctr");
  for (const p of ["google", "meta"] as const) {
    const items = lowCtr.filter((f) => f.platform === p);
    if (!items.length) continue;
    out.push({
      title: `Rewrite the ${PLAT[p]} ads people scroll past`,
      diagnosis: `${list(items.map((f) => f.name), 4)} ${items.length === 1 ? "gets" : "get"} under half your account's click-through rate.`,
      steps:
        p === "google"
          ? [
              "Go to Campaigns > (campaign) > Ads and open the responsive search ad.",
              "Add headlines that repeat the service people search for and your area, plus one with a clear next step (see headline ideas in this report).",
              "Pin your strongest headline to position 1 only if Ad strength stays Good or better.",
              "For Performance Max, check Asset groups and replace assets rated Low.",
            ]
          : [
              "Open the ad set in Ads Manager and duplicate the weakest ad.",
              "Change the first line and the first 3 seconds of the visual: lead with the customer's problem or question.",
              "Keep both running for a week, then switch off the one with the lower CTR.",
            ],
      where: p === "google" ? "Google Ads > Campaigns > Ads" : "Meta Ads Manager > Ads",
      priority: "medium", impact: "medium", effort: "half-day", category: PLAT[p], recheck_days: 14,
    });
  }

  const conc = a.flags.find((f) => f.type === "concentration" && f.severity === "medium");
  if (conc)
    out.push({
      title: "Spread your budget so one campaign isn't carrying everything",
      diagnosis: conc.detail,
      steps: [
        "Keep the big campaign running but cap its daily budget at today's level.",
        "Put the next 10 to 20% of budget into your second-best campaign by cost per conversion.",
        "Review again after 2 weeks.",
      ],
      where: conc.platform === "google" ? "Google Ads > Campaigns > Budget column" : "Meta Ads Manager > Campaigns",
      priority: "low", impact: "medium", effort: "quick", category: PLAT[conc.platform], recheck_days: 14,
    });

  for (const p of ["google", "meta"] as const) {
    const ps = a.platforms[p];
    if (ps && !ps.conv_known && !has(p, "objective"))
      out.push({
        title: `Export ${PLAT[p]} again with the ${p === "google" ? "Conversions" : "Results"} column`,
        diagnosis: `This ${PLAT[p]} export has no conversions column, so we can't tell which campaigns bring enquiries.`,
        steps:
          p === "google"
            ? ["In Google Ads, open Campaigns and click Columns > Modify columns.", "Add Conversions, Cost / conv. and Conv. value, then Apply.", "Click the download icon > .csv and upload the new file here."]
            : ["In Ads Manager, click Columns > Performance (or Customise columns).", "Make sure Results, Result indicator and Cost per result are ticked.", "Click Export > Export table data > .csv and upload it here."],
        where: p === "google" ? "Google Ads > Campaigns > Columns" : "Meta Ads Manager > Columns",
        priority: "medium", impact: "medium", effort: "quick", category: PLAT[p], recheck_days: 3,
      });
  }

  const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
  return out.sort((x, y) => rank[x.priority] - rank[y.priority]);
}

// ---------- Template creative (demo mode) ----------

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function templateCreative(a: AdsAnalysis, ws: WorkspaceRow): AdsCreative {
  const svc = titleCase(serviceWord(ws));
  const loc = titleCase(locationWord(ws));
  const brand = ws.name || "";
  const regulated = Boolean(ws.regulated);
  const chat = adsChat(marketFor(ws.country));
  const headlines = a.platforms.google
    ? uniq([`${svc} in ${loc}`, `Book ${svc} Online`, `${svc} Near You`, `Book a Consultation Today`, chat.headline, brand, `${brand} ${loc}`, `See Our ${svc} Prices`, `Talk to Our Team Today`]).filter((h) => h && h.length <= 30)
    : [];
  const descriptions = a.platforms.google
    ? uniq([
        `${svc} at ${brand || "our team"} in ${loc}. ${chat.desc}`,
        `Not sure if ${svc.toLowerCase()} suits you? Book a consultation and get a clear plan and price.`,
        `See prices, opening hours and directions, then book online in under a minute.`,
      ]).filter((d) => d.length <= 90)
    : [];
  const meta: string[] = [];
  if (a.platforms.meta) {
    const tired = a.flags.filter((f) => f.platform === "meta" && f.type === "high_frequency" && f.level !== "campaign");
    if (tired.length) meta.push(`Add new ads to ${list(tired.map((f) => f.name), 3)}: frequency is above 3, so the same people keep seeing the same creative.`);
    meta.push(`Open with the question you hear most ${chat.heard}, answered in the first 3 seconds with captions on.`);
    meta.push(
      regulated
        ? "Test a 20-second video of your doctor or practitioner explaining who the treatment suits and what to expect. Skip before-and-after photos and testimonials."
        : "Test a real before-and-after or a behind-the-scenes clip from your team instead of polished stock images.",
    );
    meta.push(`Test a clear next step in the ad itself: ${chat.cta} gets more replies than a plain 'Learn more' button.`);
    meta.push("Make vertical 9:16 versions for Reels and Stories; square images get cropped there.");
  }
  return { source: "template", google_headlines: headlines, google_descriptions: descriptions, meta };
}

function uniq(xs: string[]): string[] {
  const seen = new Set<string>();
  return xs.map((x) => x.trim()).filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
}

// ---------- Result assembly ----------

function baseResult(g: Gathered, a: AdsAnalysis) {
  return {
    sample: g.sample,
    sources_used: g.sources,
    period: g.period,
    warnings: g.warnings.slice(0, 12),
    platforms: a.platforms,
    flags: a.flags,
    wasted_search_terms: a.wasted_search_terms,
    wasted_spend_total: a.wasted_spend_total,
    negative_candidates: a.negative_candidates,
    scale_candidates: a.scale_candidates,
    pause_candidates: a.pause_candidates,
    tracking: a.tracking,
    total_spend: a.total_spend,
  };
}

function platformNames(a: AdsAnalysis) {
  return (Object.keys(a.platforms) as Platform[]).map((p) => PLAT[p]).join(" and ");
}

function ruleSummary(g: Gathered, a: AdsAnalysis, ws: WorkspaceRow): string {
  const parts: string[] = [];
  const cur = a.platforms.google?.currency ?? a.platforms.meta?.currency ?? marketFor(ws.country).currency;
  if (g.sample) parts.push(`This is sample data, not ${ws.name ? ws.name + "'s" : "your"} account. Upload your Google Ads or Meta Ads export to see your own numbers.`);
  else parts.push("Rules-based review of your real numbers (AI writing is off).");
  parts.push(`${platformNames(a)} spent ${money(a.total_spend, cur)} in ${g.period.toLowerCase().startsWith("last") ? "the " + g.period.toLowerCase() : "this period"}, ads health ${a.score ?? "-"}/100.`);
  if (a.tracking.length) parts.push(a.tracking[0]);
  else {
    const top = a.pause_candidates[0];
    if (top) parts.push(`Biggest leak: "${top.name}" (${money(top.spend, cur)} spent). ${top.reason}`);
    if (a.negative_candidates.length) parts.push(`${a.negative_candidates.length} search terms are ready to add as negative keywords.`);
  }
  return parts.join(" ");
}

function matchName(name: string, a: AdsAnalysis, platform: Platform): boolean {
  const p = a.platforms[platform];
  if (!p) return false;
  const n = name.toLowerCase().trim();
  return [...p.campaigns, ...p.adsets, ...p.keywords].some((e) => e.name.toLowerCase().trim() === n);
}

export const adsAgent: AgentDef<Input> = {
  id: "ads",
  name: "Ads Doctor",
  blurb: "Checks your Google and Meta ads and tells you what to pause, scale and fix.",
  description:
    "Connect your Google Ads and Meta ad accounts once, or upload your exports. Ads Doctor works out cost per enquiry for every campaign, finds the spend that brings nothing back, lists negative keywords to add, picks the winners worth more budget and checks your tracking. You make the changes in Ads Manager yourself, with exact click paths.",

  parseInput(raw, ws) {
    const r = (raw ?? {}) as Record<string, unknown>;
    // "windsor" is how live sync was stored before native connections; re-runs of those reports sync live.
    let source: Source = r.source === "live" || r.source === "windsor" ? "live" : r.source === "sample" ? "sample" : "upload";
    const days = DAY_OPTIONS.includes(Number(r.days)) ? Number(r.days) : 30;
    const notes = String(r.notes ?? "").trim().slice(0, 1000);
    let reports: ReportInput[] = [];
    if (source === "live") {
      if (!connectedSources(ws).ads) throw new Error("Connect your Google Ads or Meta ad account in Settings > Connected accounts first, or upload your exports instead.");
    } else if (source === "upload") {
      reports = cleanReports(r.reports);
      if (reports.length > MAX_REPORTS) throw new Error(`Upload up to ${MAX_REPORTS} reports at a time.`);
      for (const rep of reports) {
        if (rep.csv.length > MAX_CSV_CHARS) throw new Error(`${rep.filename} is too large. Export a shorter date range or fewer columns (max about 2 MB per file).`);
        const parsed = parseReport(rep);
        if (parsed.rows.length === 0) throw new Error(parsed.warnings[0] ?? `We couldn't find ad data in ${rep.filename}.`);
      }
      if (reports.length === 0) {
        // Without the AI there's nothing to spend, so show the sample. With it, ask for real data.
        if (aiEnabled()) throw new Error("Upload or paste at least one Google Ads or Meta Ads export, or try the sample data.");
        source = "sample";
      }
    }
    return { source, reports, days, notes };
  },

  runTitle(input) {
    if (input.source === "sample") return "Ads checkup: sample account";
    if (input.source === "live") return `Ads checkup: live sync, last ${input.days} days`;
    const plats = new Set(input.reports.map((r) => parseReport(r).platform).filter(Boolean) as Platform[]);
    return `Ads checkup: ${[...plats].map((p) => PLAT[p]).join(" + ") || "uploaded reports"}`;
  },

  async run(input, ctx) {
    const g = await gather(input, ctx, { fallbackToSample: false });
    ctx.progress("Working out cost per result for every campaign");
    const a = analyzeAds(g.rows, { currency: g.currency, defaultCurrency: marketFor(ctx.ws.country).currency, brandTerms: brandTerms(ctx.ws) });
    ctx.progress("Writing your ads prescriptions");

    const ai = await structured({
      system:
        "You are Ads Doctor, a Google Ads and Meta Ads specialist at a performance marketing agency. You receive computed metrics and rule-based flags for a small business ad account and turn them into a short diagnosis and a do-it-yourself fix list. The owner makes every change in Google Ads or Meta Ads Manager themselves.",
      prompt: `BUSINESS PROFILE
${businessContext(ctx.ws)}

DATA SOURCE: ${g.sample ? "SAMPLE DATA (not the owner's account; say so in the summary)" : input.source === "live" ? "Live read-only sync from the owner's connected Google Ads / Meta ad accounts" : "Uploaded CSV exports"}
PERIOD: ${g.period}
${input.notes ? `OWNER NOTES: ${input.notes}\n` : ""}
${promptTables(a)}

RULES FOR THIS REPORT
- Every number you mention must come from the tables above. Never invent benchmarks, industry averages, CPCs or currency amounts. Compare items to this account's own averages.
- Budget changes are percentages only (usually 20-30% at a time, with 3-5 days between changes). Never suggest a currency amount.
- what_to_pause / what_to_scale must use exact names from the tables.
- If tracking looks broken (zero conversions with spend, or more conversions than clicks), make fixing tracking the first prescription and say the other numbers can't be trusted until it's fixed.
- Frequency above 3 is a rule of thumb for fatigue, not a hard limit; retargeting can run higher.
- Prescription steps need exact click paths, e.g. "Google Ads > Campaigns > Insights and reports > Search terms", "Google Ads > Tools > Shared library > Exclusion lists", "Meta Ads Manager > Ad sets > (ad set) > Edit > Budget", "Meta Events Manager > Data sources > Test events".
- RSA headlines: 30 characters max each, descriptions 90 max. Count carefully.${ctx.ws.regulated ? `\n- Regulated business: no superlatives (best, top, No. 1), no guarantees of results, no testimonials or before-and-after claims in ad copy. ${marketFor(ctx.ws.country).code === "SG" ? "Follow Singapore healthcare / professional advertising rules." : `Follow the healthcare and professional advertising rules in ${marketFor(ctx.ws.country).inPhrase}.`}` : ""}`,
      schema: AdsAI,
      effort: "medium",
    });

    const plat = (s: string) => (String(s).toLowerCase().includes("meta") || String(s).toLowerCase().includes("facebook") ? "meta" : "google") as Platform;
    const brand = brandTerms(ctx.ws);
    const aiOut: AdsAIResult = {
      diagnosis: ai.diagnosis.map((d) => ({ platform: plat(d.platform), verdict: d.verdict, points: d.points })).filter((d) => a.platforms[d.platform]),
      what_to_pause: ai.what_to_pause.filter((x) => matchName(x.name, a, plat(x.platform))).map((x) => ({ ...x, platform: plat(x.platform) })),
      what_to_scale: ai.what_to_scale
        .filter((x) => matchName(x.name, a, plat(x.platform)))
        .map((x) => ({ ...x, platform: plat(x.platform), budget_shift_pct: Math.min(50, Math.max(5, Math.round(Number(x.budget_shift_pct) || 20))) })),
      negative_keywords: uniq(ai.negative_keywords.map((k) => k.toLowerCase().trim()))
        .filter((k) => k && !brand.some((b) => k.replace(/[[\]"]/g, "").includes(b)))
        .slice(0, 60),
      audience_notes: ai.audience_notes,
      tracking_issues: ai.tracking_issues,
    };
    const creative: AdsCreative = {
      source: "ai",
      google_headlines: a.platforms.google ? uniq(ai.creative_feedback.google_headlines).filter((h) => h.length <= 30).slice(0, 15) : [],
      google_descriptions: a.platforms.google ? uniq(ai.creative_feedback.google_descriptions).filter((d) => d.length <= 90).slice(0, 5) : [],
      meta: a.platforms.meta ? ai.creative_feedback.meta : [],
    };

    return {
      title: `${g.sample ? "Sample ads checkup" : "Ads checkup"}: ${platformNames(a)}`,
      score: a.score,
      summary: ai.summary,
      ...baseResult(g, a),
      creative,
      ai: aiOut,
      prescriptions: ai.prescriptions.map(normalizePrescription),
    };
  },

  async demo(input, ctx) {
    // Parsing, metrics, flags and prescriptions are all real. Only the free-text writing is rules-based.
    const g = await gather(input, ctx, { fallbackToSample: true });
    ctx.progress("Working out cost per result for every campaign");
    const a = analyzeAds(g.rows, { currency: g.currency, defaultCurrency: marketFor(ctx.ws.country).currency, brandTerms: brandTerms(ctx.ws) });
    return {
      title: `${g.sample ? "Sample ads checkup" : "Ads checkup"}: ${platformNames(a)}`,
      score: a.score,
      summary: ruleSummary(g, a, ctx.ws),
      ...baseResult(g, a),
      creative: templateCreative(a, ctx.ws),
      ai: null,
      prescriptions: rulePrescriptions(a, ctx.ws),
      demo: true,
    };
  },
};
