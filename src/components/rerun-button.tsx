"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "./ui";
import { useRunAgent } from "./run-agent";

export function RerunButton({ agent, rerunOf, label }: { agent: string; rerunOf: string; label: string }) {
  const { rerun, pending, error } = useRunAgent(agent);
  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={() => rerun(rerunOf)}>
        <RotateCcw size={15} /> {pending ? "Starting..." : label}
      </Button>
      {error && <p className="mt-1 max-w-xs text-xs text-pulse">{error}</p>}
    </div>
  );
}
