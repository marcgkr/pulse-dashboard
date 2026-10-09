import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AGENT_ORDER, getAgent, type AgentId } from "@/lib/agents";
import { BRAND } from "@/lib/config";
import { SampleView } from "../sample-view";

type Params = { params: Promise<{ agent: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { agent } = await params;
  const def = getAgent(agent);
  if (!def) return { title: "Sample report" };
  return {
    title: `Sample report: ${def.name}`,
    description: `What ${BRAND.name}'s ${def.name} hands you, shown on a fictional clinic. ${def.blurb}`,
  };
}

export default async function SampleAgentPage({ params }: Params) {
  const { agent } = await params;
  if (agent === "site") redirect("/sample");
  if (!(AGENT_ORDER as string[]).includes(agent)) notFound();
  return <SampleView agent={agent as AgentId} />;
}
