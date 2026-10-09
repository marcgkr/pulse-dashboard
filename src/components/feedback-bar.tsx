"use client";

import { useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { cx } from "./ui";

export type Verdict = "approve" | "reject" | "comment";
export type ItemFeedback = { verdict: Verdict; comment: string };

/**
 * Approve, comment on or reject one item in a report. Saved per report; the specialist reads it
 * before its next run. On the public sample (runId "sample") it works but saves nothing.
 */
export function FeedbackBar({
  runId,
  item,
  agentName,
  initial,
  onChange,
  placeholder = "e.g. Our customers are mostly landlords, not families, and we don't offer this service.",
}: {
  runId: string;
  item: string;
  agentName: string;
  initial?: ItemFeedback;
  onChange?: (f: ItemFeedback | null) => void;
  placeholder?: string;
}) {
  const sample = runId === "sample";
  const [saved, setSaved] = useState<ItemFeedback | null>(initial ?? null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(next: ItemFeedback | null) {
    setError("");
    if (!sample) {
      setBusy(true);
      try {
        const res = await fetch(`/api/runs/${runId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next ? { item, ...next } : { item, verdict: null }),
        });
        if (!res.ok) {
          setError(((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't save. Try again.");
          return false;
        }
      } catch {
        setError("That didn't save. Check your connection and try again.");
        return false;
      } finally {
        setBusy(false);
      }
    }
    setSaved(next);
    onChange?.(next);
    return true;
  }

  // Clicking the active verdict again clears it.
  async function choose(v: "approve" | "reject") {
    if (saved?.verdict === v) {
      if (await save(null)) {
        setDraft("");
        setOpen(false);
      }
      return;
    }
    if (await save({ verdict: v, comment: draft.trim() })) setOpen(v === "reject");
  }

  async function submitComment() {
    const comment = draft.trim();
    const verdict: Verdict = saved?.verdict === "approve" || saved?.verdict === "reject" ? saved.verdict : "comment";
    if (!comment && verdict === "comment") return setError("Write what's right or wrong first.");
    if (await save({ verdict, comment })) setOpen(false);
  }

  const status =
    saved?.verdict === "approve"
      ? `Approved. ${agentName} will do more like this.`
      : saved?.verdict === "reject"
        ? `Rejected. ${agentName} won't suggest this again.`
        : saved?.verdict === "comment"
          ? `Noted. ${agentName} will use your comment next time.`
          : "";

  const btn = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold ring-1 transition disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          aria-pressed={saved?.verdict === "approve"}
          onClick={() => choose("approve")}
          className={cx(btn, saved?.verdict === "approve" ? "bg-good text-white ring-good" : "bg-card text-ink ring-line hover:ring-good")}
        >
          <Check size={14} /> {saved?.verdict === "approve" ? "Approved" : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cx(btn, saved?.comment ? "bg-mint text-scrub-dark ring-scrub/30" : "bg-card text-ink ring-line hover:ring-ink-3")}
        >
          <MessageSquare size={14} /> Comment
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={saved?.verdict === "reject"}
          onClick={() => choose("reject")}
          className={cx(btn, saved?.verdict === "reject" ? "bg-pulse text-white ring-pulse" : "bg-card text-ink ring-line hover:ring-pulse")}
        >
          <X size={14} /> {saved?.verdict === "reject" ? "Rejected" : "Reject"}
        </button>
      </div>

      {(status || error) && !open && (
        <p role="status" className={cx("mt-2 text-right text-[13px]", error ? "text-pulse" : "text-ink-2")}>
          {error || status}
          {!error && saved?.comment && <span className="block text-ink">&ldquo;{saved.comment}&rdquo;</span>}
          {!error && sample && <span className="block">On the sample nothing is saved. In your account it is.</span>}
        </p>
      )}

      {open && (
        <div className="mt-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              {saved?.verdict === "reject" ? `Why doesn't this work for you? ${agentName} will remember.` : `What's accurate or wrong here? ${agentName} will remember.`}
            </span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={placeholder}
              className="w-full rounded-xl border border-line bg-card px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-scrub"
            />
          </label>
          {error && <p className="mt-1 text-[13px] text-pulse">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={submitComment} className="rounded-full bg-scrub px-4 py-2 text-[13px] font-semibold text-white hover:bg-scrub-dark disabled:opacity-50">
              Save comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A note on the whole report: what's accurate, what's wrong, what doesn't fit the business. */
export function ReportNotes({ runId, agentName, initial }: { runId: string; agentName: string; initial?: ItemFeedback }) {
  const sample = runId === "sample";
  const [saved, setSaved] = useState(initial?.comment ?? "");
  const [draft, setDraft] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    const comment = draft.trim();
    setMsg(null);
    if (!sample) {
      setBusy(true);
      try {
        const res = await fetch(`/api/runs/${runId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(comment ? { item: "", verdict: "comment", comment } : { item: "", verdict: null }),
        });
        if (!res.ok) {
          setMsg({ ok: false, text: ((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't save. Try again." });
          return;
        }
      } catch {
        setMsg({ ok: false, text: "That didn't save. Check your connection and try again." });
        return;
      } finally {
        setBusy(false);
      }
    }
    setSaved(comment);
    setMsg({
      ok: true,
      text: sample
        ? "On the sample nothing is saved. In your account the specialist remembers it."
        : comment
          ? `Saved. ${agentName} will use this on your next run.`
          : `Removed. ${agentName} won't use it any more.`,
    });
  }

  return (
    <div className="rounded-3xl bg-card p-5 ring-1 ring-line md:p-6">
      <label className="block">
        <span className="block font-display text-lg font-bold">Is anything here wrong, or not right for your business?</span>
        <span className="mt-1 block max-w-2xl text-[15px] leading-relaxed text-ink-2">
          Tell {agentName} what is accurate and what isn&apos;t. It remembers your notes for this business and uses them every time it runs.
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="e.g. We only serve the north of the city. We stopped offering the budget package in August."
          className="mt-3 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-scrub"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={cx("text-[13px]", msg && !msg.ok ? "text-pulse" : "text-ink-2")}>
          {msg?.text}
        </p>
        <button
          type="button"
          disabled={busy || draft.trim() === saved}
          onClick={save}
          className="rounded-full bg-scrub px-5 py-2.5 text-sm font-semibold text-white hover:bg-scrub-dark disabled:opacity-50"
        >
          {saved && !draft.trim() ? "Remove note" : "Save note"}
        </button>
      </div>
    </div>
  );
}
