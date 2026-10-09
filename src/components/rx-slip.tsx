"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock, ExternalLink, MapPin, RotateCcw, Zap } from "lucide-react";
import { BRAND } from "@/lib/config";
import { agentColor } from "@/lib/agent-colors";
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
  status?: "todo" | "doing" | "done" | "skipped" | "superseded";
  /** Specialist id; sets the slip's colour. */
  agent?: string;
  agentName?: string;
};

const priorityTone = { urgent: "red", high: "red", medium: "amber", low: "neutral" } as const;
const priorityLabel = { urgent: "Urgent", high: "High priority", medium: "Medium", low: "Low" };
const effortLabel = { quick: "Under 30 min", "half-day": "A few hours", project: "1+ days" };

/**
 * A prescription slip: a pharmacy label in the colour of the specialist that wrote it.
 * Pass task-backed data (with `id`) to get status controls; without `id` it is read-only.
 */
export function RxSlip({ data, defaultOpen = false }: { data: SlipData; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState(data.status ?? "todo");
  const [saving, setSaving] = useState(false);
  const color = agentColor(data.agent);

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
  const showCategory = !(data.agentName && data.agentName.toLowerCase().startsWith((data.category || "").toLowerCase()));
  return (
    <article
      className={cx(
        "relative flex overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-box)] ring-1 ring-line/70 transition",
        done && "opacity-60",
      )}
    >
      {/* Coloured spine with the Rx mark, like the side of a pill box */}
      <div className={cx("flex w-12 shrink-0 flex-col items-center pt-4", color.box)} aria-hidden>
        <span className="select-none font-display text-2xl font-extrabold italic leading-none text-ink">℞</span>
      </div>
      <div className="min-w-0 flex-1 px-5 pb-5 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={priorityTone[data.priority]}>{priorityLabel[data.priority]}</Badge>
          {data.agentName && <Badge className={cx(color.soft, "text-ink ring-transparent")}>{data.agentName}</Badge>}
          {showCategory && data.category && <Badge>{data.category}</Badge>}
        </div>
        <h3 className={cx("font-display text-[19px] font-bold leading-snug tracking-[-0.01em]", done && "line-through decoration-2 decoration-good/70")}>
          {data.title}
        </h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{data.diagnosis}</p>

        {/* Dosage, as capsules */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold text-ink-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1">
            <Clock size={12} /> {effortLabel[data.effort]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1">
            <Zap size={12} /> {data.impact === "high" ? "Big impact" : data.impact === "medium" ? "Some impact" : "Small impact"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1">
            <RotateCcw size={12} /> Re-check in {data.recheck_days} days
          </span>
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
          <div className="mt-3 rounded-2xl bg-paper p-4">
            {data.where && (
              <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                <MapPin size={13} /> {data.where}
              </p>
            )}
            <ol className="space-y-2.5">
              {data.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-ink", color.box)}>{i + 1}</span>
                  <span className="whitespace-pre-wrap break-words">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {status === "superseded" && <Badge>Replaced by a newer checkup</Badge>}
          {data.id && status !== "superseded" && (
            <>
              {status !== "done" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => update("done")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Check size={15} /> Mark done
                </button>
              ) : (
                <button type="button" disabled={saving} onClick={() => update("todo")} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold ring-1 ring-line">
                  Undo
                </button>
              )}
              {status === "todo" && (
                <button type="button" disabled={saving} onClick={() => update("doing")} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold ring-1 ring-line hover:ring-ink-3">
                  I&apos;m on it
                </button>
              )}
              {status === "doing" && <Badge tone="amber">In progress</Badge>}
              {status !== "skipped" && status !== "done" && (
                <button type="button" disabled={saving} onClick={() => update("skipped")} className="px-2 py-2 text-sm text-ink-3 hover:text-ink">
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
    </article>
  );
}
