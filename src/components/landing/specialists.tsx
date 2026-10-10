import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import type { Market } from "@/lib/markets";
import { agentColor } from "@/lib/agent-colors";
import { cx } from "../ui";
import { PointerDepth, Reveal } from "../motion";
import { RxTag } from "./rx-tag";

/**
 * Sample report page for one specialist. Site Doctor is the default tab at /sample, and the
 * renovation company is the default business, so neither needs a parameter.
 */
export function sampleHref(agent: string, business?: string): string {
  const path = agent === "site" ? "/sample" : `/sample/${agent}`;
  return business && business !== "renovation" ? `${path}?business=${business}` : path;
}

type Specialist = { agent: string; checks: string; hands: string[] };

// The value stack: what each specialist looks at, and the finished work it hands over.
function specialists(m: Market): Specialist[] {
  return [
    {
      agent: "site",
      checks: "Your website: speed, mobile layout, SEO basics, contact options and tracking tags.",
      hands: [
        "A ranked fix list with steps for your site builder",
        "A rewritten homepage title, meta description and headline to paste",
        "FAQ answers drafted for your service pages",
      ],
    },
    {
      agent: "keywords",
      checks: `What people in ${m.inPhrase} type into Google when they need what you sell.`,
      hands: ["Keyword groups sorted by what the searcher wants", "The page on your site that should rank for each group", "Briefs for the pages you are missing"],
    },
    {
      agent: "visibility",
      checks: "Whether ChatGPT, Perplexity and Google's AI answers mention you or a competitor.",
      hands: ["The questions AI assistants name you for, and who they name instead", "The sites those answers quote", "FAQ and schema fixes that give assistants something to quote"],
    },
    {
      agent: "content",
      checks: "Your services, offers and the way your business talks.",
      hands: ["Post ideas with the opening hook written word for word", "Captions and hashtags to paste", "A two-week posting calendar"],
    },
    {
      agent: "ads",
      checks: "Your Google, Meta and ChatGPT ads results, from an export, or a live connection for Google and Meta.",
      hands: ["The campaigns and ad sets to pause, by name", "Negative keywords to add", "New headlines and ad copy to test"],
    },
    {
      agent: "compliance",
      checks: "Your ads and pages, against your country's advertising standards and the stricter rules for regulated trades.",
      hands: [`Lines flagged against the rules in ${m.inPhrase}`, "Why each line is a risk", "A safer rewrite to paste"],
    },
  ];
}

// Each box leans a little and stands at its own height, like packs on a pharmacy shelf.
const TILT = ["lg:-rotate-2", "lg:rotate-[1.25deg]", "lg:-rotate-1", "lg:rotate-1", "lg:-rotate-[1.5deg]", "lg:rotate-2"];
const HEIGHT = ["lg:min-h-[31rem]", "lg:min-h-[28rem]", "lg:min-h-[30rem]", "lg:min-h-[29rem]", "lg:min-h-[31.5rem]", "lg:min-h-[27.5rem]"];
const MOBILE_TILT = ["-rotate-1", "rotate-1"];

function Box({ s, i }: { s: Specialist; i: number }) {
  const c = agentColor(s.agent);
  // Split the name so it stacks like print on a pack: "Site / Doctor".
  const [first, ...rest] = c.label.split(" ");
  return (
    <article
      className={cx(
        "relative flex flex-col overflow-hidden rounded-[var(--radius-box)] p-5 shadow-[var(--shadow-box)] md:p-6",
        "transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        c.box,
        MOBILE_TILT[i % 2],
        TILT[i],
        HEIGHT[i],
      )}
    >
      <RxTag className="self-start" />
      <h3 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[0.88] tracking-[-0.04em] text-ink md:text-5xl">
        {first}
        {rest.length > 0 && (
          <>
            <br />
            {rest.join(" ")}
          </>
        )}
      </h3>
      <p className="mt-4 text-[15px] leading-snug text-ink/75">
        <span className="sr-only">Checks: </span>
        {s.checks}
      </p>
      {/* The white label on the pack: what it hands you */}
      <div className="mt-auto pt-5">
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-[13px] font-bold text-ink">Hands you</p>
          <ul className="mt-2 space-y-1.5">
            {s.hands.map((h) => (
              <li key={h} className="flex gap-2 text-[15px] leading-snug text-ink-2">
                <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ink" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
          <Link
            href={sampleHref(s.agent)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-scrub-dark underline-offset-4 hover:underline"
          >
            See it in the sample report <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** The signature: six specialists as colour-blocked pill boxes on two shelves, plus Ask PULSE. */
export function SpecialistShelf({ market }: { market: Market }) {
  const list = specialists(market);
  return (
    <div>
      <Reveal className="isolate grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-end lg:gap-x-10 lg:gap-y-8 lg:px-8">
        {list.map((s, i) => (
          <Fragment key={s.agent}>
            <Box s={s} i={i} />
            {/* The shelf under each row of three (desktop only) */}
            {i % 3 === 2 && (
              <div
                aria-hidden
                className="relative z-[-1] -mx-8 -mt-[3.75rem] hidden h-8 rounded-full border-b-[6px] border-line bg-card shadow-[0_24px_36px_-18px_rgb(23_21_59/0.45)] lg:col-span-3 lg:block"
              />
            )}
          </Fragment>
        ))}
      </Reveal>

      <div className="mt-10 flex flex-col gap-5 rounded-[1.75rem] bg-ink p-6 text-white shadow-[var(--shadow-box)] md:flex-row md:items-center md:gap-8 md:p-8 lg:mt-14">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pulse text-white">
          <MessageCircle size={26} aria-hidden />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Ask PULSE, the strategist</h3>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/75">
            A chat that has read your profile, your reports and your board. Ask what to do first this week, why a fix matters, or how to do a step on your setup.
          </p>
        </div>
        <span className="hidden md:block">
          <RxTag light />
        </span>
      </div>
    </div>
  );
}

// depth: how far each pack drifts with the pointer (the front pack moves most).
const HERO_PACKS: { agent: string; hands: string; className: string; delay: number; depth: number }[] = [
  { agent: "ads", hands: "What to pause, what to scale", className: "left-0 top-16 -rotate-[14deg]", delay: 380, depth: 0.45 },
  { agent: "visibility", hands: "Questions you are missing from", className: "right-0 top-6 rotate-[9deg]", delay: 460, depth: 0.3 },
  { agent: "site", hands: "A fix list for your site builder", className: "left-1/2 top-24 -ml-[6.5rem] -rotate-[3deg]", delay: 540, depth: 0.8 },
];

/** Hero product shot: three specialist packs leaning together, with a pack sticker. Decorative. */
export function HeroPacks() {
  return (
    <PointerDepth className="relative h-[25rem] w-[24rem] shrink-0">
      {HERO_PACKS.map((p) => {
        const c = agentColor(p.agent);
        const [first, ...rest] = c.label.split(" ");
        return (
          <div key={p.agent} aria-hidden className={cx("absolute", p.className)}>
            <div data-depth={p.depth}>
              <div
                className={cx("rise flex h-[17rem] w-[13rem] flex-col rounded-[1.5rem] p-4 shadow-[var(--shadow-lift)]", c.box)}
                style={{ animationDelay: `${p.delay}ms` }}
              >
                <RxTag className="self-start" />
                <p className="mt-4 font-display text-[2.1rem] font-extrabold leading-[0.88] tracking-[-0.04em] text-ink">
                  {first}
                  <br />
                  {rest.join(" ")}
                </p>
                <div className="mt-auto rounded-xl bg-white/85 px-3 py-2.5">
                  <p className="text-[11px] font-bold text-ink">Hands you</p>
                  <p className="text-[13px] leading-snug text-ink-2">{p.hands}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div aria-hidden className="absolute -right-6 bottom-6 rotate-[10deg]" data-depth="1">
        <div
          className="rise grid h-32 w-32 place-items-center rounded-full bg-sun text-center shadow-[var(--shadow-box)]"
          style={{ animationDelay: "680ms" }}
        >
          <span className="font-display text-lg font-extrabold leading-[1.05] tracking-[-0.02em]">
            Free
            <br />
            checkup.
            <br />
            <span className="text-sm font-bold">No card.</span>
          </span>
        </div>
      </div>
    </PointerDepth>
  );
}
