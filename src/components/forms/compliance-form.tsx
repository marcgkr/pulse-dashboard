"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";

const CHANNELS = ["Meta ad", "Google ad", "Instagram post", "TikTok", "Website", "Other"];
const CATEGORIES = [
  "Medical clinic",
  "Aesthetic clinic",
  "Dental",
  "Beauty salon / non-medical",
  "Health supplements",
  "Legal",
  "Financial",
  "Other",
];

// Mirrors categoryFromIndustry in src/lib/agents/compliance.ts (kept here so the client bundle stays server-free).
function categoryFromIndustry(industry: string, regulated: boolean): string {
  const s = (industry || "").toLowerCase();
  if (/aesthetic|botox|filler|laser|dermatolog|skin clinic|medispa|med spa/.test(s)) return "Aesthetic clinic";
  if (/dental|dentist|orthodont/.test(s)) return "Dental";
  if (/clinic|medical|doctor|gp\b|physio|chiropract|tcm|health ?care|hospital|specialist/.test(s)) return "Medical clinic";
  if (/supplement|vitamin|nutrition/.test(s)) return "Health supplements";
  if (/law|legal|lawyer|attorney|solicitor/.test(s)) return "Legal";
  if (/financ|insur|invest|wealth|loan|mortgage|bank|accounting/.test(s)) return "Financial";
  if (/salon|lash|brow|nail|beauty|spa|facial|hair|massage|wax/.test(s)) return "Beauty salon / non-medical";
  return regulated ? "Medical clinic" : "Other";
}

export function ComplianceForm({ profile, lastInput }: FormProps) {
  const [text, setText] = useState((lastInput?.text as string) || "");
  const [url, setUrl] = useState((lastInput?.url as string) || "");
  const [channel, setChannel] = useState((lastInput?.channel as string) || "Meta ad");
  const [category, setCategory] = useState(
    (lastInput?.category as string) || categoryFromIndustry(profile.industry, profile.regulated),
  );
  const { start, pending, error } = useRunAgent("compliance");
  const empty = !text.trim() && !url.trim();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start({ text, url, channel, category });
      }}
    >
      <Field label="Copy to check" hint="Paste an ad, caption or landing page text. Headline, body and button text all count.">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="e.g. Singapore's best Hydrafacial. Book your free trial today!"
        />
      </Field>
      <Field label="Or a page URL" hint="Optional. We read the text on the page and check that too.">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbusiness.com.sg/promo" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where it will run">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Business category" hint="Sets which rules apply.">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={pending || empty}>
        <ShieldCheck size={16} /> {pending ? "Starting..." : "Run compliance check"}
      </Button>
    </form>
  );
}
