import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btn: Record<BtnVariant, string> = {
  primary: "bg-scrub text-white shadow-[0_8px_20px_-8px_rgb(91_61_245/0.7)] hover:bg-scrub-dark hover:-translate-y-0.5",
  secondary: "bg-card text-ink ring-1 ring-line hover:ring-ink-3 hover:-translate-y-0.5",
  ghost: "text-ink-2 hover:bg-mint",
  danger: "bg-pulse text-white hover:opacity-90",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button className={cx(btnBase, btn[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(btnBase, btn[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-3xl bg-card shadow-[var(--shadow-box)] ring-1 ring-line/70", className)} {...props} />;
}

/** Small label inside a card or form. For a report section heading use ReportSection. */
export function Label({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("text-[13px] font-semibold text-ink-2", className)} {...props} />;
}

/**
 * One section of a specialist report: a heading people can scan for, an optional line on what the
 * section is for, and optional actions (copy buttons) on the right. The marker takes the
 * specialist's colour from --rx-accent, set where the report is rendered.
 */
export function ReportSection({
  title,
  hint,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2.5 font-display text-xl font-bold leading-tight tracking-[-0.015em] text-ink md:text-[22px]">
            <span aria-hidden className="h-5 w-1.5 shrink-0 rounded-full ring-1 ring-ink/10" style={{ background: "var(--rx-accent, var(--color-scrub))" }} />
            {title}
          </h3>
          {hint && <p className="mt-1 max-w-2xl pl-4 text-sm leading-relaxed text-ink-2">{hint}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-3/70 transition focus:border-scrub focus:outline-none focus:ring-4 focus:ring-scrub/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "min-h-24", className)} {...props} />;
}

// Native selects render differently across browsers (Safari pads and centres them, cutting text
// off). Draw our own chevron so every select lays out the same.
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234a4870' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Select({ className, style, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(inputCls, "min-w-0 appearance-none truncate bg-[length:16px] bg-[position:right_0.9rem_center] bg-no-repeat pr-10 text-left", className)}
      style={{ backgroundImage: CHEVRON, ...style }}
      {...props}
    />
  );
}

type Tone = "neutral" | "green" | "red" | "amber" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-paper text-ink-2 ring-line",
  green: "bg-good/10 text-good ring-good/25",
  red: "bg-pulse/10 text-pulse ring-pulse/25",
  amber: "bg-amber/15 text-[#94600a] ring-amber/30",
  ink: "bg-ink text-white ring-ink",
};
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", tones[tone], className)}
      {...props}
    />
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <Label className="mb-2 text-scrub">{eyebrow}</Label>}
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">{title}</h1>
        {children && <div className="mt-3 text-[17px] leading-relaxed text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line bg-card/60 px-6 py-12 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function scoreTone(score: number | null | undefined): Tone {
  if (score == null) return "neutral";
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--color-ink-3)";
  if (score >= 75) return "var(--color-good)";
  if (score >= 50) return "var(--color-amber)";
  return "var(--color-pulse)";
}
