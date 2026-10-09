"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, cx } from "./ui";

export type MemoryRow = {
  id: string;
  agentName: string;
  runId: string | null;
  item: string;
  verdict: "approve" | "reject" | "comment";
  comment: string;
  when: string;
};

const VERDICT: Record<MemoryRow["verdict"], { label: string; tone: "green" | "red" | "neutral" }> = {
  approve: { label: "Liked", tone: "green" },
  reject: { label: "Rejected", tone: "red" },
  comment: { label: "Comment", tone: "neutral" },
};

/** Settings > What your specialists remember. Each note can be forgotten. */
export function MemoryList({ rows }: { rows: MemoryRow[] }) {
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function forget(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setList((l) => l.filter((r) => r.id !== id));
    } catch {
      setError("That note wasn't removed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!list.length) {
    return (
      <p className="px-5 py-6 text-[15px] leading-relaxed text-ink-2 md:px-6">
        Nothing yet. Approve, comment on or reject ideas in any report, or leave a note at the bottom of a report, and the specialist will remember it here.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="border-b border-line px-5 py-2 text-sm text-pulse md:px-6">{error}</p>}
      <ul className="divide-y divide-line">
        {list.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{r.agentName}</span>
                <Badge tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Badge>
                <span className="text-[13px] text-ink-2">{r.when}</span>
              </div>
              <p className="mt-1 break-words text-[15px] leading-relaxed">
                {r.item ? <span className="font-semibold">{r.item}</span> : <span className="font-semibold">Whole report</span>}
                {r.comment && <span className="text-ink-2">: &ldquo;{r.comment}&rdquo;</span>}
              </p>
              {r.runId && (
                <Link href={`/app/runs/${r.runId}`} className="text-[13px] font-semibold text-scrub hover:text-scrub-dark">
                  Open the report
                </Link>
              )}
            </div>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => forget(r.id)}
              className={cx("shrink-0 self-start rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink-2 ring-1 ring-line hover:text-pulse hover:ring-pulse disabled:opacity-50")}
            >
              Forget this
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
