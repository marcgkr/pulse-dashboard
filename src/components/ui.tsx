import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btn: Record<BtnVariant, string> = {
  primary: "bg-scrub text-white hover:bg-scrub-dark",
  secondary: "bg-card text-ink border border-line hover:border-ink-3",
  ghost: "text-ink-2 hover:bg-mint",
  danger: "bg-pulse text-white hover:opacity-90",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button className={cx(btnBase, btn[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(btnBase, btn[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-lg border border-line bg-card", className)} {...props} />;
}

/** Small uppercase mono label, used like a chart field label. */
export function Label({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-3/70 focus:border-scrub focus:outline-none focus:ring-2 focus:ring-scrub/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputCls, "pr-8", className)} {...props} />;
}

type Tone = "neutral" | "green" | "red" | "amber" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-paper text-ink-2 border-line",
  green: "bg-mint text-scrub-dark border-scrub/20",
  red: "bg-pulse/10 text-pulse border-pulse/25",
  amber: "bg-amber/10 text-[#8a5410] border-amber/30",
  ink: "bg-ink text-white border-ink",
};
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider", tones[tone], className)}
      {...props}
    />
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <Label className="mb-2">{eyebrow}</Label>}
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {children && <div className="mt-2 text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-card/60 px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
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
  if (score >= 75) return "var(--color-scrub)";
  if (score >= 50) return "var(--color-amber)";
  return "var(--color-pulse)";
}
