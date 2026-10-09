// Server-wide caps on expensive work, so a flood of requests from many addresses can't pile up
// crawls or AI calls until the server falls over. Per-IP limits live in middleware.ts and http.ts.

const g = globalThis as unknown as { __gates?: Map<string, { active: number }> };
const gates = (g.__gates ??= new Map());

/** Read a whole-number setting from the environment, with a default. */
export function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Runs `work` only if fewer than `max` of the same kind are already running in this server.
 * Returns null without running it when the server is at capacity.
 */
export async function withGate<T>(name: string, max: number, work: () => Promise<T>): Promise<T | null> {
  const gate = gates.get(name) ?? { active: 0 };
  gates.set(name, gate);
  if (gate.active >= max) return null;
  gate.active++;
  try {
    return await work();
  } finally {
    gate.active--;
  }
}
