import type { AgentDef } from "./types";

// STUB: replaced by the full implementation.
type Input = Record<string, unknown>;

export const adsAgent: AgentDef<Input> = {
  id: "ads",
  name: "Ads Doctor",
  blurb: "Coming soon.",
  description: "Coming soon.",
  parseInput: (raw) => (raw ?? {}) as Input,
  runTitle: () => "Ads Doctor",
  async run() {
    throw new Error("Not built yet.");
  },
  async demo() {
    return { title: "Ads Doctor", score: null, summary: "Not built yet.", prescriptions: [], demo: true };
  },
};
