import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PLAN_ROWS, planPrice, runsInPlainWords, type Plan } from "@/lib/config";
import { formatPrice, type Market } from "@/lib/markets";
import { agentColor } from "@/lib/agent-colors";
import { cx } from "./ui";

const SPECIALIST_NAMES: Record<string, string> = {
  site: "Site Doctor",
  keywords: "Keyword Lab",
  visibility: "AI Visibility",
  content: "Social Media Content",
  ads: "Ads Doctor",
  compliance: "Compliance Check",
};

/**
 * A plan card that spells out what the plan includes: who it's for, which specialists,
 * what the run allowance means, and a tick or cross for every row in PLAN_ROWS.
 */
export function PlanCard({
  plan,
  market,
  href,
  cta,
  highlight = false,
  badge,
}: {
  plan: Plan;
  market: Market;
  href: string;
  cta: string;
  highlight?: boolean;
  badge?: string;
}) {
  const price = planPrice(plan, market);
  const all = plan.specialists.length === Object.keys(SPECIALIST_NAMES).length;
  return (
    <div
      className={cx(
        "flex h-full flex-col rounded-[1.75rem] p-6 shadow-[var(--shadow-box)] md:p-7",
        highlight ? "bg-scrub text-white shadow-[0_24px_48px_-20px_rgb(91_61_245/0.6)]" : "bg-card ring-1 ring-line/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{plan.name}</h3>
        {badge && (
          <span className={cx("rounded-full px-3 py-1 text-xs font-bold", highlight ? "bg-white/20 text-white" : "bg-mint text-scrub-dark")}>{badge}</span>
        )}
      </div>
      <p className="mt-3 font-display text-4xl font-extrabold tracking-[-0.03em]">
        {price === 0 ? "Free" : formatPrice(market, price)}
        {price > 0 && <span className={cx("ml-1 text-base font-semibold", highlight ? "text-white/70" : "text-ink-3")}>/month</span>}
      </p>
      <p className={cx("mt-3 min-h-[3rem] text-[15px] leading-snug", highlight ? "text-white/85" : "text-ink-2")}>{plan.forWho}</p>

      <Link
        href={href}
        className={cx(
          "mt-5 inline-flex items-center justify-center rounded-full px-5 py-3 text-[15px] font-semibold transition hover:-translate-y-0.5 motion-reduce:transition-none",
          highlight ? "bg-white text-scrub-dark" : "bg-paper text-ink ring-1 ring-line hover:ring-ink-3",
        )}
      >
        {cta}
      </Link>

      {plan.exclusives && (
        <div className={cx("mt-5 rounded-2xl p-4", highlight ? "bg-white/15" : "bg-mint")}>
          <p className={cx("text-xs font-bold", highlight ? "text-white" : "text-scrub-dark")}>Only on {plan.name}</p>
          <ul className="mt-2 space-y-2">
            {plan.exclusives.map((x) => (
              <li key={x} className="flex gap-2 text-sm font-semibold leading-snug">
                <Check size={16} className={cx("mt-0.5 shrink-0", highlight ? "text-white" : "text-scrub")} aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cx("mt-6 border-t pt-5", highlight ? "border-white/20" : "border-line")}>
        <p className={cx("text-xs font-bold", highlight ? "text-white/70" : "text-ink-3")}>{all ? "All six specialists" : "Specialists"}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Specialists included">
          {plan.specialists.map((id) => (
            <li key={id} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink", agentColor(id).box)}>
              {SPECIALIST_NAMES[id]}
            </li>
          ))}
        </ul>
        <p className={cx("mt-4 text-sm font-semibold", highlight ? "text-white" : "text-ink")}>{runsInPlainWords(plan)}</p>
        <p className={cx("text-xs", highlight ? "text-white/70" : "text-ink-3")}>One report from any specialist counts as one.</p>

        <ul className="mt-4 space-y-2.5">
          {/* Included first, then what the plan doesn't have, so the ticks line up at the top. */}
          {[...PLAN_ROWS.slice(1)]
            .sort((x, y) => Number(x.value(plan) === false) - Number(y.value(plan) === false))
            .map((row) => {
              const v = row.value(plan);
              const on = v !== false;
              return (
                <li key={row.label} className={cx("flex gap-2.5 text-sm leading-snug", !on && (highlight ? "text-white/45" : "text-ink-3/70"))}>
                  {on ? (
                    <Check size={16} className={cx("mt-0.5 shrink-0", highlight ? "text-white" : "text-good")} aria-hidden />
                  ) : (
                    <Minus size={16} className="mt-0.5 shrink-0" aria-hidden />
                  )}
                  <span>
                    <span className="sr-only">{on ? "Included: " : "Not included: "}</span>
                    {row.label}
                    {typeof v === "string" && <span className={cx("font-semibold", highlight ? "text-white" : "text-ink")}>: {v}</span>}
                  </span>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
