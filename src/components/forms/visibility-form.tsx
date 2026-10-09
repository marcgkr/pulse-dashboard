"use client";

import { useState } from "react";
import { Radar, Wand2 } from "lucide-react";
import { Button, Field, Input, Textarea } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";
import { marketFor } from "@/lib/markets";

const MAX_PROMPTS = 8;

function asText(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join("\n");
  return typeof v === "string" ? v : "";
}

function firstItems(s: string, n: number): string[] {
  return s
    .split(/[\n,;|/]+/)
    .map((x) => x.replace(/\([^)]*\)/g, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, n);
}

/** Template-based prompt ideas from the business profile. No AI call. */
export function suggestPrompts(profile: FormProps["profile"]): string[] {
  const m = marketFor(profile.country);
  const home = m.code === "SG" ? "Singapore" : m.code === "INTL" ? "my area" : m.inPhrase;
  const loc = profile.location.split(",")[0]?.trim() || home;
  const country = m.code === "SG" ? (/singapore/i.test(profile.location) || !profile.location ? "Singapore" : loc) : m.code === "INTL" ? loc : m.inPhrase;
  const industry = (profile.industry || "").trim().toLowerCase() || "business";
  const services = firstItems(profile.offers, 3);
  const s1 = services[0] || industry;
  const s2 = services[1] || s1;
  const s3 = services[2] || industry;
  const out = [
    `best ${s1} in ${loc}`,
    `where to get ${s2} in ${country}`,
    `${industry} near ${loc} with good reviews`,
    `how much does ${s3} cost in ${country}`,
    `which ${industry} in ${country} do people recommend for ${s1}`,
  ];
  return [...new Set(out.map((p) => p.replace(/\s+/g, " ").trim()))].slice(0, 5);
}

export function VisibilityForm({ profile, lastInput }: FormProps) {
  const domainDefault = profile.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  const [prompts, setPrompts] = useState(asText(lastInput?.prompts) || suggestPrompts(profile).join("\n"));
  const [brand, setBrand] = useState((lastInput?.brand as string) || profile.name);
  const market = marketFor(profile.country);
  const [aliases, setAliases] = useState(asText(lastInput?.aliases).replace(/\n/g, ", "));
  const [domain, setDomain] = useState((lastInput?.domain as string) || domainDefault);
  const [competitors, setCompetitors] = useState(asText(lastInput?.competitors).replace(/\n/g, ", ") || profile.competitors);
  const { start, pending, error } = useRunAgent("visibility");

  const count = prompts.split("\n").filter((l) => l.trim()).length;
  const tooMany = count > MAX_PROMPTS;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start({ prompts, brand, aliases, domain, competitors });
      }}
    >
      <Field label="Questions customers ask AI assistants" hint={`One per line, up to ${MAX_PROMPTS}. Write them the way a customer would type them.`}>
        <Textarea
          value={prompts}
          onChange={(e) => setPrompts(e.target.value)}
          rows={6}
          placeholder={
            market.code === "SG"
              ? "best lash extension salon in Orchard\nwhere to get hydrafacial in Singapore"
              : market.code === "INTL"
                ? "best lash extension salon near me\nwhere to get hydrafacial in my city"
                : `best lash extension salon in ${market.exampleArea}\nwhere to get hydrafacial in ${market.inPhrase}`
          }
          required
        />
      </Field>
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={tooMany ? "font-mono text-xs text-pulse" : "font-mono text-xs text-ink-3"}>
          {count} / {MAX_PROMPTS} questions
        </span>
        <Button type="button" variant="secondary" onClick={() => setPrompts(suggestPrompts(profile).join("\n"))}>
          <Wand2 size={15} /> Suggest prompts
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name">
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} required />
        </Field>
        <Field label="Website domain" hint="Used to check if AI cites your site.">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={market.code === "SG" ? "yourbusiness.com.sg" : "yourbusiness.com"} />
        </Field>
      </div>
      <Field label="Other names for your brand" hint="Comma separated. Short names, old names, spellings customers use.">
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="e.g. Zion, Zion Clinic" />
      </Field>
      <Field label="Competitors to watch" hint="Comma separated.">
        <Input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Competitor A, Competitor B" />
      </Field>

      <FormError error={error} />
      <Button type="submit" disabled={pending || tooMany || count === 0}>
        <Radar size={16} /> {pending ? "Starting..." : "Check AI visibility"}
      </Button>
    </form>
  );
}
