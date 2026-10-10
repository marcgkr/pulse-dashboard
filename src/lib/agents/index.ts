import type { AgentDef, AgentId } from "./types";
import { siteAgent } from "./site";
import { keywordsAgent } from "./keywords";
import { visibilityAgent } from "./visibility";
import { contentAgent } from "./content";
import { adsAgent } from "./ads";
import { complianceAgent } from "./compliance";
import { gbpAgent } from "./gbp";

export const AGENTS: Record<AgentId, AgentDef<any>> = {
  site: siteAgent,
  keywords: keywordsAgent,
  visibility: visibilityAgent,
  content: contentAgent,
  ads: adsAgent,
  compliance: complianceAgent,
  gbp: gbpAgent,
};

export const AGENT_ORDER: AgentId[] = ["site", "keywords", "visibility", "content", "ads", "compliance", "gbp"];

/** The specialists shown on the public sample pages (Business Profile needs a connected profile). */
export const SAMPLE_ORDER: AgentId[] = AGENT_ORDER.filter((a) => a !== "gbp");

export function getAgent(id: string): AgentDef<any> | null {
  return Object.hasOwn(AGENTS, id) ? (AGENTS as Record<string, AgentDef<any>>)[id] : null;
}

export type { AgentId, AgentDef, AgentResult, AgentContext } from "./types";
