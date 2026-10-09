import type { Metadata } from "next";
import { BRAND } from "@/lib/config";
import { SampleView } from "./sample-view";

export const metadata: Metadata = {
  title: "Sample report",
  description: `A full ${BRAND.name} report for a fictional clinic: Site Doctor, Keyword Lab, AI Visibility, Content Studio, Ads Doctor and Compliance Check, with every prescription and its steps.`,
};

// Site Doctor is the first tab. The other specialists live at /sample/[agent].
export default function SamplePage() {
  return <SampleView agent="site" />;
}
