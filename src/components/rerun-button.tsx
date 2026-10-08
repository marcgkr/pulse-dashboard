"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "./ui";
import { useRunAgent } from "./run-agent";

export function RerunButton({ agent, input, label }: { agent: string; input: unknown; label: string }) {
  const { start, pending, error } = useRunAgent(agent);
  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={() => start(input)}>
        <RotateCcw size={15} /> {pending ? "Starting..." : label}
      </Button>
      {error && <p className="mt-1 max-w-xs text-xs text-pulse">{error}</p>}
    </div>
  );
}
