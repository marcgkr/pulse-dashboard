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
  extra,
  included,
  most,
  outletPrice,
  canBuy,
  contact,
}: {
  businesses: { id: string; name: string; website: string; primary: boolean }[];
  currentId: string;
  /** Outlets this account can run now: the included one plus extras paid for. */
  max: number;
  extra: number;
  /** Outlets the plan includes, and the most it allows with extras. */
  included: number;
  most: number;
  /** e.g. "S$10" */
  outletPrice: string;
  /** Has a paid Pro subscription with online payment on, so outlets can be bought here. */
  canBuy: boolean;
  contact: string;
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

  async function outlets(change: 1 | -1) {
    const q =
      change === 1
        ? `Add an outlet for ${outletPrice} a month? You're charged for the rest of this month now, on the card you pay with.`
        : `Stop paying for one unused outlet? The rest of this month is credited to your next invoice.`;
    if (!window.confirm(q)) return;
    setBusy("outlets");
    setError("");
    const res = await fetch("/api/billing/outlets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ change }) });
    setBusy(null);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't go through. Try again.");
    if (change === 1) window.location.assign("/onboarding?add=1");
    else router.refresh();
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
      <div className="space-y-3 border-t border-line px-5 py-4 md:px-6">
        <p className="text-[15px] text-ink-2">
          Pro includes {included} outlets of the same business, each with its own profile, Google Business Profile, reports, prescription board and connected
          accounts. You can add up to {most - included} more at {outletPrice} a month each. {businesses.length} of {max} set up
          {extra > 0 ? `, including ${extra} extra outlet${extra === 1 ? "" : "s"} you pay for` : ""}.
        </p>
        <div className="flex flex-wrap gap-2">
          {businesses.length < max && (
            <Link href="/onboarding?add=1" className="inline-flex rounded-full bg-scrub px-5 py-2.5 text-sm font-semibold text-white hover:bg-scrub-dark">
              Set up your next outlet
            </Link>
          )}
          {max >= most ? null : canBuy ? (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => outlets(1)}
                className={cx(
                  "rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50",
                  businesses.length < max ? "text-ink ring-1 ring-line hover:ring-ink-3" : "bg-scrub text-white hover:bg-scrub-dark",
                )}
              >
                {busy === "outlets" ? "One moment..." : `Add an outlet (${outletPrice}/month)`}
              </button>
              {extra > 0 && businesses.length < max && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => outlets(-1)}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-2 ring-1 ring-line hover:text-pulse hover:ring-pulse disabled:opacity-50"
                >
                  Stop paying for an unused outlet
                </button>
              )}
            </>
          ) : (
            businesses.length >= max &&
            max < most && (
              <a
                href={`mailto:${contact}?subject=${encodeURIComponent("MarketingRx: add an outlet")}`}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:ring-ink-3"
              >
                Email us to add an outlet
              </a>
            )
          )}
        </div>
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

/** Settings > Plan: enter a promo code. */
export function PromoRedeem() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/promo/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = (await res.json().catch(() => ({}))) as { plan?: string; until?: string | null; error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error || "That code didn't work." });
    const until = data.until ? ` until ${new Date(data.until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "";
    setMsg({ ok: true, text: `Done. You're on ${data.plan}${until}.` });
    setCode("");
    router.refresh();
  }

  return (
    <form onSubmit={redeem} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="block flex-1">
        <span className="mb-1.5 block text-sm font-semibold">Have a promo code?</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-[15px] uppercase tracking-wide outline-none focus:border-scrub"
        />
      </label>
      <button type="submit" disabled={busy || !code.trim()} className="rounded-full bg-scrub px-5 py-2.5 text-sm font-semibold text-white hover:bg-scrub-dark disabled:opacity-50">
        {busy ? "Checking..." : "Apply code"}
      </button>
      {msg && (
        <p role="status" className={cx("text-sm sm:pb-3", msg.ok ? "text-good" : "text-pulse")}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
