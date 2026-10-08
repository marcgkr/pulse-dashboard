import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, MessageSquareText } from "lucide-react";
import { BRAND, PLANS } from "@/lib/config";
import { Checkup } from "@/components/landing/checkup";
import { FaqList, SectionHead, SiteFooter, SiteNav, sgd } from "@/components/landing/site-chrome";
import { RxSlip, type SlipData } from "@/components/rx-slip";
import { Badge, ButtonLink, Label, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | Free website checkup and DIY marketing prescriptions` },
  description:
    "Run a free checkup on your website, then get a prescription of fixes for your site, SEO, AI search, content and Google and Meta ads, with exact steps to do them yourself. Built in Singapore by PULSE Digital.",
};

const SEQUENCE = [
  {
    name: "Checkup",
    body: "Add your website and business profile. If you run ads, connect Google and Meta. The specialists examine what is there, the way Google, AI assistants and your customers see it.",
  },
  {
    name: "Prescription",
    body: "Every finding becomes a slip: what is wrong, why it costs you enquiries, and the steps to fix it on your platform. Slips are ranked so you know what to do first.",
  },
  {
    name: "You implement",
    body: "Work through the board at your own pace. Many slips take under 30 minutes. If a step is unclear, ask PULSE explains it. If you would rather not, hand it to us.",
  },
  {
    name: "Re-check",
    body: "Each slip carries a re-check date. Run the specialist again and see whether the score moved. The board keeps a record of what you fixed and when.",
  },
];

const SPECIALISTS = [
  {
    name: "Site Doctor",
    examines: "Your website: speed, mobile, SEO basics, contact options, tracking tags",
    hands: "A fix list with steps for your site builder, plus a better title, headline and FAQ to paste in",
  },
  {
    name: "Keyword Lab",
    examines: "What people in Singapore type into Google when they need what you sell",
    hands: "Keyword groups sorted by intent, and which page on your site should target each one",
  },
  {
    name: "AI Visibility",
    examines: "Whether ChatGPT, Perplexity and Google's AI answers mention you or a competitor",
    hands: "The questions where you are missing, and the content that gives AI assistants something to quote",
  },
  {
    name: "Content Studio",
    examines: "Your services, offers and brand voice",
    hands: "Social posts and captions drafted for your business, ready to edit and schedule",
  },
  {
    name: "Ads Doctor",
    examines: "Your Google and Meta ads performance, from an export or a live connection",
    hands: "What to pause, what to give more budget, and rewritten ad copy to test",
  },
  {
    name: "Compliance Check",
    examines: "Ad and page copy for regulated businesses",
    hands: "Phrases flagged for review against SG healthcare advertising rules, with safer wording",
  },
];

const SAMPLE_SLIPS: SlipData[] = [
  {
    title: "Review the before-and-after photos and the 'guaranteed' line on your pigmentation page",
    diagnosis:
      "The page shows patient before-and-after photos next to the line 'Guaranteed clear skin, zero downtime'. Singapore's healthcare advertising rules restrict both. Flagged for you and your medical director to review before your next ad runs to this page.",
    steps: [
      "Open the pigmentation treatment page in your website editor.",
      "Remove the before-and-after gallery, or move it behind the consultation process if your medical director confirms that is allowed.",
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
    title: "Add a WhatsApp button to every treatment page",
    diagnosis:
      "Only the Contact page has a way to reach you. Someone reading about a treatment on their phone has to go looking for your number, and many will not.",
    steps: [
      "Install a click-to-chat plugin, or add a button linking to https://wa.me/65XXXXXXXX (your clinic number, no spaces).",
      "Pre-fill the message: 'Hi, I'd like to ask about [treatment name].'",
      "Show it as a fixed button at the bottom right on mobile.",
      "Tap it on your own phone to test.",
    ],
    where: "WordPress > Plugins > Add New",
    priority: "high",
    impact: "high",
    effort: "quick",
    category: "Conversion",
    recheck_days: 14,
    agentName: "Site Doctor",
  },
  {
    title: "Answer the questions patients ask AI assistants about pigmentation treatment",
    diagnosis:
      "When asked to recommend a pigmentation clinic in Novena, AI assistants named two other clinics and not yours. Both have pages that answer downtime, number of sessions and suitability questions directly.",
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

const FLAGGED: { text: string; flag?: string }[] = [
  { text: "Singapore's " },
  { text: "best", flag: "Superlative" },
  { text: " pico laser clinic. " },
  { text: "Guaranteed results", flag: "Outcome guarantee" },
  { text: " with " },
  { text: "zero downtime", flag: "Absolute claim" },
  { text: ". " },
  { text: "Read what our happy patients say!", flag: "Patient testimonial" },
];

const FAQ = [
  {
    q: "Do I need to be technical?",
    a: (
      <p>
        No. If you can log in to your website builder and your ads account, you can follow the steps. Each slip says where to click and what to type. When
        something still is not clear, ask PULSE inside the app and it explains that step for your setup.
      </p>
    ),
  },
  {
    q: "Which website builders does it work with?",
    a: (
      <p>
        Site Doctor detects WordPress, Shopify, Wix, Squarespace and Webflow and writes steps using their menus. For anything else, including custom-built sites, you get
        steps a web developer can follow without extra explanation.
      </p>
    ),
  },
  {
    q: "Is my ads data safe?",
    a: (
      <p>
        Ads Doctor reads performance data so it can diagnose your campaigns. It does not make changes in your ad accounts; you do. Your data is used to produce your reports
        and is not shared with other customers. You can disconnect an account or delete your data at any time. Details are in our <Link href="/privacy">privacy policy</Link>.
      </p>
    ),
  },
  {
    q: "How is this different from hiring an agency?",
    a: (
      <p>
        An agency finds what is wrong and does the work for you, on a monthly retainer. {BRAND.name} does the first part and hands you the second, so you pay for software
        instead of hours. If you would rather have the work done for you, {BRAND.parent} (the team behind {BRAND.name}) can quote for it.
      </p>
    ),
  },
  {
    q: "Does it work for non-medical businesses?",
    a: (
      <p>
        Yes. Salons, law firms, tuition centres, F&amp;B, retail and service businesses all use the same specialists. Compliance Check is tuned for Singapore healthcare
        advertising, so it matters most for clinics; the rest apply to any business that gets customers online.
      </p>
    ),
  },
  {
    q: "What does an agent run mean?",
    a: (
      <p>
        One run is one specialist examining one thing and writing prescriptions, for example a Site Doctor checkup of your website or an Ads Doctor review of last
        month&apos;s campaigns. Each plan includes a set number of runs a month.
      </p>
    ),
  },
  {
    q: "Is the checkup really free?",
    a: (
      <p>
        Yes. The checkup at the top of this page needs no account. The free {PLANS[0].name} plan adds Site Doctor for one website and {PLANS[0].runsPerMonth} agent runs a month, with no card needed.
      </p>
    ),
  },
  {
    q: "Can I cancel?",
    a: (
      <p>
        Yes, any time from your billing page. Paid plans are month to month with no contract, and you keep access until the end of the month you have paid for. See
        the <Link href="/pricing">pricing page</Link> for billing details.
      </p>
    ),
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        {/* Hero: the live checkup */}
        <section id="checkup" className="chart-grid border-b border-line">
          <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 md:px-6 md:pb-20 md:pt-16">
            <Checkup
              intro={
                <div>
                  <Label className="mb-4 text-scrub">For Singapore business owners who do their own marketing</Label>
                  <h1 className="font-display text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl lg:text-[3.6rem]">
                    Your marketing, diagnosed. The fixes, prescribed.
                  </h1>
                  <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
                    {BRAND.name} examines your website, search presence, AI visibility and ads, then hands you a prescription: each problem, why it matters, and the exact steps
                    to fix it yourself.
                  </p>
                  <p className="mt-4 hidden max-w-xl text-[15px] text-ink-2 sm:block">
                    Try it now on your own website. You get a score and your first three prescriptions in under a minute.
                  </p>
                </div>
              }
            />
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="how">
          <SectionHead id="how" field="Procedure" code="4 steps, repeated monthly" title="Checkup, prescription, you do the work, re-check.">
            The same loop a good doctor runs. You stay in charge of your marketing and always know what to do next.
          </SectionHead>
          <ol className="grid gap-0 md:grid-cols-4">
            {SEQUENCE.map((s, i) => (
              <li key={s.name} className="relative border-l border-line pb-8 pl-6 last:pb-0 md:border-l-0 md:border-t md:pb-0 md:pl-0 md:pr-6 md:pt-6">
                <span
                  aria-hidden
                  className={cx(
                    "absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 md:-top-[5px] md:left-0",
                    i === 2 ? "border-scrub bg-scrub" : "border-scrub bg-paper",
                  )}
                />
                <Label className="mb-2">
                  Step {i + 1}
                  {i === 2 && <span className="text-scrub"> · your part</span>}
                </Label>
                <h3 className="font-display text-xl font-semibold tracking-tight">{s.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Specialists */}
        <section className="border-y border-line bg-card" aria-labelledby="specialists">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <SectionHead id="specialists" field="Specialists on duty" code="6 specialists + 1 strategist" title="Six specialists, one chart.">
              Each one examines a different part of how customers find and choose you. They all know your business profile and write to the same prescription board.
            </SectionHead>

            <div className="hidden grid-cols-[13rem_1fr_1fr] gap-6 border-b border-ink pb-2 md:grid">
              <Label>Specialist</Label>
              <Label>Examines</Label>
              <Label>Hands you</Label>
            </div>
            <ul className="divide-y divide-line">
              {SPECIALISTS.map((s) => (
                <li key={s.name} className="grid gap-1.5 py-5 md:grid-cols-[13rem_1fr_1fr] md:gap-6">
                  <h3 className="font-display text-lg font-semibold tracking-tight">{s.name}</h3>
                  <p className="text-[15px] text-ink-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3 md:hidden">Examines: </span>
                    {s.examines}
                  </p>
                  <p className="text-[15px] text-ink">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3 md:hidden">Hands you: </span>
                    {s.hands}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-4 rounded-lg border border-ink bg-ink p-5 text-white md:flex-row md:items-center md:gap-6 md:p-6">
              <MessageSquareText size={28} className="shrink-0 text-[#5fd0b4]" aria-hidden />
              <div className="flex-1">
                <h3 className="font-display text-lg font-semibold tracking-tight">Ask PULSE, the strategist</h3>
                <p className="mt-1 text-[15px] text-white/75">
                  A chat that has read your profile, your reports and your board. Ask what to do first this week, why a fix matters, or how to do a step on your
                  setup.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sample board */}
        <section className="chart-grid border-b border-line" aria-labelledby="sample">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <SectionHead id="sample" field="Sample prescription board" code="Example only" title="What a prescription looks like.">
              Three slips from a board for Lumen Aesthetics, a fictional clinic in Novena. Open one to see the steps.
            </SectionHead>
            <div className="grid items-start gap-4 lg:grid-cols-3">
              {SAMPLE_SLIPS.map((s, i) => (
                <RxSlip key={s.title} data={s} defaultOpen={i === 1} />
              ))}
            </div>
          </div>
        </section>

        {/* Why DIY */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="why">
          <SectionHead id="why" field="Why do it yourself" title="Agency-grade diagnosis, without the agency retainer.">
            Most of what a marketing retainer pays for is two things: knowing what to fix, and the hours to fix it. {BRAND.name} gives you the first. You put in the
            second, on your schedule.
          </SectionHead>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-lg border border-line bg-card">
              <div className="grid grid-cols-[1fr_1fr] border-b border-ink sm:grid-cols-[9rem_1fr_1fr]">
                <span className="hidden px-4 py-2.5 sm:block" />
                <Label className="px-4 py-2.5">Agency retainer</Label>
                <Label className="bg-mint px-4 py-2.5 text-scrub-dark">{BRAND.name}</Label>
              </div>
              {[
                ["Finding problems", "An account team audits when they have time", "Specialists run whenever you want, in minutes"],
                ["Deciding priority", "Their plan, their reporting", "Every slip ranked by urgency and impact"],
                ["Doing the work", "Their team, billed monthly", "You, with steps for your exact platform"],
                ["Checking it worked", "Monthly report", "Re-check dates on every slip"],
              ].map(([row, agency, rx]) => (
                <div key={row} className="grid grid-cols-[1fr_1fr] border-b border-line last:border-b-0 sm:grid-cols-[9rem_1fr_1fr]">
                  <div className="col-span-2 px-4 pt-3 font-semibold sm:col-span-1 sm:py-3 sm:text-[15px]">{row}</div>
                  <div className="px-4 pb-3 pt-1 text-sm text-ink-2 sm:py-3">{agency}</div>
                  <div className="bg-mint/50 px-4 pb-3 pt-1 text-sm text-ink sm:py-3">{rx}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-scrub/25 bg-mint p-6">
              <div>
                <Label className="mb-3 text-scrub-dark">Done for you</Label>
                <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight">Rather have PULSE Digital do it?</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
                  Some fixes are not worth your evening. {BRAND.parent} is the Singapore performance marketing agency that built {BRAND.name}. Send us any slip and we
                  will quote to do it for you. No obligation.
                </p>
              </div>
              <a
                href={BRAND.doneForYouUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-md border border-scrub bg-card px-4 py-2.5 text-sm font-semibold text-scrub hover:bg-scrub hover:text-white"
              >
                Message PULSE Digital on WhatsApp <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          </div>
        </section>

        {/* Regulated businesses */}
        <section className="border-y border-line bg-card" aria-labelledby="regulated">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <SectionHead id="regulated" field="Built for regulated businesses" title="Knows the rules clinics advertise under." className="mb-0">
              <p>
                Compliance Check reads your ads and pages against Singapore&apos;s healthcare advertising rules, including MOH&apos;s rules for licensed healthcare services
                and the SMC Ethical Code and Ethical Guidelines. It flags wording for review, explains why, and suggests safer alternatives.
              </p>
              <p className="mt-3">
                Every other specialist knows when your business is in a regulated category and keeps its suggestions inside those rules.
              </p>
              <p className="mt-4 text-sm text-ink-3">
                Compliance Check is a review aid, not legal advice. The final call sits with you and your professional adviser.
              </p>
            </SectionHead>

            <div className="rounded-lg border border-line bg-paper p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <Label>Ad copy under review</Label>
                <Badge tone="red">4 flags</Badge>
              </div>
              <p className="rounded-md border border-line bg-card p-4 text-[17px] leading-loose text-ink">
                {FLAGGED.map((f, i) =>
                  f.flag ? (
                    <mark key={i} className="rounded-sm bg-pulse/10 px-0.5 text-ink underline decoration-pulse decoration-wavy decoration-1 underline-offset-4">
                      {f.text}
                    </mark>
                  ) : (
                    <span key={i}>{f.text}</span>
                  ),
                )}
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {FLAGGED.filter((f) => f.flag).map((f) => (
                  <li key={f.flag} className="flex items-start gap-2 text-sm">
                    <Badge tone="amber" className="shrink-0">Review</Badge>
                    <span className="text-ink-2">
                      <span className="font-semibold text-ink">{f.flag}:</span> &ldquo;{f.text}&rdquo;
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-dashed border-line pt-4 text-sm text-ink-2">
                <Label className="mb-1.5">Suggested rewrite</Label>
                Pico laser treatment for pigmentation in Novena. Your doctor will assess your skin and explain expected results and downtime at consultation.
              </div>
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="fees">
          <SectionHead id="fees" field="Fees" code="SGD per month" title="Start free. Pay when you want every specialist.">
            Monthly plans, no contract. Every plan includes the prescription board.
          </SectionHead>
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.id} className={cx("flex flex-col p-5", p.id === "growth" ? "bg-mint" : "bg-card")}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold tracking-tight">{p.name}</h3>
                  {p.id === "growth" && <Badge tone="green">For ad spenders</Badge>}
                </div>
                <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
                  {sgd(p.priceMonthly)}
                  <span className="ml-1 text-sm font-normal text-ink-3">/month</span>
                </p>
                <p className="mt-2 flex-1 text-sm text-ink-2">{p.blurb}</p>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-3">{p.runsPerMonth} agent runs a month</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/pricing" variant="secondary">
              Compare plans <ArrowRight size={16} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/signup">Start free</ButtonLink>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-line bg-card" aria-labelledby="faq">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <SectionHead id="faq" field="Questions" title="Before you start." />
            <FaqList items={FAQ} />
            <div className="mt-12 flex flex-col items-start gap-4 rounded-lg border border-ink bg-ink p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight">See what your website is missing.</h3>
                <p className="mt-1 text-white/70">The checkup takes under a minute and needs no account.</p>
              </div>
              <Link
                href="/#checkup"
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-[15px] font-semibold text-ink hover:bg-mint focus-visible:outline-white"
              >
                Run the free checkup <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
