// Each specialist has a pill-box colour used everywhere it appears: cards, slips, reports, nav dots.
// Client-safe (no server imports).

export type AgentColor = { box: string; dot: string; soft: string; label: string };

export const AGENT_COLORS: Record<string, AgentColor> = {
  site: { box: "bg-tangerine", dot: "bg-tangerine", soft: "bg-tangerine/15", label: "Site Doctor" },
  keywords: { box: "bg-sun", dot: "bg-sun", soft: "bg-sun/20", label: "Keyword Lab" },
  visibility: { box: "bg-sky", dot: "bg-sky", soft: "bg-sky/20", label: "AI Visibility" },
  content: { box: "bg-bubblegum", dot: "bg-bubblegum", soft: "bg-bubblegum/20", label: "Content Studio" },
  ads: { box: "bg-spearmint", dot: "bg-spearmint", soft: "bg-spearmint/20", label: "Ads Doctor" },
  compliance: { box: "bg-lilac", dot: "bg-lilac", soft: "bg-lilac/25", label: "Compliance Check" },
};

const FALLBACK: AgentColor = { box: "bg-mint", dot: "bg-scrub", soft: "bg-mint", label: "" };

export function agentColor(agent: string | null | undefined): AgentColor {
  return (agent && AGENT_COLORS[agent]) || FALLBACK;
}
