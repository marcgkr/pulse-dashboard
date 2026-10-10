"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button, Field, Select, Textarea } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";

export function GbpForm({ connected, lastInput }: FormProps) {
  const [focus, setFocus] = useState((lastInput?.focus as string) || "");
  const [posts, setPosts] = useState(String(lastInput?.posts ?? 4));
  const { start, pending, error } = useRunAgent("gbp");
  const location = connected.gbpLocation;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start({ focus, posts: Number(posts) });
      }}
    >
      {location ? (
        <p className="flex items-start gap-2 rounded-2xl bg-mint px-4 py-3 text-sm text-scrub-dark">
          <MapPin size={16} className="mt-0.5 shrink-0" /> Reading your profile: <span className="font-semibold">{location}</span>
        </p>
      ) : (
        <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-ink-2">
          Connect Google and pick this outlet&apos;s location in{" "}
          <Link href="/app/settings/connections" className="font-semibold text-scrub underline underline-offset-2">
            Connected accounts
          </Link>{" "}
          first. Until then you&apos;ll see a sample profile.
        </p>
      )}
      <Field label="Anything to focus on?" hint="Optional. For example a new service, a slow weekday, or more reviews from a certain kind of customer.">
        <Textarea value={focus} onChange={(e) => setFocus(e.target.value)} rows={3} placeholder="e.g. Fill weekday mornings; we just started offering pico laser" />
      </Field>
      <Field label="Posts to write">
        <Select value={posts} onChange={(e) => setPosts(e.target.value)}>
          <option value="2">2 posts (2 weeks)</option>
          <option value="4">4 posts (a month, one a week)</option>
          <option value="6">6 posts</option>
        </Select>
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        <MapPin size={16} /> {pending ? "Starting..." : "Check my Business Profile"}
      </Button>
    </form>
  );
}
