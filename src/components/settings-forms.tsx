"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/config";
import { Button, Input } from "./ui";
import { FormError } from "./run-agent";

export function WindsorForm({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(value: string) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/workspace", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ windsor_api_key: value }) });
    setPending(false);
    if (!res.ok) return setError("Couldn't save the key.");
    setKey("");
    router.refresh();
  }
  return (
    <div className="space-y-3">
      {connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-scrub"><span className="h-2 w-2 rounded-full bg-scrub" /> Connected</span>
          <Button variant="secondary" disabled={pending} onClick={() => save("")}>Disconnect</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void save(key); }}>
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Windsor.ai API key" autoComplete="off" required />
          <Button type="submit" disabled={pending}>Connect</Button>
        </form>
      )}
      <FormError error={error} />
    </div>
  );
}

export function PlanButtons({ current, stripe, hasCustomer, contact }: { current: string; stripe: boolean; hasCustomer: boolean; contact: string }) {
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
      {PLANS.filter((p) => p.id !== "free" && p.id !== current).map((p) => (
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
