import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { BRAND, PLANS, planPrice } from "@/lib/config";
import { MARKETS, formatPrice, type Market } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";
import { Checkup } from "@/components/landing/checkup";
import { CompactCheckup } from "@/components/landing/compact-checkup";
import { StrategyCallButton, TimeChips } from "@/components/landing/offer";
import { Heartbeat } from "@/components/landing/heartbeat";
import { HeroDemo } from "@/components/landing/hero-demo";
import { signupHref } from "@/components/landing/market-copy";
import { FaqList, SectionHead, SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { sampleHref } from "@/components/landing/specialists";
import { RxSlip } from "@/components/rx-slip";
import { AGENTS } from "@/lib/agents";
import { agentColor } from "@/lib/agent-colors";
import { homeSampleSlips } from "@/lib/sample-data";
import { cx } from "@/components/ui";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | More customers from the marketing you already have` },
  description:
    "Put in your website and get your first fixes in about a minute: the exact clicks and words for your website, Google, AI answers, social posts and ads. Free checkup, no sign-up. Built by PULSE Digital.",
};

/** Where the fictional sample businesses are; "Anywhere else" has no real place, so they get a made-up one. */
function area(m: Market) {
  return m.code === "INTL" ? "Riverside" : m.exampleArea;
}

/** What each specialist gets you, as an outcome first and one line on how. */
const OUTCOMES = [
  { agent: "site", title: "Fix what loses you enquiries", body: "Your website checked the way a customer sees it, with the fix for each problem." },
  { agent: "keywords", title: "Get found on Google", body: "The searches your customers use, and the page or article to win each one. It writes them too." },
  { agent: "visibility", title: "Show up in ChatGPT's answers", body: "Whether AI assistants recommend you, who they name instead, and how to change that." },
  { agent: "content", title: "Know what to post this week", body: "Ideas from this month's trends and your own best posts, with the script and caption written." },
  { agent: "ads", title: "Stop paying for clicks that don't buy", body: "Google, Meta and ChatGPT ads checked: what to pause, what to scale, what to test next." },
  { agent: "compliance", title: "Stay inside the ad rules", body: "Ads and pages checked against your country's rules, with safer wording to paste." },
];

const STEPS = [
  { key: "check", title: "Check", time: "About a minute", body: "Put in your website. Connect Google, Meta and your socials when you want the full picture." },
  { key: "fix", title: "Fix", time: "Most under 30 minutes", body: "Each fix comes with the clicks and the words. Do it yourself, or hand it to PULSE." },
  { key: "grow", title: "Re-check", time: "Every month", body: "Run it again and watch your score, your enquiries and your bookings move." },
];

/** The step illustrations in public/illustrations (made in Higgsfield); numbers stand in if one is missing. */
function illustration(key: string): string | null {
  return fs.existsSync(path.join(process.cwd(), "public", "illustrations", `${key}.webp`)) ? `/illustrations/${key}.webp` : null;
}

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

/** Three lines per plan for the landing page; the full list lives on /pricing. */
function planPoints(id: string): string[] {
  const p = PLANS.find((x) => x.id === id)!;
  if (id === "free") return ["Site Doctor for your website", `${p.runsPerMonth} reports a month`, "No card needed"];
  if (id === "starter") return ["All six specialists", `${p.runsPerMonth} reports a month`, "Connect your ad and social accounts"];
  if (id === "growth") return ["Everything in Starter", `${p.runsPerMonth} reports a month`, "Live ad sync and the Ask PULSE strategist"];
  return ["Everything in Growth, plus Google Business Profile", `${p.runsPerMonth} reports across ${p.businesses} outlets`, "Priority support straight to WhatsApp"];
}

export default async function LandingPage() {
  const market = await visitorMarket();
  const slips = await homeSampleSlips(market);
  const flags = flagged(market);
  const example = slips[0];

  return (
    <>
      <SiteNav market={market} />
      <main>
        {/* Hero: the promise, the free checkup, and an example of what comes back */}
        <section id="checkup" aria-labelledby="hero-title" className="scroll-mt-16 px-3 pb-3 md:px-4 md:pb-4">
          <div className="chart-grid mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-lilac/45 px-5 pb-8 pt-9 md:rounded-[2.75rem] md:px-14 md:pb-12 md:pt-14">
            <Checkup
              market={market}
              intro={
                <div className="lg:flex lg:items-center lg:justify-between lg:gap-12">
                  <div className="lg:min-w-0 lg:flex-1">
                    <h1
                      id="hero-title"
                      className="rise max-w-[14ch] font-display text-[2.7rem] font-extrabold leading-[0.92] tracking-[-0.035em] sm:text-6xl md:text-7xl xl:text-[5.4rem]"
                      style={{ animationDelay: "80ms" }}
                    >
                      More customers from the marketing you <span className="text-scrub">already have.</span>
                    </h1>
                    <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-ink-2 md:text-xl" style={{ animationDelay: "180ms" }}>
                      Put in your website. In about a minute you get a ranked list of fixes, with the exact clicks and words to use.
                    </p>
                    <TimeChips className="rise mt-6" />
                  </div>
                  <div className="mt-10 hidden justify-end md:flex lg:mt-0">
                    <HeroDemo area={area(market)} />
                  </div>
                </div>
              }
            />
            <p className="mt-6 text-[15px] text-ink-2 md:ml-auto md:w-[min(36rem,60%)] md:pl-6">
              <Link href="/sample" className="font-semibold text-scrub-dark underline underline-offset-4 hover:text-scrub">
                Or see a sample report first
              </Link>
            </p>
          </div>
        </section>

        {/* What you get: outcomes, not tools */}
        <section id="specialists" aria-labelledby="specialists-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <SectionHead id="specialists-title" title="One to-do list for all your marketing.">
            Six specialists check a part of your marketing each, and every fix lands on the same board.
          </SectionHead>
          <Reveal as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OUTCOMES.map((o) => (
              <li key={o.agent}>
                <Link
                  href={sampleHref(o.agent)}
                  className="group flex h-full flex-col rounded-3xl bg-card p-6 shadow-[var(--shadow-box)] ring-1 ring-line/70 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-3">
                    <span className={cx("h-2.5 w-2.5 rounded-full", agentColor(o.agent).dot)} aria-hidden />
                    {AGENTS[o.agent as keyof typeof AGENTS].name}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">{o.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{o.body}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-scrub">
                    See an example <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </Reveal>
          <p className="mt-6 text-[15px] text-ink-2">
            On Pro, a seventh: <span className="font-semibold text-ink">Google Business Profile</span>, with fixes, posts and review replies for each outlet.
          </p>
        </section>

        {/* How it works, with the step illustrations */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 px-3 md:px-4">
          <div className="mx-auto max-w-[90rem] rounded-[2rem] bg-card px-4 py-14 shadow-[var(--shadow-box)] md:rounded-[2.75rem] md:px-8 md:py-20">
            <div className="mx-auto max-w-7xl">
              <SectionHead id="how-title" title="Check. Fix. Watch it work." />
              <Reveal as="ol" className="grid gap-8 md:grid-cols-3 md:gap-6">
                {STEPS.map((s, i) => {
                  const art = illustration(s.key);
                  return (
                    <li key={s.key} className="flex flex-col">
                      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl bg-lilac/35">
                        {art ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={art} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-display text-7xl font-extrabold text-scrub/25" aria-hidden>
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                          {i + 1}. {s.title}
                        </h3>
                        <span className="rounded-full bg-mint px-3 py-1 text-[13px] font-semibold text-scrub-dark">{s.time}</span>
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                    </li>
                  );
                })}
              </Reveal>
            </div>
          </div>
        </section>

        {/* One real fix, written out */}
        {example && (
          <section aria-labelledby="sample-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16">
              <div>
                <SectionHead id="sample-title" title="Every fix comes written out." className="mb-6 md:mb-8">
                  What&apos;s wrong, why it costs you customers, and the exact steps for your website builder or ads account. This one is from a sample report for{" "}
                  {example.business.name}, a made-up {example.business.kind} in {area(market)}.
                </SectionHead>
                <Link
                  href="/sample"
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-5 py-3 text-[15px] font-semibold text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Read the full sample report <ArrowRight size={16} aria-hidden />
                </Link>
              </div>
              <RxSlip data={{ ...example.prescription, agent: example.agent, agentName: AGENTS[example.agent].name }} defaultOpen />
            </div>
          </section>
        )}

        {/* Regulated businesses */}
        <section aria-labelledby="rules-title" className="px-3 md:px-4">
          <div className="mx-auto grid max-w-[90rem] gap-10 rounded-[2rem] bg-ink px-5 py-14 text-white md:rounded-[2.75rem] md:px-14 md:py-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
            <div>
              <h2 id="rules-title" className="max-w-xl font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl">
                Clinic, law firm or finance? Every suggestion stays inside the rules.
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
                Compliance Check flags risky wording before it goes live and gives you a safer line to paste
                {market.code === "INTL" ? "." : `, checked against ${market.adStandards} and the health advertising rules in ${market.inPhrase}.`}
              </p>
              <p className="mt-4 max-w-xl text-sm text-white/55">A review aid, not legal advice. The final call sits with you and your adviser.</p>
            </div>
            <div className="rounded-[1.75rem] bg-card p-5 text-ink shadow-[var(--shadow-lift)] md:p-6 lg:rotate-1">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink-3">Draft ad from a made-up supplement brand</p>
                <span className="rounded-full bg-pulse px-2.5 py-0.5 text-[12px] font-bold text-white">{flags.filter((f) => f.flag).length} flags</span>
              </div>
              <p className="mt-3 text-lg leading-loose md:text-xl md:leading-loose">
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
              <div className="mt-5 rounded-2xl bg-mint p-4">
                <p className="text-[13px] font-semibold text-scrub-dark">Safer line to paste</p>
                <p className="mt-1 text-[15px] leading-relaxed">A daily marine collagen drink, one sachet a day. See the full ingredient list and who should check with a doctor first.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Plans: three lines each, the full comparison on /pricing */}
        <section id="plans" aria-labelledby="fees-title" className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <SectionHead id="fees-title" title="Start free. Upgrade when it pays for itself.">
            Monthly, no contract, prices in {market.currency}.
          </SectionHead>
          <Reveal as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => {
              const pro = p.id === "pro";
              const price = planPrice(p, market);
              return (
                <li
                  key={p.id}
                  className={cx(
                    "flex flex-col rounded-[1.75rem] p-6",
                    pro ? "bg-scrub text-white shadow-[0_24px_48px_-20px_rgb(91_61_245/0.6)]" : "bg-card shadow-[var(--shadow-box)] ring-1 ring-line/70",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-extrabold">{p.name}</h3>
                    {pro && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">Most complete</span>}
                  </div>
                  <p className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em]">
                    {price === 0 ? "Free" : formatPrice(market, price)}
                    {price > 0 && <span className={cx("ml-1 text-base font-semibold", pro ? "text-white/70" : "text-ink-3")}>/mo</span>}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {planPoints(p.id).map((x) => (
                      <li key={x} className="flex gap-2 text-[15px] leading-snug">
                        <Check size={17} className={cx("mt-0.5 shrink-0", pro ? "text-white" : "text-good")} aria-hidden /> {x}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={signupHref(market, { plan: p.id })}
                    className={cx(
                      "mt-6 inline-flex items-center justify-center rounded-full px-5 py-3 text-[15px] font-semibold transition hover:-translate-y-0.5 motion-reduce:transition-none",
                      pro ? "mt-auto bg-white text-scrub-dark" : "mt-auto bg-paper text-ink ring-1 ring-line hover:ring-ink-3",
                    )}
                  >
                    {p.id === "free" ? "Start free" : `Choose ${p.name}`}
                  </Link>
                </li>
              );
            })}
          </Reveal>
          {BRAND.guarantee && (
            <p className="mt-6 inline-flex items-start gap-2 text-[15px] text-ink-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-good" aria-hidden />
              <span>
                <span className="font-semibold text-ink">{BRAND.guarantee.title}.</span> {BRAND.guarantee.body}
              </span>
            </p>
          )}
          <p className="mt-4">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-scrub hover:underline">
              Compare everything in each plan <ArrowRight size={16} aria-hidden />
            </Link>
          </p>
        </section>

        {/* Done for you, short */}
        <section id="done-for-you" aria-labelledby="dfy-title" className="scroll-mt-16 px-3 md:px-4">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-6 rounded-[2rem] bg-lilac/35 px-5 py-12 md:rounded-[2.75rem] md:px-14 md:py-14 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="dfy-title" className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-5xl">
                Rather have {BRAND.parent} do it?
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
                {BRAND.parent} is the Singapore performance agency behind {BRAND.name}. Hand us your board and we run your ads, SEO and website changes for you.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <StrategyCallButton />
              <a href={BRAND.parentUrl} target="_blank" rel="noreferrer" className="px-3 text-[15px] font-semibold text-ink-2 hover:text-ink hover:underline">
                About {BRAND.parent}
              </a>
            </div>
          </div>
        </section>

        {/* FAQ: the objections */}
        <section aria-labelledby="faq-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <SectionHead id="faq-title" title="Questions owners ask." className="lg:sticky lg:top-24 lg:self-start">
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
