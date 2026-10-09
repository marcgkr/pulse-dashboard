import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Repeat } from "lucide-react";
import { BRAND, PLANS, planPrice } from "@/lib/config";
import { MARKETS, formatPrice, type Market } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";
import { Checkup } from "@/components/landing/checkup";
import { Heartbeat } from "@/components/landing/heartbeat";
import { messagingFix, signupHref } from "@/components/landing/market-copy";
import { FaqList, SectionHead, SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { HeroPacks, SpecialistShelf } from "@/components/landing/specialists";
import { RxSlip, type SlipData } from "@/components/rx-slip";
import { cx } from "@/components/ui";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | Free website checkup and DIY marketing prescriptions` },
  description:
    "Run a free checkup on your website, then get a prescription of fixes for your site, SEO, AI search, content and Google and Meta ads, with exact steps to do them yourself. Built by PULSE Digital.",
};

/** A real place for sample copy; "Anywhere else" has none, so it reads "town". */
function area(m: Market) {
  return m.code === "INTL" ? "town" : m.exampleArea;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LOOP = [
  {
    name: "Checkup",
    body: "Add your website and business profile. If you run ads, connect Google and Meta. The specialists look at what customers, Google and AI assistants see.",
  },
  {
    name: "Prescription",
    body: "Every finding becomes a slip: what is wrong, why it costs you enquiries, and the steps for your platform. Slips are ranked so you know what to do first.",
  },
  {
    name: "You fix it",
    body: "Work through the board when it suits you. Many slips take under 30 minutes. Stuck on a step? Ask PULSE. Rather not do it? Hand it to us.",
  },
  {
    name: "Re-check",
    body: "Each slip has a re-check date. Run the specialist again and see whether the score moved. The board keeps a record of what you fixed and when.",
  },
];

function sampleSlips(m: Market): SlipData[] {
  const msg = messagingFix(m);
  return [
    {
      agent: "compliance",
      title: "Review the before-and-after photos and the 'guaranteed' line on your pigmentation page",
      diagnosis: `The page shows patient before-and-after photos next to 'Guaranteed clear skin, zero downtime'. Both are flagged for review against ${m.healthAdRules}. Check them with your medical director before your next ad points here.`,
      steps: [
        "Open the pigmentation treatment page in your website editor.",
        "Remove the before-and-after gallery, or keep it only if your medical director confirms it is allowed.",
        "Replace 'Guaranteed clear skin, zero downtime' with factual wording, e.g. 'Results vary between patients. Your doctor will explain expected downtime at consultation.'",
        "Check your Meta and Google ads that link here for the same wording.",
      ],
      where: "WordPress > Pages > Treatments > Pigmentation",
      priority: "urgent",
      impact: "high",
      effort: "quick",
      category: "Compliance",
      recheck_days: 7,
      agentName: "Compliance Check",
    },
    {
      agent: "site",
      ...msg,
      priority: "high",
      impact: "high",
      effort: "quick",
      category: "Conversion",
      recheck_days: 14,
      agentName: "Site Doctor",
    },
    {
      agent: "visibility",
      title: "Answer the questions patients ask AI assistants about pigmentation treatment",
      diagnosis: `When asked to recommend a pigmentation clinic in ${area(m)}, AI assistants named two other clinics and not yours. Both have pages that answer downtime, number of sessions and suitability questions directly.`,
      steps: [
        "Add an FAQ section to the pigmentation page with 5 to 6 real questions your front desk hears.",
        "Answer each in 2 to 4 factual sentences. Avoid promises about results.",
        "Add FAQ schema using your SEO plugin's FAQ block.",
        "Re-run AI Visibility in a month to see if you are mentioned.",
      ],
      where: "WordPress > Pages > Treatments > Pigmentation",
      priority: "medium",
      impact: "medium",
      effort: "half-day",
      category: "AI search",
      recheck_days: 30,
      agentName: "AI Visibility",
    },
  ];
}

function flagged(m: Market): { text: string; flag?: string }[] {
  return [
    { text: "The " },
    { text: "best", flag: "Superlative" },
    { text: ` pico laser clinic in ${area(m)}. ` },
    { text: "Guaranteed results", flag: "Outcome guarantee" },
    { text: " with " },
    { text: "zero downtime", flag: "Absolute claim" },
    { text: ". " },
    { text: "Read what our happy patients say!", flag: "Patient testimonial" },
  ];
}

const COMPARE: [string, string, string][] = [
  ["Finding problems", "An account team audits when they have time", "Specialists run whenever you want, in minutes"],
  ["Deciding priority", "Their plan, their reporting", "Every slip ranked by urgency and impact"],
  ["Doing the work", "Their team, billed monthly", "You, with steps for your exact platform"],
  ["Checking it worked", "A monthly report", "A re-check date on every slip"],
];

function faq(m: Market) {
  const countries = MARKETS.filter((x) => x.code !== "INTL").map((x) => x.name);
  return [
    {
      q: "Do I need to be technical?",
      a: (
        <p>
          No. If you can log in to your website builder and your ads account, you can follow the steps. Each slip says where to click and what to type. When something
          still is not clear, ask PULSE inside the app and it explains that step for your setup.
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
      q: "Is my ads data safe?",
      a: (
        <p>
          Ads Doctor reads performance data so it can diagnose your campaigns. It does not make changes in your ad accounts; you do. Your data is used to produce your
          reports and is not shared with other customers. You can disconnect an account or delete your data at any time. Details are in our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      ),
    },
    {
      q: "How is this different from hiring an agency?",
      a: (
        <p>
          An agency finds what is wrong and does the work for you, on a monthly retainer. {BRAND.name} does the first part and hands you the second, so you pay for
          software instead of hours. If you would rather have the work done for you, {BRAND.parent} (the team behind {BRAND.name}) can quote for it.
        </p>
      ),
    },
    {
      q: "Does it work for businesses that are not clinics?",
      a: (
        <p>
          Yes. Salons, law firms, tuition centres, restaurants, shops and service businesses all use the same specialists. Compliance Check matters most for clinics and
          other regulated businesses in {m.inPhrase}; the rest apply to any business that gets customers online.
        </p>
      ),
    },
    {
      q: "Is the checkup really free?",
      a: (
        <p>
          Yes. The checkup at the top of this page needs no account. The free {PLANS[0].name} plan adds Site Doctor for one website and {PLANS[0].runsPerMonth} agent
          runs a month, with no card needed.
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
  const slips = sampleSlips(market);
  const flags = flagged(market);

  return (
    <>
      <SiteNav market={market} />
      <main>
        {/* Hero: a soft violet block with the live checkup */}
        <section id="checkup" aria-labelledby="hero-title" className="scroll-mt-16 px-3 pb-3 md:px-4 md:pb-4">
          <div className="chart-grid mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-lilac/45 px-5 pb-10 pt-10 md:rounded-[2.75rem] md:px-14 md:pb-16 md:pt-16">
            <Checkup
              market={market}
              intro={
                <div className="xl:flex xl:items-start xl:justify-between xl:gap-10">
                <div>
                  <p className="rise inline-flex rounded-full bg-white/75 px-4 py-1.5 text-sm font-semibold text-scrub-dark ring-1 ring-scrub/10">
                    For business owners in {market.inPhrase}
                  </p>
                  <h1
                    id="hero-title"
                    className="rise mt-5 font-display text-[2.6rem] font-extrabold leading-[0.92] tracking-[-0.035em] sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.25rem]"
                    style={{ animationDelay: "80ms" }}
                  >
                    Your marketing, diagnosed. The fixes, <span className="text-scrub">prescribed.</span>
                  </h1>
                  <p className="rise mt-6 max-w-2xl text-lg leading-relaxed text-ink-2 md:text-xl" style={{ animationDelay: "180ms" }}>
                    Six AI specialists check your website, search, AI answers, content and ads. Then they write you a prescription: what is wrong, why it costs you
                    customers, and the steps to fix it yourself.
                  </p>
                </div>
                <div className="hidden xl:block">
                  <HeroPacks />
                </div>
                </div>
              }
            />
          </div>
        </section>

        {/* Specialists: the shelf */}
        <section id="specialists" aria-labelledby="specialists-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <SectionHead id="specialists-title" title="Six specialists. One prescription board.">
            Each one examines a different part of how customers find and choose you. They all read your business profile and write their fixes to the same board.
          </SectionHead>
          <SpecialistShelf market={market} />
        </section>

        {/* Sample prescriptions, in their specialists' colours */}
        <section aria-labelledby="sample-title" className="px-3 md:px-4">
          <div className="mx-auto max-w-[90rem] rounded-[2rem] bg-card px-4 py-16 shadow-[var(--shadow-box)] md:rounded-[2.75rem] md:px-8 md:py-24">
            <div className="mx-auto max-w-7xl">
              <SectionHead id="sample-title" title="What a prescription looks like.">
                Three slips from the board of Lumen Aesthetics, a made-up clinic in {market.exampleArea}. Each arrives in its specialist&apos;s colour. Open one to see
                the steps.
              </SectionHead>
              <div className="grid items-start gap-5 lg:grid-cols-3">
                {slips.map((s, i) => (
                  <RxSlip key={s.title} data={s} defaultOpen={i === 1} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <SectionHead id="how-title" title="Checkup, prescription, you fix it, re-check.">
            The same loop a good doctor runs. You stay in charge of your marketing and always know what to do next.
          </SectionHead>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((s, i) => {
              const yours = i === 2;
              return (
                <li key={s.name} className={cx("flex flex-col rounded-3xl p-6", yours ? "bg-scrub text-white shadow-[var(--shadow-lift)]" : "bg-card shadow-[var(--shadow-box)]")}>
                  <div className="flex items-center justify-between">
                    <span
                      className={cx("grid h-10 w-10 place-items-center rounded-full font-mono text-sm font-semibold", yours ? "bg-white text-scrub" : "bg-paper text-ink")}
                    >
                      {i + 1}
                    </span>
                    {yours && <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">Your part</span>}
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-extrabold tracking-[-0.02em]">{s.name}</h3>
                  <p className={cx("mt-2 text-[15px] leading-relaxed", yours ? "text-white/85" : "text-ink-2")}>{s.body}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-ink-2">
            <Repeat size={17} className="text-scrub" aria-hidden /> Then run it again next month.
          </p>
        </section>

        {/* Compliance */}
        <section aria-labelledby="rules-title" className="px-3 md:px-4">
          <div className="mx-auto grid max-w-[90rem] gap-10 rounded-[2rem] bg-ink px-5 py-16 text-white md:rounded-[2.75rem] md:px-14 md:py-24 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
            <div>
              <h2 id="rules-title" className="max-w-xl font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl md:text-[3.5rem]">
                Knows the rules clinics advertise under.
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
                Compliance Check reads your ads and pages, flags wording for review, explains why, and suggests safer wording. Every other specialist knows when your
                business is in a regulated category and keeps its suggestions inside those rules.
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
                <p className="text-[13px] font-semibold text-ink-3">Ad copy under review</p>
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
                    Pico laser treatment for pigmentation in {area(market)}. Your doctor will assess your skin and explain expected results and downtime at consultation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why do it yourself */}
        <section aria-labelledby="why-title" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <SectionHead id="why-title" title="Agency-level diagnosis, without the retainer.">
            Most of what a marketing retainer pays for is two things: knowing what to fix, and the hours to fix it. {BRAND.name} gives you the first. You put in the
            second, on your schedule.
          </SectionHead>
          <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="rounded-3xl bg-card p-2 shadow-[var(--shadow-box)]">
              <div className="grid grid-cols-2 gap-2 px-3 pb-2 pt-3 sm:grid-cols-[10rem_1fr_1fr]">
                <span className="hidden sm:block" />
                <p className="text-[13px] font-semibold text-ink-3">Agency retainer</p>
                <p className="text-[13px] font-semibold text-scrub">{BRAND.name}</p>
              </div>
              <div className="space-y-2">
                {COMPARE.map(([row, agency, rx]) => (
                  <div key={row} className="grid grid-cols-2 gap-x-2 rounded-2xl bg-paper p-3 sm:grid-cols-[10rem_1fr_1fr] sm:items-center">
                    <p className="col-span-2 mb-1.5 font-semibold sm:col-span-1 sm:mb-0">{row}</p>
                    <p className="text-sm text-ink-2">{agency}</p>
                    <p className="flex gap-1.5 rounded-xl bg-card px-3 py-2 text-sm text-ink">
                      <Check size={16} className="mt-0.5 shrink-0 text-scrub" aria-hidden />
                      {rx}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-3xl bg-sun p-6 shadow-[var(--shadow-box)] md:p-8">
              <div>
                <h3 className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em]">Rather have {BRAND.parent} do it?</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
                  Some fixes are not worth your evening. {BRAND.parent} is the marketing agency behind {BRAND.name}. Send us any slip and we will quote to do it for you.
                  No obligation.
                </p>
              </div>
              <a
                href={BRAND.doneForYouUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                Message {BRAND.parent} on WhatsApp <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section aria-labelledby="fees-title" className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
          <SectionHead id="fees-title" title="Start free. Pay when you want every specialist.">
            Monthly plans, no contract. Every plan includes the prescription board. Prices in {market.currency}.
          </SectionHead>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => {
              const rec = p.id === "growth";
              const price = planPrice(p, market);
              return (
                <div key={p.id} className={cx("flex flex-col rounded-3xl p-6", rec ? "bg-scrub text-white shadow-[var(--shadow-lift)]" : "bg-card shadow-[var(--shadow-box)]")}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-extrabold tracking-[-0.02em]">{p.name}</h3>
                    {rec && <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">For ad spenders</span>}
                  </div>
                  <p className="mt-5 font-display text-4xl font-extrabold tabular-nums tracking-[-0.03em]">
                    {price === 0 ? "Free" : formatPrice(market, price)}
                    {price > 0 && <span className={cx("ml-1 font-sans text-sm font-medium tracking-normal", rec ? "text-white/70" : "text-ink-3")}>/month</span>}
                  </p>
                  <p className={cx("mt-3 flex-1 text-sm", rec ? "text-white/85" : "text-ink-2")}>{p.blurb}</p>
                  <p className={cx("mt-4 text-[13px] font-semibold", rec ? "text-white/70" : "text-ink-3")}>
                    <span className="font-mono">{p.runsPerMonth}</span> agent runs a month
                  </p>
                  <Link
                    href={signupHref(market, { plan: p.id })}
                    className={cx(
                      "mt-5 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 motion-reduce:transition-none",
                      rec ? "bg-white text-scrub-dark focus-visible:outline-white" : "bg-paper text-ink ring-1 ring-line hover:ring-ink-3",
                    )}
                  >
                    {p.id === "free" ? "Start free" : `Choose ${p.name}`}
                  </Link>
                </div>
              );
            })}
          </div>
          <Link href="/pricing" className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-scrub hover:underline">
            Compare every plan <ArrowRight size={16} aria-hidden />
          </Link>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-title" className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
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

        {/* Closing call */}
        <section aria-labelledby="close-title" className="px-3 pb-3 md:px-4 md:pb-4">
          <div className="mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-scrub px-5 pb-6 pt-14 text-white md:rounded-[2.75rem] md:px-14 md:pb-10 md:pt-20">
            <div className="max-w-3xl">
              <h2 id="close-title" className="font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl md:text-6xl">
                See what your website is missing.
              </h2>
              <p className="mt-4 text-lg text-white/80">The checkup takes under a minute and needs no account.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/#checkup"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-scrub-dark transition hover:-translate-y-0.5 focus-visible:outline-white motion-reduce:transition-none"
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
