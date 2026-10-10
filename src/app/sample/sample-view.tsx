import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Coffee, Hammer, ShoppingBag, Sparkles, type LucideIcon } from "lucide-react";
import { AGENTS, SAMPLE_ORDER, type AgentId } from "@/lib/agents";
import { agentColor } from "@/lib/agent-colors";
import { BRAND } from "@/lib/config";
import { visitorMarket } from "@/lib/market-server";
import { SAMPLE_BUSINESSES, SAMPLE_BUSINESS_IDS, sampleReports, sampleWorkspace, type SampleBusinessId } from "@/lib/sample-data";
import { AGENT_REPORTS } from "@/components/reports";
import { ScoreDial } from "@/components/brand";
import { RxSlip } from "@/components/rx-slip";
import { ReportNotes } from "@/components/feedback-bar";
import { Badge, Label, cx } from "@/components/ui";
import { signupHref } from "@/components/landing/market-copy";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { sampleHref } from "@/components/landing/specialists";
import { TimeChips } from "@/components/landing/offer";

const BUSINESS_ICON: Record<SampleBusinessId, LucideIcon> = { renovation: Hammer, cafe: Coffee, store: ShoppingBag, clinic: Sparkles };

/** "See it for a renovation company / a cafe / ..." Keeps the current specialist tab. */
function BusinessSwitcher({ agent, current }: { agent: AgentId; current: SampleBusinessId }) {
  return (
    <nav aria-labelledby="sample-switch" className="mb-8 md:mb-10">
      <p id="sample-switch" className="text-[15px] font-semibold text-ink-2">
        See it for
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {SAMPLE_BUSINESS_IDS.map((id) => {
          const b = SAMPLE_BUSINESSES[id];
          const Icon = BUSINESS_ICON[id];
          const active = id === current;
          return (
            <li key={id}>
              <Link
                href={sampleHref(agent, id)}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group flex h-full items-center gap-3 rounded-2xl p-3 transition motion-reduce:transition-none md:p-4",
                  active ? "bg-ink text-white shadow-[var(--shadow-lift)]" : "bg-white/75 text-ink ring-1 ring-ink/5 hover:bg-white hover:ring-ink/15",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl md:h-11 md:w-11",
                    active ? "bg-white text-ink" : "bg-paper text-ink-2 group-hover:text-ink",
                  )}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-bold leading-tight tracking-[-0.01em] md:text-[17px]">{b.withArticle}</span>
                  <span className={cx("mt-0.5 flex flex-wrap gap-x-1.5 text-[12px] md:text-[13px]", active ? "text-white/70" : "text-ink-2")}>
                    <span>{b.name}</span>
                    {b.regulated && <span className={cx("font-semibold", active ? "text-lilac" : "text-scrub-dark")}>Regulated</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** One specialist's tab of the public sample report, for one fictional business. */
export async function SampleView({ agent, business }: { agent: AgentId; business: SampleBusinessId }) {
  const market = await visitorMarket();
  const biz = SAMPLE_BUSINESSES[business];
  const ws = sampleWorkspace(market, business);
  const reports = await sampleReports(market, business);
  const r = reports.find((x) => x.agent === agent)!;
  const def = AGENTS[agent];
  const color = agentColor(agent);
  const Report = AGENT_REPORTS[agent];
  const next = SAMPLE_ORDER[(SAMPLE_ORDER.indexOf(agent) + 1) % SAMPLE_ORDER.length];
  const result = r.result;
  // Ranked the way the prescription board ranks them.
  const RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
  const slips = [...result.prescriptions].sort((a, b) => RANK[a.priority] - RANK[b.priority]);

  return (
    <>
      <SiteNav market={market} />
      <main>
        <section aria-labelledby="sample-hero" className="px-3 md:px-4">
          <div className="chart-grid mx-auto max-w-[90rem] rounded-[2rem] bg-lilac/45 px-5 pb-10 pt-9 md:rounded-[2.75rem] md:px-14 md:pb-14 md:pt-12">
            <BusinessSwitcher agent={agent} current={business} />
            <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-center xl:grid-cols-[1fr_24rem]">
              <div>
                <p className="inline-flex rounded-full bg-white/75 px-4 py-1.5 text-sm font-semibold text-scrub-dark ring-1 ring-scrub/10">
                  Sample report for a fictional {biz.kind}
                </p>
                <h1 id="sample-hero" className="mt-5 max-w-4xl font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-6xl md:text-7xl">
                  See exactly what the specialists hand you.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2 md:text-xl">
                  {biz.name} is a made-up {biz.kind} in {ws.location}, {biz.sells}. We ran all six specialists on it. The reports and prescriptions below are the same
                  ones you get in your account; the business, the AI answers and the ad numbers are invented.
                </p>
                <TimeChips className="mt-6" />
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/#checkup"
                    className="inline-flex items-center gap-2 rounded-full bg-scrub px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(91_61_245/0.7)] transition hover:-translate-y-0.5 hover:bg-scrub-dark motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    Run the free checkup on your site <ArrowRight size={17} aria-hidden />
                  </Link>
                  <Link
                    href={signupHref(market)}
                    className="inline-flex items-center rounded-full bg-card px-6 py-3.5 text-[15px] font-semibold text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    Start free
                  </Link>
                </div>
              </div>

              {/* Contents: every specialist in the sample, with its score and slip count */}
              <div className="hidden rounded-[1.75rem] bg-card p-2 shadow-[var(--shadow-lift)] lg:block">
                <p className="px-4 pb-2 pt-3 text-[13px] font-semibold text-ink-3">In this sample</p>
                <ul className="space-y-1.5">
                  {reports.map((x) => {
                    const c = agentColor(x.agent);
                    const active = x.agent === agent;
                    return (
                      <li key={x.agent}>
                        <Link
                          href={`${sampleHref(x.agent, business)}#report`}
                          aria-current={active ? "page" : undefined}
                          className={cx(
                            "flex items-center gap-3 rounded-2xl px-4 py-2.5 transition motion-reduce:transition-none",
                            active ? c.box : "bg-paper hover:bg-mint",
                          )}
                        >
                          <span aria-hidden className={cx("h-3 w-3 shrink-0 rounded-full ring-2 ring-white", active ? "bg-ink" : c.dot)} />
                          <span className="flex-1 text-[15px] font-semibold text-ink">{c.label}</span>
                          <span className="text-[13px] text-ink-2">
                            {x.result.score != null && (
                              <>
                                <span className="font-mono font-semibold text-ink">{x.result.score}</span>/100 ·{" "}
                              </>
                            )}
                            <span className="font-mono">{x.result.prescriptions.length}</span> fixes
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Specialist tabs: one page each, so every report gets the full width */}
        <nav aria-label="Specialists in this sample" className="sticky top-16 z-30 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
          <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3 md:px-8">
            <ul className="flex w-max gap-2">
              {SAMPLE_ORDER.map((a) => {
                const c = agentColor(a);
                const active = a === agent;
                return (
                  <li key={a}>
                    <Link
                      href={`${sampleHref(a, business)}#report`}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none",
                        active ? cx(c.box, "text-ink shadow-[var(--shadow-box)]") : "bg-card text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-3",
                      )}
                    >
                      <span aria-hidden className={cx("h-2.5 w-2.5 rounded-full", active ? "bg-ink" : c.dot)} />
                      {c.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <section id="report" aria-labelledby="report-title" className="scroll-mt-32 mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-ink", color.box)}>℞ {def.name}</span>
            <Badge tone="amber">Sample report, fictional {biz.kind}</Badge>
          </div>
          <h2 id="report-title" className="font-display text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">
            {result.title}
          </h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">{def.description}</p>

          <div className="mb-10 mt-8 flex flex-col gap-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-box)] ring-1 ring-line/70 md:flex-row md:items-center md:p-8">
            {result.score != null && <ScoreDial score={result.score} label="Score" />}
            <div className="flex-1">
              <Label className="mb-1.5 text-scrub">Diagnosis</Label>
              <p className="font-display text-xl font-semibold leading-snug tracking-[-0.01em] md:text-[22px]">{result.summary}</p>
            </div>
          </div>

          {slips.length > 0 && (
            <section aria-labelledby="rx-title" className="mb-12">
              <h3 id="rx-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                The prescriptions
              </h3>
              <p className="mb-4 mt-1 text-sm text-ink-2">
                In your account these land on your prescription board, ranked, with a re-check date. Open one to see the steps.
              </p>
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {slips.map((p, i) => (
                  <RxSlip key={p.title} defaultOpen={i === 0} data={{ ...p, agent, agentName: def.name }} />
                ))}
              </div>
            </section>
          )}

          <h3 className="mb-6 font-display text-2xl font-extrabold tracking-[-0.02em]">The full report</h3>
          <div style={{ "--rx-accent": color.accent } as CSSProperties}>
            <Report result={result} run={r.run} />
            <div className="mt-12">
              <ReportNotes runId="sample" agentName={def.name} />
            </div>
          </div>

          <div className="mt-12 flex justify-end">
            <Link
              href={`${sampleHref(next, business)}#report`}
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold text-ink shadow-[var(--shadow-box)] transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                agentColor(next).box,
              )}
            >
              Next: {AGENTS[next].name} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        <section aria-labelledby="sample-close" className="px-3 pb-3 md:px-4 md:pb-4">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-6 rounded-[2rem] bg-scrub px-5 py-12 text-white md:flex-row md:items-center md:justify-between md:rounded-[2.75rem] md:px-14 md:py-16">
            <div className="max-w-2xl">
              <h2 id="sample-close" className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em] md:text-5xl">
                Get this for your business.
              </h2>
              <p className="mt-3 text-white/80">
                The free checkup runs Site Doctor on your website and writes your first prescriptions in about a minute. Rather have it done for you?{" "}
                <a href={BRAND.doneForYouUrl} className="font-semibold text-white underline underline-offset-4 focus-visible:outline-white">
                  Talk to {BRAND.parent}
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#checkup"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-scrub-dark transition hover:-translate-y-0.5 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Run the free checkup <ArrowRight size={17} aria-hidden />
              </Link>
              <Link
                href={signupHref(market)}
                className="inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/40 transition hover:ring-white focus-visible:outline-white motion-reduce:transition-none"
              >
                Create a free account
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter market={market} />
    </>
  );
}
