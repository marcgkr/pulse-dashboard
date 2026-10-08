"use client";

import { useState } from "react";
import { FileUp, Search } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "../ui";
import { FormError, useRunAgent } from "../run-agent";
import type { FormProps } from "./types";

function seedsText(v: unknown, fallback: string): string {
  if (Array.isArray(v) && v.length) return v.map(String).join("\n");
  if (typeof v === "string" && v.trim()) return v;
  return fallback
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

/** Reads a CSV export. Keyword Planner exports are UTF-16, so detect the byte order mark. */
async function readExport(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf.slice(0, 2));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

export function KeywordsForm({ profile, lastInput }: FormProps) {
  const li = lastInput ?? {};
  const [seeds, setSeeds] = useState(seedsText(li.seeds, profile.offers || profile.industry));
  const [location, setLocation] = useState((li.location as string) || profile.location || "Singapore");
  const [focus, setFocus] = useState<"discover" | "expand">(li.focus === "expand" ? "expand" : "discover");
  const [expand, setExpand] = useState((li.expand as string) || "");
  const [data, setData] = useState((li.data as string) || "");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const { start, pending, error } = useRunAgent("keywords");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start({ seeds, location, focus, expand: focus === "expand" ? expand : "", data });
      }}
    >
      <Field label="What do you want to do?">
        <Select value={focus} onChange={(e) => setFocus(e.target.value as "discover" | "expand")}>
          <option value="discover">Find new keywords for my services</option>
          <option value="expand">Expand one keyword in depth</option>
        </Select>
      </Field>

      {focus === "expand" && (
        <Field label="Keyword to expand" hint="We go deep on price, near me, best, reviews, vs and question variants of this one phrase.">
          <Input value={expand} onChange={(e) => setExpand(e.target.value)} placeholder="e.g. hydrafacial tampines" required />
        </Field>
      )}

      <Field label={focus === "expand" ? "Your other services (for context)" : "Services or topics"} hint="One per line. Start with what earns you the most.">
        <Textarea value={seeds} onChange={(e) => setSeeds(e.target.value)} rows={4} placeholder={"lash extensions\nbrow embroidery"} required={focus !== "expand"} />
      </Field>

      <Field label="Target location" hint="Neighbourhood first if you serve one area, e.g. 'Tampines, Singapore'.">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Singapore" />
      </Field>

      <Field
        label="Your search data (optional)"
        hint="Search Console: Performance > Search results > Queries tab > Export. Keyword Planner: download the results. Paste the table or upload the CSV. This is where real numbers come from."
      >
        <Textarea
          value={data}
          onChange={(e) => setData(e.target.value)}
          rows={5}
          className="font-mono text-xs"
          placeholder={"Top queries,Clicks,Impressions,CTR,Position\nhydrafacial tampines,12,340,3.5%,8.2"}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-card px-3 py-1.5 font-semibold text-ink-2 hover:border-ink-3">
          <FileUp size={15} /> Upload CSV
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const text = await readExport(f);
                setData(text.slice(0, 120_000));
                setFileNote(`Loaded ${f.name}`);
              } catch {
                setFileNote("Couldn't read that file. Paste the table instead.");
              }
              e.target.value = "";
            }}
          />
        </label>
        {fileNote && <span className="text-xs text-ink-3">{fileNote}</span>}
        {data && (
          <button type="button" className="text-xs text-ink-3 underline hover:text-ink" onClick={() => { setData(""); setFileNote(null); }}>
            Clear data
          </button>
        )}
      </div>

      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        <Search size={16} /> {pending ? "Starting..." : focus === "expand" ? "Expand keyword" : "Find keywords"}
      </Button>
    </form>
  );
}
