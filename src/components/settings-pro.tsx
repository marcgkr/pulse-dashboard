"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, cx } from "./ui";

/** Settings > Your businesses (Pro): switch, add, remove. */
export function BusinessList({
  businesses,
  currentId,
  max,
}: {
  businesses: { id: string; name: string; website: string; primary: boolean }[];
  currentId: string;
  max: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function open(id: string) {
    setBusy(id);
    const res = await fetch("/api/workspace/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) window.location.assign("/app");
    else setBusy(null);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name}? Its reports, prescriptions and connected accounts are deleted. This can't be undone.`)) return;
    setBusy(id);
    setError("");
    const res = await fetch(`/api/workspace?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error || "That business wasn't removed. Try again.");
    router.refresh();
  }

  return (
    <div>
      {error && <p className="border-b border-line px-5 py-2 text-sm text-pulse md:px-6">{error}</p>}
      <ul className="divide-y divide-line">
        {businesses.map((b) => (
          <li key={b.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.name}</span>
                {b.id === currentId && <Badge tone="green">Open now</Badge>}
                {b.primary && <Badge>Holds your plan</Badge>}
              </div>
              {b.website && <p className="truncate text-sm text-ink-2">{b.website}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              {b.id !== currentId && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => open(b.id)}
                  className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink ring-1 ring-line hover:ring-ink-3 disabled:opacity-50"
                >
                  Open
                </button>
              )}
              {!b.primary && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => remove(b.id, b.name)}
                  className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink-2 ring-1 ring-line hover:text-pulse hover:ring-pulse disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-5 py-4 md:px-6">
        {businesses.length < max ? (
          <Link href="/onboarding?add=1" className="inline-flex rounded-full bg-scrub px-5 py-2.5 text-sm font-semibold text-white hover:bg-scrub-dark">
            Add a business or location
          </Link>
        ) : (
          <p className="text-sm text-ink-2">Your plan covers {max} businesses. Remove one to add another.</p>
        )}
      </div>
    </div>
  );
}

/** Settings > Autopilot (Pro): on or off for the open business. */
export function AutopilotToggle({ on, businessName }: { on: boolean; businessName: string }) {
  const router = useRouter();
  const [value, setValue] = useState(on);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !value;
    const res = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autopilot: next }) });
    setBusy(false);
    if (res.ok) {
      setValue(next);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
      <div className="max-w-2xl">
        <p className="font-semibold">Autopilot for {businessName}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
          Site Doctor re-checks your website every week. AI Visibility re-asks your last set of questions every month, once you&apos;ve run it yourself. New
          findings land on your prescription board and your Pulse Score updates. Each re-check uses one report from your allowance.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={busy}
        onClick={toggle}
        className={cx(
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:opacity-50",
          value ? "bg-scrub" : "bg-line",
        )}
      >
        <span className="sr-only">Autopilot</span>
        <span className={cx("inline-block h-6 w-6 rounded-full bg-white shadow transition", value ? "translate-x-7" : "translate-x-1")} />
      </button>
    </div>
  );
}
