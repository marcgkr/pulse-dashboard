import { Fragment } from "react";
import { MessageCircle } from "lucide-react";
import type { Market } from "@/lib/markets";
import { agentColor } from "@/lib/agent-colors";
import { cx } from "../ui";
import { RxTag } from "./rx-tag";

type Specialist = { agent: string; checks: string; hands: string };

function specialists(m: Market): Specialist[] {
  return [
    {
      agent: "site",
      checks: "Your website: speed, mobile layout, SEO basics, contact options and tracking tags.",
      hands: "A fix list with steps for your site builder, plus a better title, headline and FAQ to paste in.",
    },
    {
      agent: "keywords",
      checks: `What people in ${m.inPhrase} type into Google when they need what you sell.`,
      hands: "Keyword groups sorted by intent, and which page on your site should target each one.",
    },
    {
      agent: "visibility",
      checks: "Whether ChatGPT, Perplexity and Google's AI answers mention you or a competitor.",
      hands: "The questions you are missing from, and content that gives AI assistants something to quote.",
    },
    {
      agent: "content",
      checks: "Your services, offers and the way your business talks.",
      hands: "Social posts and captions written for your business, ready to edit and schedule.",
    },
    {
      agent: "ads",
      checks: "Your Google and Meta ads results, from an export or a live connection.",
      hands: "What to pause, what to give more budget, and new ad copy to test.",
    },
    {
      agent: "compliance",
      checks: "Ad and page copy for clinics and other regulated businesses.",
      hands: `Phrases flagged for review against the rules that apply in ${m.inPhrase}, with safer wording.`,
    },
  ];
}

// Each box leans a little and stands at its own height, like packs on a pharmacy shelf.
const TILT = ["lg:-rotate-2", "lg:rotate-[1.25deg]", "lg:-rotate-1", "lg:rotate-1", "lg:-rotate-[1.5deg]", "lg:rotate-2"];
const HEIGHT = ["lg:min-h-[25rem]", "lg:min-h-[22rem]", "lg:min-h-[24rem]", "lg:min-h-[23rem]", "lg:min-h-[25.5rem]", "lg:min-h-[21.5rem]"];
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
          <p className="mt-1 text-[15px] leading-snug text-ink-2">{s.hands}</p>
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
      <div className="isolate grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-end lg:gap-x-10 lg:gap-y-8 lg:px-8">
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
      </div>

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

const HERO_PACKS: { agent: string; hands: string; className: string; delay: number }[] = [
  { agent: "ads", hands: "What to pause, what to scale", className: "left-0 top-16 -rotate-[14deg]", delay: 380 },
  { agent: "visibility", hands: "Questions you are missing from", className: "right-0 top-6 rotate-[9deg]", delay: 460 },
  { agent: "site", hands: "A fix list for your site builder", className: "left-1/2 top-24 -ml-[6.5rem] -rotate-[3deg]", delay: 540 },
];

/** Hero product shot: three specialist packs leaning together, with a pack sticker. Decorative. */
export function HeroPacks() {
  return (
    <div aria-hidden className="relative h-[25rem] w-[24rem] shrink-0">
      {HERO_PACKS.map((p) => {
        const c = agentColor(p.agent);
        const [first, ...rest] = c.label.split(" ");
        return (
          <div key={p.agent} className={cx("absolute", p.className)}>
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
        );
      })}
      <div className="absolute -right-6 bottom-6 rotate-[10deg]">
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
    </div>
  );
}
