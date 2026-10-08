import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Check, ExternalLink, Minus } from "lucide-react";
import { BRAND, PLANS, type PlanId } from "@/lib/config";
import { FaqList, SectionHead, SiteFooter, SiteNav, sgd } from "@/components/landing/site-chrome";
import { Badge, Label, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${BRAND.name} plans in Singapore dollars. Start with a free website checkup, then unlock every specialist from ${sgd(
    PLANS.find((p) => p.id === "starter")?.priceMonthly ?? 0,
  )} a month. Month to month, cancel any time.`,
};

const RECOMMENDED: PlanId = "growth";

type Cell = boolean | string;
const yes = true;
const no = false;

// Comparison rows. Run counts come from PLANS so they stay in sync with billing.
const ROWS: { group: string; label: string; cells: Record<PlanId, Cell> }[] = [
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
  { group: "Specialists", label: "Compliance Check for SG healthcare ads", cells: { free: no, starter: yes, growth: yes, pro: yes } },
  { group: "Specialists", label: "Ask PULSE strategist chat", cells: { free: no, starter: yes, growth: yes, pro: yes } },
  { group: "Ongoing", label: "Ads Doctor live sync (Windsor.ai)", cells: { free: no, starter: no, growth: yes, pro: yes } },
  { group: "Ongoing", label: "AI Visibility tracking over time", cells: { free: no, starter: no, growth: yes, pro: yes } },
  { group: "Support", label: "Monthly 30-min review call with PULSE", cells: { free: no, starter: no, growth: no, pro: yes } },
  { group: "Support", label: "Priority support", cells: { free: no, starter: no, growth: no, pro: yes } },
];

const BILLING_FAQ = [
  {
    q: "What currency are prices in?",
    a: <p>Singapore dollars, billed monthly. The price you see on this page is the price you pay each month.</p>,
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
        No contract. Plans are month to month and you can cancel any time from your billing page. You keep access until the end of the month you have paid for, then your
        account moves to the free {PLANS[0].name} plan. Your prescription board stays.
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

function CellMark({ value }: { value: Cell }) {
  if (value === true) return <Check size={18} className="text-scrub" aria-label="Included" />;
  if (value === false) return <Minus size={16} className="text-ink-3/60" aria-label="Not included" />;
  return <span className="font-mono text-sm tabular-nums text-ink">{value}</span>;
}

function ctaFor(id: PlanId, name: string) {
  return id === "free" ? "Start free" : `Choose ${name}`;
}

export default function PricingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="chart-grid border-b border-line">
          <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 md:px-6 md:pb-16 md:pt-16">
            <Label className="mb-4 text-scrub">Pricing · SGD per month</Label>
            <h1 className="max-w-3xl font-display text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-5xl">
              Pay for software, not hours.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
              Start with a free checkup. Move up when you want every specialist working on your marketing. Month to month, no contract.
            </p>

            <div className="mt-10 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p) => {
                const rec = p.id === RECOMMENDED;
                return (
                  <article
                    key={p.id}
                    className={cx(
                      "relative flex flex-col rounded-lg border bg-card",
                      rec ? "border-scrub shadow-[0_0_0_1px_var(--color-scrub),0_16px_32px_-16px_rgb(15_110_99/0.35)]" : "border-line",
                    )}
                  >
                    {rec && <div className="rx-perf h-2 rounded-t-lg bg-scrub/20" aria-hidden />}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-display text-xl font-semibold tracking-tight">{p.name}</h2>
                        {rec && <Badge tone="green">Recommended if you run ads</Badge>}
                      </div>
                      <p className="mt-4 font-mono text-4xl font-semibold tabular-nums tracking-tight">
                        {sgd(p.priceMonthly)}
                        <span className="ml-1 text-sm font-normal text-ink-3">/month</span>
                      </p>
                      <p className="mt-3 text-sm text-ink-2">{p.blurb}</p>
                      <ul className="mt-5 flex-1 space-y-2 border-t border-dashed border-line pt-4">
                        {p.features.map((f) => (
                          <li key={f} className="flex gap-2 text-sm">
                            <Check size={16} className="mt-0.5 shrink-0 text-scrub" aria-hidden />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/signup?plan=${p.id}`}
                        className={cx(
                          "mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition motion-reduce:transition-none",
                          rec ? "bg-scrub text-white hover:bg-scrub-dark" : "border border-line bg-card text-ink hover:border-ink-3",
                        )}
                      >
                        {ctaFor(p.id, p.name)}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-ink-3">The free plan needs no card. Paid plans are billed monthly in SGD.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="compare">
          <SectionHead id="compare" field="Compare plans" title="What each plan includes." />
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">Feature comparison across {BRAND.name} plans</caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="py-3 pr-4">
                    <Label>Feature</Label>
                  </th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className={cx("px-3 py-3 text-center", p.id === RECOMMENDED && "bg-mint")}>
                      <span className="block font-display text-base font-semibold">{p.name}</span>
                      <span className="block font-mono text-xs text-ink-3">{sgd(p.priceMonthly)}/mo</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => {
                  const newGroup = i === 0 || ROWS[i - 1].group !== r.group;
                  return (
                    <Fragment key={r.label}>
                      {newGroup && (
                        <tr>
                          <th colSpan={PLANS.length + 1} scope="colgroup" className="pb-2 pt-6 text-left">
                            <Label className="text-ink">{r.group}</Label>
                          </th>
                        </tr>
                      )}
                      <tr className="border-b border-line">
                        <th scope="row" className="py-3 pr-4 text-sm font-normal text-ink">
                          {r.label}
                        </th>
                        {PLANS.map((p) => (
                          <td key={p.id} className={cx("px-3 py-3", p.id === RECOMMENDED && "bg-mint/60")}>
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
        </section>

        <section className="border-y border-line bg-card" aria-labelledby="billing">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionHead id="billing" field="Billing questions" title="The fine print, in full." className="mb-0">
              Anything else, email{" "}
              <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-scrub underline underline-offset-4">
                {BRAND.contactEmail}
              </a>
              .
            </SectionHead>
            <FaqList items={BILLING_FAQ} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="flex flex-col gap-6 rounded-lg border border-ink bg-ink p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Not sure which plan? Start with the checkup.</h2>
              <p className="mt-1 text-white/70">See your score and first prescriptions, then decide.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup?plan=free" className="inline-flex items-center rounded-md bg-white px-5 py-3 text-[15px] font-semibold text-ink hover:bg-mint">
                Start free
              </Link>
              <a
                href={BRAND.doneForYouUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-3 text-[15px] font-semibold text-white hover:border-white"
              >
                Rather have PULSE do it? <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
