import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Check, ExternalLink, Minus } from "lucide-react";
import { BRAND, PLANS, planPrice, type PlanId } from "@/lib/config";
import { formatPrice, type Market } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";
import { signupHref } from "@/components/landing/market-copy";
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

const RECOMMENDED: PlanId = "growth";

type Cell = boolean | string;
const yes = true;
const no = false;

// Comparison rows. Run counts come from PLANS so they stay in sync with billing.
function rows(m: Market): { group: string; label: string; cells: Record<PlanId, Cell> }[] {
  return [
    {
      group: "Usage",
      label: "Agent runs a month",
      cells: Object.fromEntries(PLANS.map((p) => [p.id, String(p.runsPerMonth)])) as Record<PlanId, Cell>,
    },
    { group: "Usage", label: "Prescription board", cells: { free: yes, starter: yes, growth: yes, pro: yes } },
    { group: "Specialists", label: "Site Doctor", cells: { free: "1 site", starter: yes, growth: yes, pro: yes } },
    { group: "Specialists", label: "Keyword Lab", cells: { free: no, starter: yes, growth: yes, pro: yes } },
    { group: "Specialists", label: "AI Visibility", cells: { free: no, starter: yes, growth: yes, pro: yes } },
    { group: "Specialists", label: "Content Studio", cells: { free: no, starter: yes, growth: yes, pro: yes } },
    { group: "Specialists", label: "Ads Doctor", cells: { free: no, starter: yes, growth: yes, pro: yes } },
    {
      group: "Specialists",
      label: `Compliance Check for ads in ${m.inPhrase}`,
      cells: { free: no, starter: yes, growth: yes, pro: yes },
    },
    { group: "Specialists", label: "Ask PULSE strategist chat", cells: { free: no, starter: yes, growth: yes, pro: yes } },
    { group: "Ongoing", label: "Ads Doctor live sync (Windsor.ai)", cells: { free: no, starter: no, growth: yes, pro: yes } },
    { group: "Ongoing", label: "AI Visibility tracking over time", cells: { free: no, starter: no, growth: yes, pro: yes } },
    { group: "Support", label: "Monthly 30-min review call with PULSE", cells: { free: no, starter: no, growth: no, pro: yes } },
    { group: "Support", label: "Priority support", cells: { free: no, starter: no, growth: no, pro: yes } },
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
      q: "What counts as an agent run?",
      a: (
        <p>
          One run is one specialist examining one thing and writing prescriptions: a Site Doctor checkup of your website, a Keyword Lab study of one service, an Ads Doctor
          review of a period of campaigns. Re-checking a fix is a run too.
        </p>
      ),
    },
    {
      q: "What happens if I run out of runs?",
      a: (
        <p>
          Your board and past reports stay available. You can upgrade straight away, or wait until your runs refresh at the start of your next billing month.
        </p>
      ),
    },
    {
      q: "Can I change plans?",
      a: <p>Yes. Upgrade or downgrade from your billing page whenever you like. Upgrades apply straight away.</p>,
    },
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
          Yes. Send any prescription to {BRAND.parent} and we will quote to implement it. That work is billed separately from your plan.{" "}
          <a href={BRAND.doneForYouUrl} target="_blank" rel="noreferrer">
            Message us on WhatsApp
          </a>
          .
        </p>
      ),
    },
  ];
}

function CellMark({ value }: { value: Cell }) {
  if (value === true)
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-mint text-scrub">
        <Check size={16} strokeWidth={2.5} aria-label="Included" />
      </span>
    );
  if (value === false) return <Minus size={16} className="text-ink-3/50" aria-label="Not included" />;
  return <span className="font-mono text-sm font-semibold tabular-nums text-ink">{value}</span>;
}

function priceLabel(m: Market, n: number) {
  return n === 0 ? "Free" : formatPrice(m, n);
}

export default async function PricingPage() {
  const market = await visitorMarket();
  const table = rows(market);

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

            <div className="rise mt-10 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "240ms" }}>
              {PLANS.map((p) => {
                const rec = p.id === RECOMMENDED;
                const price = planPrice(p, market);
                return (
                  <article
                    key={p.id}
                    className={cx("flex flex-col rounded-3xl p-6", rec ? "bg-scrub text-white shadow-[var(--shadow-lift)]" : "bg-card shadow-[var(--shadow-box)]")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{p.name}</h2>
                      {rec && <span className="whitespace-nowrap rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">For ad spenders</span>}
                    </div>
                    <p className="mt-5 font-display text-[2.75rem] font-extrabold leading-none tabular-nums tracking-[-0.03em]">
                      {priceLabel(market, price)}
                      {price > 0 && <span className={cx("ml-1 font-sans text-sm font-medium tracking-normal", rec ? "text-white/70" : "text-ink-3")}>/month</span>}
                    </p>
                    <p className={cx("mt-4 text-sm", rec ? "text-white/85" : "text-ink-2")}>{p.blurb}</p>
                    <ul className={cx("mt-5 flex-1 space-y-2.5 border-t pt-5", rec ? "border-white/20" : "border-line")}>
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2 text-sm">
                          <Check size={16} className={cx("mt-0.5 shrink-0", rec ? "text-white" : "text-scrub")} aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={signupHref(market, { plan: p.id })}
                      className={cx(
                        "mt-6 inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 motion-reduce:transition-none",
                        rec ? "bg-white text-scrub-dark focus-visible:outline-white" : "bg-paper text-ink ring-1 ring-line hover:ring-ink-3",
                      )}
                    >
                      {p.id === "free" ? "Start free" : `Choose ${p.name}`}
                    </Link>
                  </article>
                );
              })}
            </div>
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
              <a
                href={BRAND.doneForYouUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/30 transition hover:ring-white focus-visible:outline-white motion-reduce:transition-none"
              >
                Rather have PULSE do it? <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter market={market} />
    </>
  );
}
