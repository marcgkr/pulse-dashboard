import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { BRAND, PLAN_ROWS, PLANS, planPrice, type AgentKey, type PlanId } from "@/lib/config";
import { AGENT_COLORS } from "@/lib/agent-colors";
import { formatPrice, type Market } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";
import { signupHref } from "@/components/landing/market-copy";
import { DoneForYouServices, GuaranteeBlock, StrategyCallButton } from "@/components/landing/offer";
import { PlanCard } from "@/components/plan-card";
import { RxTag } from "@/components/landing/rx-tag";
import { ColourRow, FaqList, SectionHead, SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { cx } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const market = await visitorMarket();
  const starter = PLANS.find((p) => p.id === "starter");
  return {
    title: "Pricing",
    description: `${BRAND.name} plans in ${market.currency}. Start with a free website checkup, then get every specialist from ${
      starter ? formatPrice(market, planPrice(starter, market)) : ""
    } a month. Month to month, cancel any time.`,
  };
}

// The plan the page leads with: everything included.
const RECOMMENDED: PlanId = "pro";

type Cell = boolean | string;

const SPECIALIST_ORDER: AgentKey[] = ["site", "keywords", "visibility", "content", "ads", "compliance"];

// Comparison rows, built from the same plan data as the cards (plan.specialists and PLAN_ROWS),
// so the table and the cards can't disagree.
function rows(): { group: string; label: string; detail?: string; cells: Record<PlanId, Cell> }[] {
  const per = (f: (p: (typeof PLANS)[number]) => Cell) => Object.fromEntries(PLANS.map((p) => [p.id, f(p)])) as Record<PlanId, Cell>;
  return [
    ...SPECIALIST_ORDER.map((id) => ({ group: "Specialists", label: AGENT_COLORS[id].label, cells: per((p) => p.specialists.includes(id)) })),
    ...PLAN_ROWS.map((r) => ({ group: "What each plan includes", label: r.label, detail: r.detail, cells: per((p) => r.value(p)) })),
  ];
}

function billingFaq(m: Market) {
  return [
    {
      q: "What currency are prices in?",
      a: (
        <p>
          {m.code === "INTL" ? "US dollars (USD)" : `${m.currency}, for businesses in ${m.inPhrase}`}, billed monthly. The price on this page is the price you pay each
          month. If your business is somewhere else, change the country at the top of the page.
        </p>
      ),
    },
    {
      q: "How do I pay?",
      a: <p>By card, through Stripe. We never see or store your full card number.</p>,
    },
    {
      q: "What counts as a report?",
      a: (
        <p>
          One report is one finished piece of work from one specialist: a Site Doctor checkup of your website, a Keyword Lab plan for one service, a 2-week content
          plan, an Ads Doctor review of a period of campaigns. Re-checking after a fix is a report too, and so is each autopilot re-check on Pro. Failed reports
          don&apos;t count.
        </p>
      ),
    },
    {
      q: "How many reports will I use?",
      a: (
        <p>
          It depends how often you re-check. A business that runs each specialist once or twice a month uses well under the {PLANS[1].name} allowance. Pick{" "}
          {PLANS[3].name} for the extra businesses and autopilot, not for the number.
        </p>
      ),
    },
    {
      q: "Can I run more than one business or location?",
      a: (
        <p>
          On {PLANS[3].name}, yes: up to {PLANS[3].businesses} on one login, each with its own profile, reports, prescription board and connected accounts. You switch
          between them from the sidebar, and they share the plan&apos;s {PLANS[3].runsPerMonth} reports a month.
        </p>
      ),
    },
    {
      q: "What happens if I run out of reports?",
      a: (
        <p>
          Your board and past reports stay available. You can upgrade straight away, or wait until your reports refresh at the start of next month.
        </p>
      ),
    },
    {
      q: "Can I change plans?",
      a: <p>Yes. Upgrade or downgrade from your billing page whenever you like. Upgrades apply straight away.</p>,
    },
    ...(BRAND.guarantee
      ? [
          {
            q: "How does the guarantee work?",
            a: (
              <p>
                {BRAND.guarantee.body} Your Pulse Score is on your dashboard. It combines your latest Site Doctor, AI Visibility and Ads Doctor scores with how many of
                your prescriptions are done. To claim, email{" "}
                <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.
              </p>
            ),
          },
        ]
      : []),
    {
      q: "Is there a contract? Can I cancel?",
      a: (
        <p>
          No contract. Plans are month to month and you can cancel any time from your billing page. You keep access until the end of the month you have paid for, then
          your account moves to the free {PLANS[0].name} plan. Your prescription board stays.
        </p>
      ),
    },
    {
      q: "Can PULSE Digital do the work for me instead?",
      a: (
        <p>
          Yes. {BRAND.parent} can implement every prescription for you and run the work behind it: Google, Meta, TikTok and LinkedIn ads, SEO, AI search, your Google
          Business Profile, landing pages and tracking, with a monthly report and call. It is priced separately from the plans here, based on your ad spend.{" "}
          <a href={BRAND.doneForYouUrl}>
            Book a free strategy call
          </a>{" "}
          to talk it through.
        </p>
      ),
    },
  ];
}

function CellMark({ value }: { value: Cell }) {
  if (value === true)
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-mint text-scrub">
        <Check size={16} strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  if (value === false)
    return (
      <>
        <Minus size={16} className="text-ink-3/50" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className={cx("text-center text-sm font-semibold text-ink", /^\d+$/.test(value) && "font-mono tabular-nums")}>{value}</span>;
}

export default async function PricingPage() {
  const market = await visitorMarket();
  const table = rows();

  return (
    <>
      <SiteNav market={market} />
      <main>
        <section aria-labelledby="pricing-title" className="px-3 pb-3 md:px-4 md:pb-4">
          <div className="chart-grid mx-auto max-w-[90rem] rounded-[2rem] bg-lilac/45 px-5 pb-12 pt-10 md:rounded-[2.75rem] md:px-14 md:pb-16 md:pt-16">
            <p className="rise inline-flex rounded-full bg-white/75 px-4 py-1.5 text-sm font-semibold text-scrub-dark ring-1 ring-scrub/10">
              Prices in {market.currency} for {market.code === "INTL" ? "businesses anywhere" : `businesses in ${market.inPhrase}`}
            </p>
            <h1
              id="pricing-title"
              className="rise mt-5 max-w-4xl font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-6xl md:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              Pay for software, not hours.
            </h1>
            <p className="rise mt-5 max-w-2xl text-lg leading-relaxed text-ink-2 md:text-xl" style={{ animationDelay: "160ms" }}>
              Start with a free checkup. Move up when you want every specialist working on your marketing. Month to month, no contract.
            </p>

            <div className="rise mt-10 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "240ms" }}>
              {PLANS.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  market={market}
                  href={signupHref(market, { plan: p.id })}
                  cta={p.id === "free" ? "Start free" : `Choose ${p.name}`}
                  highlight={p.id === RECOMMENDED}
                  badge={p.id === RECOMMENDED ? "Everything included" : undefined}
                />
              ))}

              {/* Top tier: the agency does it. No price on the page; it anchors the DIY plans. */}
              <article className="grid gap-6 rounded-[1.75rem] bg-ink p-6 text-white shadow-[var(--shadow-lift)] sm:col-span-2 md:p-8 lg:grid-cols-[0.9fr_1.4fr] lg:gap-10 xl:col-span-4">
                <div className="flex flex-col">
                  <div className="flex min-h-7 items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-extrabold leading-[1.05] tracking-[-0.02em]">Done for you</h2>
                    <RxTag light />
                  </div>
                  <p className="mt-5 font-display text-[2.6rem] font-extrabold leading-none tracking-[-0.03em]">Custom</p>
                  <p className="mt-4 text-[15px] leading-relaxed text-white/80">By {BRAND.parent}, priced on your ad spend. For owners who want the work done, not a to-do list.</p>
                  <StrategyCallButton tone="white" size="sm" label="Book a strategy call" className="mt-6 w-full sm:w-fit sm:px-6" />
                </div>
                <div className="border-t border-white/15 pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                  <p className="text-xs font-bold text-white/70">What {BRAND.parent} does for you</p>
                  <DoneForYouServices variant="compact" className="mt-3" />
                </div>
              </article>
            </div>
            <GuaranteeBlock className="mt-4" />
            <p className="mt-5 text-sm text-ink-2">The free plan needs no card. Paid plans are billed monthly.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28" aria-labelledby="compare">
          <SectionHead id="compare" title="What each plan includes." />
          <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            <div className="min-w-[640px] rounded-3xl bg-card p-2 shadow-[var(--shadow-box)]">
              <table className="w-full border-separate border-spacing-0 text-left">
                <caption className="sr-only">
                  Feature comparison across {BRAND.name} plans, prices in {market.currency}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-4 text-[13px] font-semibold text-ink-3">
                      Feature
                    </th>
                    {PLANS.map((p) => (
                      <th key={p.id} scope="col" className={cx("px-3 py-4 text-center", p.id === RECOMMENDED && "rounded-t-2xl bg-mint")}>
                        <span className="block font-display text-lg font-extrabold tracking-[-0.02em]">{p.name}</span>
                        <span className="block text-xs text-ink-3">
                          {planPrice(p, market) === 0 ? "Free" : `${formatPrice(market, planPrice(p, market))}/month`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.map((r, i) => {
                    const newGroup = i === 0 || table[i - 1].group !== r.group;
                    const last = i === table.length - 1;
                    return (
                      <Fragment key={r.label}>
                        {newGroup && (
                          <tr>
                            <th colSpan={PLANS.length + 1} scope="colgroup" className="px-4 pb-2 pt-6 text-left">
                              <span className="inline-flex rounded-full bg-paper px-3 py-1 text-[13px] font-semibold text-ink">{r.group}</span>
                            </th>
                          </tr>
                        )}
                        <tr>
                          <th scope="row" className="border-t border-line px-4 py-3 text-[15px] font-normal text-ink">
                            {r.label}
                            {r.detail && <span className="mt-0.5 block text-[13px] text-ink-3">{r.detail}</span>}
                          </th>
                          {PLANS.map((p) => (
                            <td
                              key={p.id}
                              className={cx("border-t border-line px-3 py-3", p.id === RECOMMENDED && "bg-mint", p.id === RECOMMENDED && last && "rounded-b-2xl")}
                            >
                              <div className="flex justify-center">
                                <CellMark value={r.cells[p.id]} />
                              </div>
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28" aria-labelledby="billing">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <SectionHead id="billing" title="The fine print, in full." className="lg:sticky lg:top-24 lg:self-start">
              Anything else, email{" "}
              <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-scrub underline underline-offset-4">
                {BRAND.contactEmail}
              </a>
              .
            </SectionHead>
            <FaqList items={billingFaq(market)} />
          </div>
        </section>

        <section className="px-3 pb-3 md:px-4 md:pb-4" aria-labelledby="pricing-close">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-6 rounded-[2rem] bg-ink px-5 py-12 text-white md:flex-row md:items-center md:justify-between md:rounded-[2.75rem] md:px-14 md:py-16">
            <div>
              <ColourRow className="mb-5" />
              <h2 id="pricing-close" className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em] md:text-4xl">
                Not sure which plan? Start with the checkup.
              </h2>
              <p className="mt-2 text-white/70">See your score and first prescriptions, then decide.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={signupHref(market, { plan: "free" })}
                className="inline-flex items-center rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-ink transition hover:-translate-y-0.5 focus-visible:outline-white motion-reduce:transition-none"
              >
                Start free
              </Link>
              <StrategyCallButton label="Book a strategy call" tone="outline" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter market={market} />
    </>
  );
}
