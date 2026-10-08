"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock, ExternalLink, MapPin, RotateCcw } from "lucide-react";
import { BRAND } from "@/lib/config";
import { Badge, cx } from "./ui";

export type SlipData = {
  id?: string;
  title: string;
  diagnosis: string;
  steps: string[];
  where: string;
  priority: "urgent" | "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  effort: "quick" | "half-day" | "project";
  category: string;
  recheck_days: number;
  status?: "todo" | "doing" | "done" | "skipped";
  agentName?: string;
};

const priorityTone = { urgent: "red", high: "red", medium: "amber", low: "neutral" } as const;
const effortLabel = { quick: "Under 30 min", "half-day": "A few hours", project: "1+ days" };

/**
 * A prescription slip. Pass taskId-backed data to get status controls.
 * Without `id` it renders read-only (used inside reports before tasks exist).
 */
export function RxSlip({ data, defaultOpen = false }: { data: SlipData; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState(data.status ?? "todo");
  const [saving, setSaving] = useState(false);

  async function update(next: NonNullable<SlipData["status"]>) {
    if (!data.id) return;
    setSaving(true);
    const prev = status;
    setStatus(next);
    const res = await fetch(`/api/tasks/${data.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) setStatus(prev);
    setSaving(false);
  }

  const done = status === "done";
  return (
    <article className={cx("relative overflow-hidden rounded-md border bg-mint/60", done ? "border-scrub/30 opacity-70" : "border-scrub/20")}>
      <div className="rx-perf h-2 bg-scrub/15" aria-hidden />
      <div className="px-4 pb-4 pt-3 md:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 select-none font-display text-2xl font-bold italic leading-none text-scrub" aria-hidden>
            ℞
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={priorityTone[data.priority]}>{data.priority}</Badge>
              {!(data.agentName && data.agentName.toLowerCase().startsWith((data.category || "").toLowerCase())) && <Badge>{data.category || "General"}</Badge>}
              {data.agentName && <Badge tone="ink">{data.agentName}</Badge>}
            </div>
            <h3 className={cx("font-display text-[17px] font-semibold leading-snug", done && "line-through decoration-scrub/60")}>{data.title}</h3>
            <p className="mt-1 text-sm text-ink-2">{data.diagnosis}</p>

            {/* Dosage line */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-dashed border-scrub/25 pt-2 font-mono text-[11px] uppercase tracking-wider text-ink-2">
              <span className="inline-flex items-center gap-1"><Clock size={12} /> Take: {effortLabel[data.effort]}</span>
              <span>Impact: {data.impact}</span>
              <span className="inline-flex items-center gap-1"><RotateCcw size={12} /> Re-check: {data.recheck_days}d</span>
            </div>

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-scrub hover:underline"
              aria-expanded={open}
            >
              {open ? "Hide steps" : `How to do it (${data.steps.length} steps)`}
              <ChevronDown size={16} className={cx("transition", open && "rotate-180")} />
            </button>

            {open && (
              <div className="mt-3 rounded border border-scrub/15 bg-white/80 p-4">
                {data.where && (
                  <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-xs text-ink-2">
                    <MapPin size={13} /> {data.where}
                  </p>
                )}
                <ol className="space-y-2">
                  {data.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-scrub font-mono text-[11px] text-white">{i + 1}</span>
                      <span className="whitespace-pre-wrap break-words">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {data.id && (
                <>
                  {status !== "done" ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => update("done")}
                      className="inline-flex items-center gap-1.5 rounded-md bg-scrub px-3 py-1.5 text-sm font-semibold text-white hover:bg-scrub-dark disabled:opacity-50"
                    >
                      <Check size={15} /> Mark done
                    </button>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => update("todo")} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold">
                      Undo
                    </button>
                  )}
                  {status === "todo" && (
                    <button type="button" disabled={saving} onClick={() => update("doing")} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold">
                      I&apos;m on it
                    </button>
                  )}
                  {status === "doing" && <Badge tone="amber">In progress</Badge>}
                  {status !== "skipped" && status !== "done" && (
                    <button type="button" disabled={saving} onClick={() => update("skipped")} className="px-2 py-1.5 text-sm text-ink-3 hover:text-ink">
                      Not relevant
                    </button>
                  )}
                </>
              )}
              <a
                href={BRAND.doneForYouUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-scrub"
              >
                Rather have PULSE do it? <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
