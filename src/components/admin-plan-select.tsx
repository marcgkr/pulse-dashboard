"use client";

import { useState } from "react";
import { PLANS, planById } from "@/lib/config";

export function AdminPlanSelect({
  workspaceId,
  plan,
  outlets,
  webcare,
  paidWebcare = false,
  primary = true,
}: {
  workspaceId: string;
  plan: string;
  outlets: number;
  /** Granted free by an admin. */
  webcare: boolean;
  /** Paid through Stripe. */
  paidWebcare?: boolean;
  /** The account's first business, which holds the plan and add-ons. */
  primary?: boolean;
}) {
  const [value, setValue] = useState(plan);
  const [extra, setExtra] = useState(String(outlets));
  const [care, setCare] = useState(webcare);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={async (e) => {
          const next = e.target.value;
          setValue(next);
          setState("saving");
          const res = await fetch("/api/admin/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, plan: next }) });
          setState(res.ok ? "saved" : "error");
        }}
        className="rounded border border-line bg-white px-2 py-1 text-sm"
        aria-label="Plan"
      >
        {PLANS.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {value === "pro" && (
        <label className="flex items-center gap-1 text-xs text-ink-2">
          +
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value.replace(/\D/g, ""))}
            onBlur={async () => {
              setState("saving");
              const res = await fetch("/api/admin/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, outlets: Number(extra || 0) }) });
              setState(res.ok ? "saved" : "error");
            }}
            inputMode="numeric"
            aria-label="Extra outlets"
            className="w-10 rounded border border-line bg-white px-1.5 py-1 text-sm"
          />
          outlets
        </label>
      )}
      {primary && planById(value).websiteCare && paidWebcare && <span className="text-xs text-scrub-dark">Website changes (paid)</span>}
      {primary && planById(value).websiteCare && !paidWebcare && (
        <label className="flex items-center gap-1 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={care}
            onChange={async (e) => {
              const next = e.target.checked;
              setCare(next);
              setState("saving");
              const res = await fetch("/api/admin/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, webcare: next }) });
              setState(res.ok ? "saved" : "error");
            }}
            aria-label="Website changes add-on"
          />
          Website changes (free)
        </label>
      )}
      {state === "saved" && <span className="text-xs text-scrub">Saved</span>}
      {state === "error" && <span className="text-xs text-pulse">Failed</span>}
    </div>
  );
}
