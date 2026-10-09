import Link from "next/link";
import { BRAND } from "@/lib/config";
import { cx, scoreColor } from "./ui";

/** Wordmark: an ECG blip that turns into the Rx tail. */
export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cx("inline-flex items-center gap-2", className)} aria-label={`${BRAND.name} home`}>
      <svg width="30" height="22" viewBox="0 0 30 22" fill="none" aria-hidden>
        <path d="M1 13h7l2.5-7 4 13 3-9 1.8 3H29" stroke="var(--color-pulse)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cx("font-display text-lg font-bold tracking-tight", light ? "text-white" : "text-ink")}>
        Marketing<span className="text-pulse">Rx</span>
      </span>
    </Link>
  );
}

/** Animated ECG trace, used in the landing hero and while agents work. */
export function EcgTrace({ className, flat = false }: { className?: string; flat?: boolean }) {
  const d = flat
    ? "M0 40 H600"
    : "M0 40 H90 l10 -6 l8 6 H160 l8 -30 l10 62 l9 -46 l6 14 H300 l8 -6 l8 6 H380 l8 -30 l10 62 l9 -46 l6 14 H520 l8 -6 l8 6 H600";
  return (
    <svg viewBox="0 0 600 80" preserveAspectRatio="none" className={cx("h-16 w-full", className)} aria-hidden>
      <path d={d} fill="none" stroke="var(--color-pulse)" strokeWidth="2" strokeLinejoin="round" className="ecg-trace" style={{ ["--len" as string]: 1400 }} />
    </svg>
  );
}

/** Monitor-style score readout with a ring. */
export function ScoreDial({ score, size = 132, label }: { score: number | null; size?: number; label?: string }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-mint)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-4xl font-extrabold tabular-nums tracking-[-0.03em]" style={{ color }}>
          {score ?? "--"}
        </div>
        {label && <div className="text-[11px] font-semibold text-ink-3">{label}</div>}
      </div>
    </div>
  );
}

/** Small horizontal meter for sub-scores. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink-2">{label}</span>
        <span className="font-bold tabular-nums" style={{ color: scoreColor(value) }}>
          {value ?? "--"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-mint">
        <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: scoreColor(value) }} />
      </div>
    </div>
  );
}
