import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Repeat } from "lucide-react";
import { BRAND, PLANS } from "@/lib/config";
import { MARKETS, type Market } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";
import { Checkup } from "@/components/landing/checkup";
import { CompactCheckup } from "@/components/landing/compact-checkup";
import { DoneForYou, GuaranteeBlock, TimeChips } from "@/components/landing/offer";
import { Heartbeat } from "@/components/landing/heartbeat";
import { signupHref } from "@/components/landing/market-copy";
import { FaqList, SectionHead, SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { HeroPacks, SpecialistShelf, sampleHref } from "@/components/landing/specialists";
import { PlanCard } from "@/components/plan-card";
import { RxSlip } from "@/components/rx-slip";
import { AGENTS } from "@/lib/agents";
import { homeSampleSlips } from "@/lib/sample-data";
import { cx } from "@/components/ui";
import { LoopProgress, Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | More customers from the marketing you already have` },
  description:
    "Run a free website checkup and get your first fixes in about a minute. Six AI specialists check your website, Google search, AI answers, social and ads, then hand you the exact clicks and copy to paste. Built by PULSE Digital.",
};

/** Where the fictional sample businesses are; "Anywhere else" has no real place, so they get a made-up one. */
function area(m: Market) {
  return m.code === "INTL" ? "Riverside" : m.exampleArea;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LOOP = [
  {
    name: "Checkup",
    time: "About a minute",
    body: "Enter your website for the free checkup. Add your business profile, and connect Google and Meta if you run ads, so every specialist can look.",
  },
  {
    name: "Prescription",
    time: "",
    body: "Every finding becomes a slip: what is wrong, why it costs you enquiries, and the exact clicks and copy for your platform. The slips are ranked so you know what to do first.",
  },
  {
    name: "You fix it",
    time: "Most under 30 minutes",
    body: "Work through the board when it suits you. Stuck on a step? Ask PULSE. Rather not do it? Hand the slip to PULSE Digital.",
  },
  {
    name: "Re-check",
    time: "",
    body: "Each slip has a re-check date. Run the specialist again and see whether your score moved. The board keeps a record of what you fixed and when.",
  },
];

/** A draft ad from a fictional supplement brand, with the lines Compliance Check flags. */
function flagged(m: Market): { text: string; flag?: string }[] {
  return [
    { text: "The " },
    { text: "No. 1", flag: "Ranking claim" },
    { text: ` collagen drink in ${m.code === "INTL" ? "town" : m.name}, ` },
    { text: "clinically proven", flag: "Unproven health claim" },
    { text: " to " },
    { text: "reverse ageing in 14 days", flag: "Medical claim" },
    { text: ". " },
    { text: "Loved by 50,000 customers!", flag: "Customer count" },
  ];
}

function faq(m: Market) {
  const countries = MARKETS.filter((x) => x.code !== "INTL").map((x) => x.name);
  return [
    {
      q: "I'm not technical. Can I still do the fixes?",
      a: (
        <p>
          Yes. If you can log in to your website builder and your ads account, you can follow the steps. Each slip says where to click and what to type or paste. When
          a step still is not clear, ask PULSE inside the app and it explains that step for your setup.
        </p>
      ),
    },
    {
      q: "I already have an agency. Why would I use this?",
      a: (
        <p>
          As a second opinion you can act on. Run the specialists, then send the board to your agency as a list of what to fix, or do the small fixes yourself and
          leave them the bigger work. Each slip has a re-check date, so you can see whether a change was made and whether it moved your score.
        </p>
      ),
    },
    {
      q: "How is this different from free SEO tools?",
      a: (
        <p>
          Free SEO tools give you a score and a list of warnings. {BRAND.name} turns each problem into a prescription: why it costs you customers, where to click on your
          website builder or ads account, and the copy to paste. It also covers what SEO tools leave out: AI answers, social posts, Google, Meta and ChatGPT ads, and the
          advertising rules for regulated businesses.
        </p>
      ),
    },
    {
      q: "What if the advice is wrong for my industry?",
      a: (
        <p>
          Every specialist reads your business profile first: what you sell, where, to whom, and whether your business is in a regulated category. If a slip still does
          not fit, mark it &ldquo;Not relevant&rdquo; and it leaves your board. You can also ask PULSE why it suggested a fix and how it applies to your business. For
          regulated businesses such as clinics, law firms and financial advisers, Compliance Check is a review aid, and the final call sits with you and your professional
          adviser.
        </p>
      ),
    },
    {
      q: "Do you store my ad account data?",
      a: (
        <p>
          Ads Doctor reads your performance data, from a Google Ads, Meta Ads or ChatGPT Ads export you upload, or a live sync from your Google Ads and Meta Ads accounts. It keeps the reports it makes
          in your account so you can compare months. It never changes anything in your ad accounts; you make the changes. Your data is not shared with other customers, and you can disconnect an
          account or delete your data at any time. Details are in our <Link href="/privacy">privacy policy</Link>.
        </p>
      ),
    },
    {
      q: "Which countries is it set up for?",
      a: (
        <p>
          {countries.slice(0, -1).join(", ")} and {countries.at(-1)}. Pick your country when you sign up and the specialists use its search results, the way customers
          there message businesses, and its advertising rules. Prices show in your currency. Somewhere else? Choose &ldquo;Anywhere else&rdquo; and you get the same
          specialists with prices in US dollars.
        </p>
      ),
    },
    {
      q: "Which website builders does it work with?",
      a: (
        <p>
          Site Doctor detects WordPress, Shopify, Wix, Squarespace and Webflow and writes steps using their menus. For anything else, including custom-built sites, you
          get steps a web developer can follow without extra explanation.
        </p>
      ),
    },
    {
      q: "Does it work for my kind of business?",
      a: (
        <p>
          Yes. The same six specialists work for renovation contractors, cafes, online stores, salons, tuition centres, law firms and clinics, and each one reads your
          business profile first. Compliance Check goes deeper for regulated businesses in {m.inPhrase}, such as clinics, law firms, financial advisers and supplement
          brands; everyone else is checked against general advertising standards. See the <Link href="/sample">sample report</Link> for a renovation company, a cafe,
          an online store or a clinic.
        </p>
      ),
    },
    {
      q: "Is the checkup really free?",
      a: (
        <p>
          Yes. The checkup at the top of this page needs no account. The free {PLANS[0].name} plan adds Site Doctor for one website and {PLANS[0].runsPerMonth} reports a
          month, with no card needed.
        </p>
      ),
    },
    {
      q: "Can I cancel?",
      a: (
        <p>
          Yes, any time from your billing page. Paid plans are month to month with no contract, and you keep access until the end of the month you have paid for. See the{" "}
          <Link href="/pricing">pricing page</Link> for billing details.
        </p>
      ),
    },
  ];
}

export default async function LandingPage() {
  const market = await visitorMarket();
  const slips = await homeSampleSlips(market);
  const flags = flagged(market);

  return (
    <>
      <SiteNav market={market} />
      <main>
        {/* Hero: the outcome, the live checkup and the heartbeat */}
        <section id="checkup" aria-labelledby="hero-title" className="scroll-mt-16 px-3 pb-3 md:px-4 md:pb-4">
          <div className="chart-grid mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-lilac/45 px-5 pb-8 pt-9 md:rounded-[2.75rem] md:px-14 md:pb-12 md:pt-14">
            <Checkup
              market={market}
              intro={
                <div className="xl:flex xl:items-start xl:justify-between xl:gap-10">
                  <div className="xl:min-w-0 xl:flex-1">
                    <p className="rise inline-flex rounded-full bg-white/75 px-4 py-1.5 text-sm font-semibold text-scrub-dark ring-1 ring-scrub/10">
                      For business owners in {market.inPhrase}
                    </p>
                    <h1
                      id="hero-title"
                      className="rise mt-5 max-w-[14ch] font-display text-[2.7rem] font-extrabold leading-[0.92] tracking-[-0.035em] sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[5.1rem] 2xl:text-[5.75rem]"
                      style={{ animationDelay: "80ms" }}
                    >
                      More customers from the marketing you <span className="text-scrub">already have.</span>
                    </h1>
                    <p className="rise mt-6 max-w-2xl text-lg leading-relaxed text-ink-2 md:text-xl" style={{ animationDelay: "180ms" }}>
                      Six AI specialists check your website, Google search, AI answers, social posts and ads, then write down every fix to the click, so you can do it
                      yourself.
                    </p>
                    <TimeChips className="rise mt-6" />
                  </div>
                  <div className="hidden xl:block">
                    <HeroPacks />
                  </div>
                </div>
              }
            />
            <p className="mt-8 text-[15px] text-ink-2 md:ml-auto md:w-[min(36rem,60%)] md:pl-6">
              Want to see a full report first? Read the sample for{" "}
              <Link href={sampleHref("site", "renovation")} className="font-semibold text-scrub-dark underline underline-offset-4 hover:text-scrub">
                a renovation company
              </Link>
              ,{" "}
              <Link href={sampleHref("site", "cafe")} className="font-semibold text-scrub-dark underline underline-offset-4 hover:text-scrub">
                a cafe
              </Link>{" "}
              or{" "}
              <Link href={sampleHref("site", "store")} className="font-semibold text-scrub-dark underline underline-offset-4 hover:text-scrub">
                an online store
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Value stack: each specialist and the finished work it hands over */}
        <section id="specialists" aria-labelledby="specialists-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <SectionHead id="specialists-title" title="Six specialists. Each one hands you finished work.">
            Not a list of warnings. You get the rewritten copy, the keyword map, the ads to pause and the posts to film, all on one prescription board.
          </SectionHead>
          <SpecialistShelf market={market} />
        </section>

        {/* Sample prescriptions, in their specialists' colours */}
        <section aria-labelledby="sample-title" className="px-3 md:px-4">
          <div className="mx-auto max-w-[90rem] rounded-[2rem] bg-card px-4 py-14 shadow-[var(--shadow-box)] md:rounded-[2.75rem] md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl">
              <SectionHead id="sample-title" title="What a prescription looks like.">
                <p>
                  Three slips from three made-up businesses in {area(market)}: a renovation company, a cafe and an online store. Each carries its specialist&apos;s
                  colour. Open one to see the steps.
                </p>
                <Link
                  href="/sample"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-paper px-5 py-3 text-[15px] font-semibold text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Read the full sample report <ArrowRight size={16} aria-hidden />
                </Link>
              </SectionHead>
              <Reveal as="ul" className="grid items-start gap-5 lg:grid-cols-3">
                {slips.map((s, i) => (
                  <li key={s.business.id} className="flex flex-col gap-2.5">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 text-sm">
                      <span>
                        <span className="font-semibold text-ink">{s.business.name}</span>
                        <span className="text-ink-3">, {s.business.kind}</span>
                      </span>
                      <Link
                        href={`${sampleHref(s.agent, s.business.id)}#report`}
                        className="inline-flex items-center gap-1 font-semibold text-scrub-dark underline-offset-4 hover:underline"
                      >
                        Its full sample <ArrowRight size={14} aria-hidden />
                      </Link>
                    </p>
                    <RxSlip data={{ ...s.prescription, agent: s.agent, agentName: AGENTS[s.agent].name }} defaultOpen={i === 0} />
                  </li>
                ))}
              </Reveal>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <SectionHead id="how-title" title="Checkup, prescription, you fix it, re-check.">
            The same loop a good doctor runs. You stay in charge of your marketing and always know what to do next.
          </SectionHead>
          <div className="relative">
            <Reveal as="ol" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((s, i) => {
              const yours = i === 2;
              return (
                <li key={s.name} className={cx("flex flex-col rounded-3xl p-6", yours ? "bg-scrub text-white shadow-[var(--shadow-lift)]" : "bg-card shadow-[var(--shadow-box)]")}>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-sm font-semibold", yours ? "bg-white text-scrub" : "bg-paper text-ink")}
                    >
                      {i + 1}
                    </span>
                    {s.time && <span className={cx("rounded-full px-3 py-1 text-[13px] font-semibold", yours ? "bg-white/15" : "bg-mint text-scrub-dark")}>{s.time}</span>}
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-extrabold tracking-[-0.02em]">{s.name}</h3>
                  <p className={cx("mt-2 text-[15px] leading-relaxed", yours ? "text-white/85" : "text-ink-2")}>{s.body}</p>
                </li>
              );
            })}
            </Reveal>
            <LoopProgress />
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-ink-2 lg:mt-10">
            <Repeat size={17} className="text-scrub" aria-hidden /> Then run it again next month.
          </p>
        </section>

        {/* Compliance */}
        <section aria-labelledby="rules-title" className="px-3 md:px-4">
          <div className="mx-auto grid max-w-[90rem] gap-10 rounded-[2rem] bg-ink px-5 py-14 text-white md:rounded-[2.75rem] md:px-14 md:py-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
            <div>
              <h2 id="rules-title" className="max-w-xl font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl md:text-[3.5rem]">
                Knows the rules regulated businesses advertise under.
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
                Clinics, law firms, financial advisers, supplement and beauty brands work under stricter advertising rules than most. Compliance Check reads your ads and
                pages, flags wording for review, explains why, and suggests safer wording. Every other specialist knows when your business is in a regulated category
                and keeps its suggestions inside those rules.
              </p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/60">
                Not regulated? Your ads still get checked against general advertising standards, so a &ldquo;cheapest in town&rdquo; or &ldquo;only 3 slots left&rdquo;
                line gets flagged before a customer or a competitor does.
              </p>
              <div className="mt-8 rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10 md:p-6">
                <p className="text-[15px] font-semibold text-white">
                  {market.code === "INTL" ? "Wherever you are, it checks against:" : `In ${market.inPhrase}, it checks against:`}
                </p>
                <dl className="mt-4 space-y-4 text-[15px]">
                  <div>
                    <dt className="text-[13px] font-semibold text-lilac">Health advertising</dt>
                    <dd className="mt-0.5 text-white/85">{cap(market.healthAdRules)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] font-semibold text-lilac">General advertising</dt>
                    <dd className="mt-0.5 text-white/85">{cap(market.adStandards)}</dd>
                  </div>
                </dl>
              </div>
              <p className="mt-5 max-w-xl text-sm text-white/55">
                Compliance Check is a review aid, not legal advice. Rules change, so it points you to the official source, and the final call sits with you and your
                professional adviser.
              </p>
            </div>

            {/* Ad copy under review, in Compliance Check's lilac box */}
            <div className="rounded-[1.75rem] bg-lilac p-2 pt-0 text-ink shadow-[var(--shadow-lift)] lg:rotate-1">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="font-display text-[15px] font-bold tracking-tight">Compliance Check</span>
                <span className="rounded-full bg-pulse px-2.5 py-0.5 text-[12px] font-bold text-white">
                  <span className="font-mono">{flags.filter((f) => f.flag).length}</span> flags
                </span>
              </div>
              <div className="rounded-[1.25rem] bg-card p-5 md:p-6">
                <p className="text-[13px] font-semibold text-ink-3">Ad copy under review, from a fictional supplement brand</p>
                <p className="mt-2 text-lg leading-loose text-ink md:text-xl md:leading-loose">
                  {flags.map((f, i) =>
                    f.flag ? (
                      <mark key={i} className="rounded-md bg-pulse/10 px-1 text-ink underline decoration-pulse decoration-wavy decoration-[1.5px] underline-offset-[6px]">
                        {f.text}
                      </mark>
                    ) : (
                      <span key={i}>{f.text}</span>
                    ),
                  )}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {flags
                    .filter((f) => f.flag)
                    .map((f) => (
                      <li key={f.flag} className="rounded-full bg-amber/15 px-3 py-1 text-[13px] font-semibold text-[#7a4f08]">
                        Review: {f.flag}
                      </li>
                    ))}
                </ul>
                <div className="mt-5 rounded-2xl bg-mint p-4">
                  <p className="text-[13px] font-semibold text-scrub-dark">Suggested rewrite</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">
                    A daily marine collagen drink, one sachet a day. See the full ingredient list, how to take it, and who should check with a doctor first.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plans, with the guarantee beside them */}
        <section id="plans" aria-labelledby="fees-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <SectionHead id="fees-title" title="Start free. Pay when you want every specialist.">
            Monthly plans, no contract. Every plan includes the prescription board. Prices in {market.currency}.
          </SectionHead>
          <Reveal className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                market={market}
                href={signupHref(market, { plan: p.id })}
                cta={p.id === "free" ? "Start free" : `Choose ${p.name}`}
                highlight={p.id === "pro"}
                badge={p.id === "pro" ? "Everything included" : undefined}
              />
            ))}
          </Reveal>
          <GuaranteeBlock className="mt-4" />
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-scrub hover:underline">
              Compare every plan <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="#done-for-you" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink hover:underline">
              Or have {BRAND.parent} do it for you <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        {/* Done for you, with the founder's note */}
        <DoneForYou />

        {/* FAQ: the objections */}
        <section aria-labelledby="faq-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <SectionHead id="faq-title" title="Before you start." className="lg:sticky lg:top-24 lg:self-start">
              Anything else, email{" "}
              <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-scrub underline underline-offset-4">
                {BRAND.contactEmail}
              </a>
              .
            </SectionHead>
            <FaqList items={faq(market)} />
          </div>
        </section>

        {/* Closing call: the checkup again, so nobody has to scroll back up */}
        <section aria-labelledby="close-title" className="px-3 pb-3 md:px-4 md:pb-4">
          <div className="mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-scrub px-5 pb-6 pt-14 text-white md:rounded-[2.75rem] md:px-14 md:pb-10 md:pt-20">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-14">
              <div>
                <h2 id="close-title" className="font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl md:text-6xl">
                  See what your website is missing.
                </h2>
                <p className="mt-4 text-lg text-white/80">Your first fixes arrive in about a minute. No account needed.</p>
              </div>
              <div>
                <CompactCheckup market={market} />
                <p className="mt-5 text-[15px] text-white/75">
                  Not ready?{" "}
                  <Link href="/sample" className="font-semibold text-white underline underline-offset-4 focus-visible:outline-white">
                    Read the sample report
                  </Link>{" "}
                  or{" "}
                  <Link href={signupHref(market)} className="font-semibold text-white underline underline-offset-4 focus-visible:outline-white">
                    create a free account
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div aria-hidden className="-mx-5 mt-12 h-20 md:-mx-14 md:h-28">
              <Heartbeat tone="white" className="h-full" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter market={market} />
    </>
  );
}
