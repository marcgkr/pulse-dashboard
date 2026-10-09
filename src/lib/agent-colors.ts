// Each specialist has a pill-box colour used everywhere it appears: cards, slips, reports, nav dots.
// Client-safe (no server imports).

/** `accent` is the raw colour as a CSS value, for inline styles such as report section markers. */
export type AgentColor = { box: string; dot: string; soft: string; label: string; accent: string };

export const AGENT_COLORS: Record<string, AgentColor> = {
  site: { box: "bg-tangerine", dot: "bg-tangerine", soft: "bg-tangerine/15", label: "Site Doctor", accent: "var(--color-tangerine)" },
  keywords: { box: "bg-sun", dot: "bg-sun", soft: "bg-sun/20", label: "Keyword Lab", accent: "var(--color-sun)" },
  visibility: { box: "bg-sky", dot: "bg-sky", soft: "bg-sky/20", label: "AI Visibility", accent: "var(--color-sky)" },
  content: { box: "bg-bubblegum", dot: "bg-bubblegum", soft: "bg-bubblegum/20", label: "Content Studio", accent: "var(--color-bubblegum)" },
  ads: { box: "bg-spearmint", dot: "bg-spearmint", soft: "bg-spearmint/20", label: "Ads Doctor", accent: "var(--color-spearmint)" },
  compliance: { box: "bg-lilac", dot: "bg-lilac", soft: "bg-lilac/25", label: "Compliance Check", accent: "var(--color-lilac)" },
};

const FALLBACK: AgentColor = { box: "bg-mint", dot: "bg-scrub", soft: "bg-mint", label: "", accent: "var(--color-scrub)" };

export function agentColor(agent: string | null | undefined): AgentColor {
  return (agent && AGENT_COLORS[agent]) || FALLBACK;
}
