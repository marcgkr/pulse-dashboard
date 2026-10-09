"use client";

import { useState } from "react";
import { PLANS } from "@/lib/config";
import { Button } from "./ui";
import { FormError } from "./run-agent";

export function PlanButtons({
  current,
  stripe,
  hasCustomer,
  hasSubscription,
  contact,
}: {
  current: string;
  stripe: boolean;
  hasCustomer: boolean;
  hasSubscription: boolean;
  contact: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function go(path: string, body: unknown, key: string) {
    setPending(key);
    setError(null);
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setPending(null);
      return setError(data.error || "Couldn't open checkout.");
    }
    window.location.href = data.url;
  }
  if (!stripe) {
    return (
      <p className="text-sm text-ink-2">
        To change plans, email <a className="font-semibold text-scrub hover:underline" href={`mailto:${contact}?subject=MarketingRx plan change`}>{contact}</a>.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {hasSubscription && <p className="w-full text-sm text-ink-2">To switch plans or cancel, use Manage billing.</p>}
      {!hasSubscription && PLANS.filter((p) => p.id !== "free" && p.id !== current).map((p) => (
        <Button key={p.id} disabled={!!pending} onClick={() => go("/api/billing/checkout", { plan: p.id }, p.id)}>
          {pending === p.id ? "Opening checkout..." : `Switch to ${p.name}`}
        </Button>
      ))}
      {hasCustomer && (
        <Button variant="secondary" disabled={!!pending} onClick={() => go("/api/billing/portal", {}, "portal")}>
          Manage billing
        </Button>
      )}
      <FormError error={error} />
    </div>
  );
}
