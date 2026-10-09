import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AGENT_ORDER, getAgent, type AgentId } from "@/lib/agents";
import { BRAND } from "@/lib/config";
import { SAMPLE_BUSINESSES, sampleBusinessId } from "@/lib/sample-data";
import { sampleHref } from "@/components/landing/specialists";
import { SampleView } from "../sample-view";

type Props = { params: Promise<{ agent: string }>; searchParams: Promise<{ business?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { agent } = await params;
  const def = getAgent(agent);
  if (!def) return { title: "Sample report" };
  const b = SAMPLE_BUSINESSES[sampleBusinessId((await searchParams).business)];
  return {
    title: `Sample report: ${def.name}`,
    description: `What ${BRAND.name}'s ${def.name} hands you, shown on ${b.name}, a fictional ${b.kind}. ${def.blurb}`,
  };
}

export default async function SampleAgentPage({ params, searchParams }: Props) {
  const { agent } = await params;
  const business = sampleBusinessId((await searchParams).business);
  if (agent === "site") redirect(sampleHref("site", business));
  if (!(AGENT_ORDER as string[]).includes(agent)) notFound();
  return <SampleView agent={agent as AgentId} business={business} />;
}
