import type { AgentDef, AgentId } from "./types";
import { siteAgent } from "./site";
import { keywordsAgent } from "./keywords";
import { visibilityAgent } from "./visibility";
import { contentAgent } from "./content";
import { adsAgent } from "./ads";
import { complianceAgent } from "./compliance";

export const AGENTS: Record<AgentId, AgentDef<any>> = {
  site: siteAgent,
  keywords: keywordsAgent,
  visibility: visibilityAgent,
  content: contentAgent,
  ads: adsAgent,
  compliance: complianceAgent,
};

export const AGENT_ORDER: AgentId[] = ["site", "keywords", "visibility", "content", "ads", "compliance"];

export function getAgent(id: string): AgentDef<any> | null {
  return Object.hasOwn(AGENTS, id) ? (AGENTS as Record<string, AgentDef<any>>)[id] : null;
}

export type { AgentId, AgentDef, AgentResult, AgentContext } from "./types";
