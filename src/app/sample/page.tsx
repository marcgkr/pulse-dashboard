import type { Metadata } from "next";
import { BRAND } from "@/lib/config";
import { SAMPLE_BUSINESSES, sampleBusinessId } from "@/lib/sample-data";
import { SampleView } from "./sample-view";

type Props = { searchParams: Promise<{ business?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const b = SAMPLE_BUSINESSES[sampleBusinessId((await searchParams).business)];
  return {
    title: "Sample report",
    description: `A full ${BRAND.name} report for ${b.name}, a fictional ${b.kind}: Site Doctor, Keyword Lab, AI Visibility, Content Studio, Ads Doctor and Compliance Check, with every prescription and its steps. Also shown for a renovation company, a cafe, an online store and a clinic.`,
  };
}

// Site Doctor is the first tab. The other specialists live at /sample/[agent]. ?business= picks
// the fictional business (renovation by default).
export default async function SamplePage({ searchParams }: Props) {
  const business = sampleBusinessId((await searchParams).business);
  return <SampleView agent="site" business={business} />;
}
