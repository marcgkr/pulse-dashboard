import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cx } from "./ui";

export type SetupStep = { id: string; label: string; why: string; href: string; done: boolean; action: string };

/** The few things that make every report better, in order. Shown on the dashboard until they're all done. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section aria-labelledby="setup-title" className="rounded-3xl bg-card p-5 shadow-[var(--shadow-box)] ring-1 ring-line/70 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="setup-title" className="font-display text-xl font-bold">
            Get set up
          </h2>
          <p className="text-sm text-ink-2">Each step makes every report more about your business and less about businesses like it.</p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-ink-2">
          {done} of {steps.length} done
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mint" aria-hidden>
        <div className="h-full rounded-full bg-scrub transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              href={s.href}
              className={cx(
                "group flex items-start gap-3 rounded-2xl px-3.5 py-3 ring-1 transition",
                s.done ? "ring-transparent" : s.id === next.id ? "bg-mint ring-scrub/30 hover:ring-scrub" : "ring-line hover:ring-ink-3",
              )}
            >
              <span
                className={cx(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                  s.done ? "bg-good text-white" : "ring-2 ring-inset ring-line",
                )}
                aria-hidden
              >
                {s.done && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block text-[15px] font-semibold leading-snug", s.done && "text-ink-3 line-through decoration-ink-3/40")}>{s.label}</span>
                {!s.done && <span className="mt-0.5 block text-sm leading-snug text-ink-2">{s.why}</span>}
              </span>
              {!s.done && (
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-scrub">
                  {s.action} <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              )}
              <span className="sr-only">{s.done ? "Done" : "Not done yet"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
