"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, cx } from "./ui";
import { FormError } from "./run-agent";

export type PickerPlan = { id: string; name: string; price: string; features: string[] };

/**
 * Settings > Plan. Each plan has its own button: new customers go straight to Stripe Checkout,
 * subscribers switch on the spot (upgrades charge the difference now), and choosing the free plan
 * cancels at the end of the paid period.
 */
export function PlanPicker({
  plans,
  current,
  paid,
  stripe,
  hasSubscription,
  hasCustomer,
  contact,
}: {
  plans: PickerPlan[];
  /** The plan in use now (a promo can lift it above the paid plan). */
  current: string;
  /** The plan being paid for. */
  paid: string;
  stripe: boolean;
  hasSubscription: boolean;
  hasCustomer: boolean;
  contact: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const order = plans.map((p) => p.id);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as { url?: string; error?: string; plan?: string; cancelsAt?: string | null } };
  }

  async function choose(p: PickerPlan) {
    setError(null);
    setNotice(null);
    if (!hasSubscription) {
      if (p.id === "free") return;
      setPending(p.id);
      const { ok, data } = await post("/api/billing/checkout", { plan: p.id });
      if (!ok || !data.url) {
        setPending(null);
        return setError(data.error || "Couldn't open checkout.");
      }
      window.location.href = data.url;
      return;
    }
    const up = order.indexOf(p.id) > order.indexOf(paid);
    const question =
      p.id === "free"
        ? "Cancel your plan? You keep it until the end of the period you've paid for, then move to the free plan."
        : up
          ? `Switch to ${p.name} now? You're charged the difference for the rest of this month on the card you pay with.`
          : `Switch to ${p.name} now? The unused part of this month is credited to your next invoice.`;
    if (!window.confirm(question)) return;
    setPending(p.id);
    const { ok, data } = await post("/api/billing/change", { plan: p.id });
    setPending(null);
    if (!ok) return setError(data.error || "That change didn't go through.");
    setNotice(
      p.id === "free"
        ? `Cancelled. You keep ${plans.find((x) => x.id === paid)?.name}${data.cancelsAt ? ` until ${new Date(data.cancelsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : " until the end of the period"}.`
        : `Done. You're on ${p.name}.`,
    );
    router.refresh();
  }

  async function portal() {
    setPending("portal");
    const { ok, data } = await post("/api/billing/portal", {});
    if (!ok || !data.url) {
      setPending(null);
      return setError(data.error || "Couldn't open billing.");
    }
    window.location.href = data.url;
  }

  const label = (p: PickerPlan) => {
    if (pending === p.id) return hasSubscription ? "Switching..." : "Opening checkout...";
    if (p.id === "free") return "Cancel plan";
    if (!hasSubscription) return `Choose ${p.name}`;
    return order.indexOf(p.id) > order.indexOf(paid) ? `Upgrade to ${p.name}` : `Switch to ${p.name}`;
  };

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.id === current;
          const isPaid = p.id === paid;
          const showButton = stripe && !isPaid && (p.id !== "free" || hasSubscription);
          return (
            <div key={p.id} className={cx("flex flex-col rounded-3xl p-5 ring-1", isCurrent ? "bg-mint ring-scrub" : "ring-line")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-semibold">{p.name}</span>
                {isCurrent && <Badge tone="green">Current</Badge>}
              </div>
              <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{p.price}</div>
              <ul className="mt-2 flex-1 space-y-1 text-sm text-ink-2">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {showButton && (
                <Button
                  type="button"
                  variant={p.id === "free" ? "secondary" : "primary"}
                  disabled={pending !== null}
                  onClick={() => choose(p)}
                  className="mt-4 w-full"
                >
                  {label(p)}
                </Button>
              )}
              {!stripe && p.id !== "free" && !isPaid && (
                <a
                  href={`mailto:${contact}?subject=${encodeURIComponent(`MarketingRx: switch to ${p.name}`)}`}
                  className="mt-4 inline-flex w-full justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:ring-ink-3"
                >
                  Ask for {p.name}
                </a>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {stripe && hasCustomer && (
          <Button type="button" variant="secondary" disabled={pending !== null} onClick={portal}>
            {pending === "portal" ? "Opening..." : "Invoices and payment card"}
          </Button>
        )}
        {notice && (
          <p role="status" className="text-sm text-good">
            {notice}
          </p>
        )}
        <FormError error={error} />
      </div>
      {!stripe && (
        <p className="mt-3 text-sm text-ink-2">
          Online payment isn&apos;t switched on yet. Email{" "}
          <a className="font-semibold text-scrub hover:underline" href={`mailto:${contact}?subject=MarketingRx plan change`}>
            {contact}
          </a>{" "}
          and we&apos;ll switch you over.
        </p>
      )}
    </div>
  );
}
