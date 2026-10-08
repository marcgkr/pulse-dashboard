"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EcgTrace } from "./brand";

/** Starts an agent run and sends the user to the live run page. */
export function useRunAgent(agent: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start the agent.");
      router.push(`/app/runs/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  /** Start a run. Pass parentRunId for follow-ups (expand, more like this). */
  const start = (input: unknown, parentRunId?: string) => post({ agent, input, parentRunId });
  /** Run again with the exact stored input of an earlier run. */
  const rerun = (runId: string) => post({ agent, rerunOf: runId });

  return { start, rerun, pending, error };
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-pulse/30 bg-pulse/5 px-3 py-2 text-sm text-pulse">
      {error}
    </p>
  );
}

/** Live progress while a run is working. Refreshes the page when it finishes. */
export function RunProgress({ runId, initial }: { runId: string; initial: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const poll = async () => {
      while (alive) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" }).catch(() => null);
        if (!res?.ok) continue;
        const data = (await res.json()) as { status: string; progress: string };
        if (!alive) return;
        setProgress(data.progress);
        if (data.status === "done" || data.status === "error") {
          router.refresh();
          return;
        }
      }
    };
    void poll();
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [runId, router]);

  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-ink-3">
        <span className="inline-flex items-center gap-2">
          <span className="blip h-2 w-2 rounded-full bg-pulse" /> Working
        </span>
        <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
      </div>
      <EcgTrace className="my-4" key={Math.floor(seconds / 3)} />
      <p className="text-ink-2">{progress || "Starting"}...</p>
      <p className="mt-2 text-xs text-ink-3">Most checkups take 30 seconds to 3 minutes. You can leave this page; the report will be waiting under Reports.</p>
    </div>
  );
}
