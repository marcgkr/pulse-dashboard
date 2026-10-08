"use client";

import { useState } from "react";
import { PLANS } from "@/lib/config";

export function AdminPlanSelect({ workspaceId, plan }: { workspaceId: string; plan: string }) {
  const [value, setValue] = useState(plan);
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
      {state === "saved" && <span className="text-xs text-scrub">Saved</span>}
      {state === "error" && <span className="text-xs text-pulse">Failed</span>}
    </div>
  );
}
