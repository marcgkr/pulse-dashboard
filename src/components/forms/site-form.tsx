"use client";

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { Button, Field, Input } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";

export function SiteForm({ profile, lastInput }: FormProps) {
  const [url, setUrl] = useState((lastInput?.url as string) || profile.website);
  const { start, pending, error } = useRunAgent("site");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start({ url });
      }}
    >
      <Field label="Website to check" hint="We read the homepage and up to 6 inner pages.">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbusiness.com.sg" required />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        <Stethoscope size={16} /> {pending ? "Starting..." : "Run checkup"}
      </Button>
    </form>
  );
}
