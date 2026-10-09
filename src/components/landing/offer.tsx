import { Check, ClipboardCopy, Clock, Mail, ShieldCheck, Timer } from "lucide-react";
import { BRAND } from "@/lib/config";
import { cx } from "../ui";
import { RxTag } from "./rx-tag";


/** The three effort and time promises, as capsules (same shape as the dosage capsules on a slip). */
export function TimeChips({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const items = [
    { icon: Timer, text: "First fixes in about a minute" },
    { icon: Clock, text: "Most fixes take under 30 minutes" },
    { icon: ClipboardCopy, text: "Exact clicks and copy to paste" },
  ];
  return (
    <ul className={cx("flex flex-wrap gap-2", className)}>
      {items.map(({ icon: Icon, text }) => (
        <li
          key={text}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold md:text-sm",
            tone === "light" ? "bg-white/80 text-ink ring-1 ring-ink/5" : "bg-white/10 text-white ring-1 ring-white/15",
          )}
        >
          <Icon size={15} className={tone === "light" ? "text-scrub" : "text-white/80"} aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** BRAND.guarantee as a sealed label. Renders nothing when the guarantee is switched off. */
export function GuaranteeBlock({ className }: { className?: string }) {
  const g = BRAND.guarantee;
  if (!g) return null;
  return (
    <aside
      aria-label={g.title}
      className={cx("flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-box)] ring-1 ring-line/70 sm:flex-row sm:items-center sm:gap-6 md:p-6", className)}
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-spearmint text-ink shadow-[inset_0_0_0_4px_rgb(255_255_255/0.55)]" aria-hidden>
        <ShieldCheck size={30} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-extrabold tracking-[-0.02em] md:text-2xl">{g.title}</p>
        <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-ink-2">{g.body}</p>
      </div>
    </aside>
  );
}

/** Primary done-for-you button. */
export function StrategyCallButton({
  className,
  label = "Book a free strategy call",
  tone = "ink",
  size = "md",
}: {
  className?: string;
  label?: string;
  tone?: "ink" | "white" | "outline";
  size?: "md" | "sm";
}) {
  return (
    <a
      href={BRAND.doneForYouUrl}
      className={cx(
        "inline-flex items-center gap-2 rounded-full font-semibold transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        size === "md" ? "w-fit px-6 py-3.5 text-[15px]" : "justify-center px-3 py-3 text-center text-sm",
        tone === "ink" && "bg-ink text-white",
        tone === "white" && "bg-white text-ink focus-visible:outline-white",
        tone === "outline" && "text-white ring-1 ring-white/30 hover:ring-white focus-visible:outline-white",
        className,
      )}
    >
      {label} {size === "md" && <Mail size={15} aria-hidden />}
      <span className="sr-only">(opens an email to {BRAND.contactEmail})</span>
    </a>
  );
}

/**
 * Everything PULSE Digital does for done-for-you clients, grouped (BRAND.doneForYouServices).
 * "full" shows every item; "compact" shows each group as one line, for small cards.
 */
export function DoneForYouServices({ className, variant = "full" }: { className?: string; variant?: "full" | "compact" }) {
  const groups = BRAND.doneForYouServices;
  if (variant === "compact")
    return (
      <dl className={cx("space-y-3", className)}>
        {groups.map((g) => (
          <div key={g.group}>
            <dt className="text-[12px] font-bold text-spearmint">{g.group}</dt>
            <dd className="mt-0.5 text-sm leading-snug text-white/85">{g.items.join(" · ")}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <div className={cx("grid gap-2.5 sm:grid-cols-2", className)}>
      {groups.map((g) => (
        <section key={g.group} aria-label={g.group} className="rounded-2xl bg-white/70 px-4 py-4">
          <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">{g.group}</h3>
          <ul className="mt-2 space-y-1.5">
            {g.items.map((item) => (
              <li key={item} className="flex gap-2 text-[14px] leading-snug text-ink">
                <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The done-for-you offer with the founder's note beside it. The note is hidden when
 * BRAND.founderNote is empty.
 */
export function DoneForYou() {
  const note = BRAND.founderNote?.trim();
  return (
    <section id="done-for-you" aria-labelledby="dfy-title" className="scroll-mt-16 px-3 md:px-4">
      <div className={cx("mx-auto grid max-w-[90rem] gap-3 md:gap-4", note && "lg:grid-cols-[1.35fr_1fr]")}>
        <div className="flex flex-col rounded-[2rem] bg-sun px-5 py-12 md:rounded-[2.75rem] md:px-12 md:py-16">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-white">
            <RxTag light className="h-5 px-1.5 text-[11px]" /> Done for you
          </p>
          <h2 id="dfy-title" className="mt-5 max-w-2xl font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl md:text-[3.5rem]">
            Rather have {BRAND.parent} do it for you?
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink/80">
            {BRAND.parent} is the performance agency behind {BRAND.name}. Hand us your board and we do the work, the same way we do it for our agency clients.
          </p>
          <DoneForYouServices className="mt-7" />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <StrategyCallButton />
            <p className="text-sm text-ink/70">
              Pricing is custom, based on your ad spend. Or email{" "}
              <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-ink underline underline-offset-4">
                {BRAND.contactEmail}
              </a>
              .
            </p>
          </div>
        </div>

        {note && (
          <figure className="flex flex-col justify-between rounded-[2rem] bg-card px-5 py-10 shadow-[var(--shadow-box)] md:rounded-[2.75rem] md:px-10 md:py-14">
            <div>
              <p className="text-[13px] font-semibold text-ink-3">Why we built it</p>
              <blockquote className="mt-4 font-display text-xl font-semibold leading-snug tracking-[-0.015em] text-ink xl:text-[1.4rem]">
                &ldquo;{note}&rdquo;
              </blockquote>
            </div>
            <figcaption className="mt-8 border-t border-line pt-5">
              <p className="font-semibold text-ink">Marcus, founder of {BRAND.parent}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                {BRAND.parent} is a Singapore performance agency that runs paid ads, SEO and AI search for clinics, law firms, retailers and service businesses.{" "}
                <a href={BRAND.parentUrl} target="_blank" rel="noreferrer" className="font-semibold text-scrub underline underline-offset-4">
                  Visit {BRAND.parent}
                </a>
              </p>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
