import type { WorkspaceRow } from "../db";
import type { Prescription } from "../ai";

export type AgentId = "site" | "keywords" | "visibility" | "content" | "ads" | "compliance" | "gbp";

export type AgentContext = {
  ws: WorkspaceRow;
  runId: string;
  /** Update the progress line shown in the UI while the agent works. */
  progress: (message: string) => void;
};

/** Every agent returns at least these fields. Agent-specific data goes alongside. */
export type AgentResult = {
  /** Short human title for the report, e.g. "Site checkup: brightwellstudio.com" */
  title: string;
  /** 0-100 health score, or null when the agent does not score. */
  score: number | null;
  /** 2-4 sentence plain summary shown at the top of the report. */
  summary: string;
  prescriptions: Prescription[];
  /** True when produced without the live AI (sample or rules-only output). */
  demo?: boolean;
  [key: string]: unknown;
};

export type AgentDef<Input = unknown> = {
  id: AgentId;
  name: string;
  /** One line, shown on cards. */
  blurb: string;
  /** What the owner gets, shown on the agent page. */
  description: string;
  /** Validates and normalises raw input from the client. Throw an Error with a readable message on bad input. */
  parseInput: (raw: unknown, ws: WorkspaceRow) => Input;
  /** Short title for the run list, from the input. */
  runTitle: (input: Input, ws: WorkspaceRow) => string;
  /** Live run (uses Claude). */
  run: (input: Input, ctx: AgentContext) => Promise<AgentResult>;
  /** Run without an API key: rules-only or sample output. Must set demo: true. */
  demo: (input: Input, ctx: AgentContext) => Promise<AgentResult>;
};
