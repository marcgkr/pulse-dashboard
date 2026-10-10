import type { ComponentType } from "react";
import type { AgentId } from "@/lib/agents/types";
import type { FormProps } from "./types";
import { SiteForm } from "./site-form";
import { KeywordsForm } from "./keywords-form";
import { VisibilityForm } from "./visibility-form";
import { ContentForm } from "./content-form";
import { AdsForm } from "./ads-form";
import { ComplianceForm } from "./compliance-form";
import { GbpForm } from "./gbp-form";

export const AGENT_FORMS: Record<AgentId, ComponentType<FormProps>> = {
  site: SiteForm,
  keywords: KeywordsForm,
  visibility: VisibilityForm,
  content: ContentForm,
  ads: AdsForm,
  compliance: ComplianceForm,
  gbp: GbpForm,
};
