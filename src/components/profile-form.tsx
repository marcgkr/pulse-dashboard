"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { FormError } from "./run-agent";

export type Profile = {
  name?: string;
  website?: string;
  industry?: string;
  location?: string;
  audience?: string;
  offers?: string;
  competitors?: string;
  goals?: string;
  monthly_budget?: string;
  tone?: string;
  regulated?: boolean;
};

const INDUSTRIES = [
  "Aesthetic clinic",
  "Medical clinic / specialist",
  "Dental clinic",
  "Physiotherapy / rehab",
  "Beauty salon (lash, brow, nails, facials)",
  "Wellness / massage / reflexology",
  "Legal services",
  "E-commerce / D2C brand",
  "F&B",
  "Education / tuition",
  "Real estate",
  "Home services / renovation",
  "Professional services",
  "Other",
];

export function ProfileForm({ mode, initial }: { mode: "create" | "edit"; initial: Profile }) {
  const router = useRouter();
  const [p, setP] = useState<Profile>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaved(false);
    setP((prev) => ({ ...prev, [k]: e.target.value }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/workspace", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) return setError(data.error || "Couldn't save.");
    if (mode === "create") {
      router.push("/app?welcome=1");
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Business name">
          <Input value={p.name ?? ""} onChange={set("name")} required placeholder="Glow Aesthetics" />
        </Field>
        <Field label="Website">
          <Input value={p.website ?? ""} onChange={set("website")} placeholder="glowaesthetics.sg" />
        </Field>
        <Field label="Industry">
          <Select value={p.industry ?? ""} onChange={set("industry")} required>
            <option value="" disabled>
              Choose one
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Field>
        <Field label="Where your customers are" hint="City, area or country.">
          <Input value={p.location ?? ""} onChange={set("location")} placeholder="Singapore (Tampines, East)" />
        </Field>
      </div>
      <Field label="What you sell" hint="Main services or products, with price ranges if you're comfortable.">
        <Textarea value={p.offers ?? ""} onChange={set("offers")} placeholder="Pico laser ($300-$450), Hydrafacial ($188), skin boosters" />
      </Field>
      <Field label="Who your best customers are">
        <Textarea value={p.audience ?? ""} onChange={set("audience")} placeholder="Working women 28-45 in the East, first-timers worried about downtime" className="min-h-16" />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Competitors" hint="Names or websites, comma separated.">
          <Input value={p.competitors ?? ""} onChange={set("competitors")} />
        </Field>
        <Field label="Monthly marketing budget">
          <Input value={p.monthly_budget ?? ""} onChange={set("monthly_budget")} placeholder="S$3,000 ads + my own time" />
        </Field>
      </div>
      <Field label="What you want in the next 90 days">
        <Textarea value={p.goals ?? ""} onChange={set("goals")} placeholder="20 more first-time bookings a month without raising ad spend" className="min-h-16" />
      </Field>
      {mode === "edit" && (
        <>
          <Field label="Brand voice" hint="How you sound. Agents write captions and copy in this voice.">
            <Input value={p.tone ?? ""} onChange={set("tone")} placeholder="Warm, reassuring, no hard sell" />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--color-scrub)]"
              checked={Boolean(p.regulated)}
              onChange={(e) => setP((prev) => ({ ...prev, regulated: e.target.checked }))}
            />
            <span>
              <span className="font-semibold">Regulated category</span>
              <span className="block text-ink-3">Healthcare, legal or financial. Agents keep advice inside advertising rules and flag risky copy.</span>
            </span>
          </label>
        </>
      )}
      <FormError error={error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Save and open my dashboard" : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-scrub">Saved.</span>}
      </div>
    </form>
  );
}
