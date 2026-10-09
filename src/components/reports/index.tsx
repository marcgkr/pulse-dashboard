import type { ComponentType } from "react";
import type { ItemFeedback } from "../feedback-bar";
import type { AgentId } from "@/lib/agents/types";
import { SiteReport } from "./site-report";
import { KeywordsReport } from "./keywords-report";
import { VisibilityReport } from "./visibility-report";
import { ContentReport } from "./content-report";
import { AdsReport } from "./ads-report";
import { ComplianceReport } from "./compliance-report";

export type ReportProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  run: { id: string; agent: string; title: string; created_at: string; input: Record<string, unknown> };
  /** The owner's saved approvals, rejections and comments on this report, keyed by item. */
  feedback?: Record<string, ItemFeedback>;
};

export const AGENT_REPORTS: Record<AgentId, ComponentType<ReportProps>> = {
  site: SiteReport as ComponentType<ReportProps>,
  keywords: KeywordsReport as ComponentType<ReportProps>,
  visibility: VisibilityReport as ComponentType<ReportProps>,
  content: ContentReport as ComponentType<ReportProps>,
  ads: AdsReport as ComponentType<ReportProps>,
  compliance: ComplianceReport as ComponentType<ReportProps>,
};
