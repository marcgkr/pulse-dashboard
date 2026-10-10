"use client";

import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";
import { marketFor } from "@/lib/markets";

// Kept in sync with PLATFORMS and GOALS in src/lib/agents/content-demo.ts (not imported to keep server code out of the client bundle).
const PLATFORMS = ["Instagram", "TikTok", "Facebook", "LinkedIn", "Xiaohongshu", "YouTube Shorts"];
const GOALS = [
  ["enquiries", "Get enquiries"],
  ["followers", "Grow followers"],
  ["trust", "Build trust"],
  ["launch", "Launch something"],
] as const;

export function ContentForm({ profile, lastInput }: FormProps) {
  const last = lastInput ?? {};
  const defaultNiche = [profile.industry, profile.offers].filter(Boolean).join(": ");
  const market = marketFor(profile.country);
  const [platforms, setPlatforms] = useState<string[]>(
    Array.isArray(last.platforms) && last.platforms.length ? (last.platforms as string[]).filter((p) => PLATFORMS.includes(p)) : ["Instagram", "TikTok"],
  );
  const [niche, setNiche] = useState((last.niche as string) || defaultNiche);
  const [goal, setGoal] = useState((last.goal as string) || "enquiries");
  const [count, setCount] = useState(String(last.count ?? 10));
  const [perWeek, setPerWeek] = useState(String(last.per_week ?? 3));
  const [working, setWorking] = useState((last.working as string) || "");
  const [avoid, setAvoid] = useState((last.avoid as string) || "");
  const [trends, setTrends] = useState(last.trends === undefined ? true : Boolean(last.trends));
  const [language, setLanguage] = useState((last.language as string) || "English");
  const [localError, setLocalError] = useState<string | null>(null);
  const { start, pending, error } = useRunAgent("content");

  const toggle = (p: string) => setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (platforms.length === 0) {
          setLocalError("Pick at least one platform.");
          return;
        }
        setLocalError(null);
        void start({ platforms, niche, goal, count: Number(count), per_week: Number(perWeek), working, avoid, trends, language });
      }}
    >
      <fieldset>
        <legend className="mb-1.5 block text-sm font-semibold text-ink">Platforms</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = platforms.includes(p);
            return (
              <label
                key={p}
                className={cx(
                  "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition",
                  on ? "border-scrub bg-mint text-scrub-dark" : "border-line bg-white text-ink-2 hover:border-ink-3",
                )}
              >
                <input type="checkbox" className="accent-[var(--color-scrub)]" checked={on} onChange={() => toggle(p)} />
                {p}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field label="Niche or topic focus" hint="What should the posts be about? Defaults to your industry and services.">
        <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. lash extensions for busy professionals" required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Goal">
            <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="How many ideas">
          <Select value={count} onChange={(e) => setCount(e.target.value)}>
            {["6", "10", "14"].map((n) => (
              <option key={n} value={n}>
                {n} ideas
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Posts you can manage">
          <Select value={perWeek} onChange={(e) => setPerWeek(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} a week
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Caption language" hint="e.g. English, English + Chinese, English + Malay">
        <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English" />
      </Field>

      <Field label="What's working for you (optional)" hint="Posts that got enquiries, formats your customers respond to.">
        <Textarea
          value={working}
          onChange={(e) => setWorking(e.target.value)}
          className="min-h-20"
          placeholder={`e.g. Our price explainer Reel got lots of ${market.messaging === "SMS" ? "calls and DMs" : `${market.messaging} messages`}`}
        />
      </Field>

      <Field label="Avoid (optional)" hint="Topics, formats or things you won't do, e.g. dancing, showing faces.">
        <Textarea value={avoid} onChange={(e) => setAvoid(e.target.value)} className="min-h-16" placeholder="e.g. No dancing, no showing customers' faces" />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white px-3 py-2.5">
        <input type="checkbox" className="mt-0.5 accent-[var(--color-scrub)]" checked={trends} onChange={(e) => setTrends(e.target.checked)} />
        <span>
          <span className="block text-sm font-semibold text-ink">Include this month's trends</span>
          <span className="block text-xs text-ink-3">
            Searches for current formats, sounds and {market.code === "SG" ? "Singapore" : "local"} calendar moments for your niche. Takes a little longer.
          </span>
        </span>
      </label>

      {profile.regulated && (
        <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-[#8a5410]">
          Your profile is marked as a regulated category, so ideas will avoid testimonials, before/after photos, superlatives and guarantees.
        </p>
      )}

      <FormError error={localError ?? error} />
      <Button type="submit" disabled={pending}>
        <Clapperboard size={16} /> {pending ? "Starting..." : "Write my content plan"}
      </Button>
    </form>
  );
}
