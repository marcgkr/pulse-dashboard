"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, Label, cx } from "../ui";
import { CopyButton } from "../copy-button";
import { FormError, useRunAgent } from "../run-agent";
import type { ReportProps } from "./index";

type Trend = { name: string; what_it_is: string; how_to_use_it: string; platform: string; shelf_life: string };
type Pillar = { name: string; percent: number; description: string };
type Idea = {
  title: string;
  platform: string;
  format: string;
  pillar: string;
  hook: string;
  script_or_outline: string[];
  caption: string;
  hashtags: string[];
  cta: string;
  why_it_works: string;
  effort: string;
  compliance_note: string;
};
type Slot = { day: string; idea_title: string; platform: string };
type ContentResult = {
  trends?: Trend[];
  trends_note?: string;
  pillars?: Pillar[];
  ideas?: Idea[];
  calendar?: Slot[];
  sources?: { title: string; url: string }[];
  more_like?: string;
  demo?: boolean;
};

const PILLAR_COLORS = ["var(--color-scrub)", "var(--color-amber)", "var(--color-ink-2)", "var(--color-ink-3)"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHELF_TONE: Record<string, "red" | "amber" | "green"> = { "this week": "red", "this month": "amber", evergreen: "green" };

function ideaAnchor(i: number) {
  return `idea-${i + 1}`;
}

function parseDay(day: string): { week: number; dow: number } | null {
  const m = /week\s*(\d+)\D*(mon|tue|wed|thu|fri|sat|sun)/i.exec(day);
  if (!m) return null;
  const week = Number(m[1]);
  const dow = DAYS.findIndex((d) => d.toLowerCase() === m[2].toLowerCase());
  return week >= 1 && week <= 2 && dow >= 0 ? { week, dow } : null;
}

export function ContentReport({ result, run }: ReportProps) {
  const r = result as ContentResult;
  const trends = r.trends ?? [];
  const pillars = r.pillars ?? [];
  const ideas = r.ideas ?? [];
  const calendar = r.calendar ?? [];
  const sources = r.sources ?? [];
  const { start, pending, error } = useRunAgent("content");
  const [moreFor, setMoreFor] = useState<string | null>(null);

  const pillarColor = (name: string) => {
    const i = pillars.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    return i >= 0 ? PILLAR_COLORS[i % PILLAR_COLORS.length] : "var(--color-line)";
  };
  const ideaIndex = (title: string) => ideas.findIndex((x) => x.title.toLowerCase() === title.toLowerCase());

  const moreLike = (title: string) => {
    setMoreFor(title);
    void start({ ...run.input, more_like: title }, run.id);
  };

  return (
    <div className="space-y-8">
      {/* Trends */}
      {(trends.length > 0 || r.trends_note) && (
        <section>
          <Label className="mb-2">Trending now</Label>
          {trends.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {trends.map((t, i) => (
                <Card key={i} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="ink">{t.platform}</Badge>
                    <Badge tone={SHELF_TONE[t.shelf_life] ?? "neutral"}>{t.shelf_life}</Badge>
                  </div>
                  <p className="font-display text-lg font-semibold leading-snug">{t.name}</p>
                  <p className="mt-1 text-sm text-ink-2">{t.what_it_is}</p>
                  <div className="mt-3 border-t border-line pt-2">
                    <Label className="mb-0.5">How to use it</Label>
                    <p className="text-sm">{t.how_to_use_it}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 text-sm text-ink-2">{r.trends_note}</Card>
          )}
        </section>
      )}

      {/* Pillar mix */}
      {pillars.length > 0 && (
        <section>
          <Label className="mb-2">Content pillar mix</Label>
          <Card className="p-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={pillars.map((p) => `${p.name} ${p.percent}%`).join(", ")}>
              {pillars.map((p, i) => (
                <div key={i} style={{ width: `${p.percent}%`, background: PILLAR_COLORS[i % PILLAR_COLORS.length] }} className="h-full border-r-2 border-card last:border-r-0" />
              ))}
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {pillars.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PILLAR_COLORS[i % PILLAR_COLORS.length] }} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="font-mono text-sm tabular-nums text-ink-3">{p.percent}%</span>
                    </div>
                    <p className="text-sm text-ink-2">{p.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Ideas */}
      {ideas.length > 0 && (
        <section>
          <Label className="mb-2">{r.more_like ? `Variations on "${r.more_like}"` : "Post ideas"}</Label>
          <FormError error={error} />
          <div className="mt-2 space-y-4">
            {ideas.map((idea, i) => (
              <Card key={i} id={ideaAnchor(i)} className="scroll-mt-6 overflow-hidden">
                <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
                  <span className="mr-1 font-mono text-xs tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <Badge tone="ink">{idea.platform}</Badge>
                  <Badge>{idea.format}</Badge>
                  <Badge tone="green">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: pillarColor(idea.pillar) }} />
                    {idea.pillar}
                  </Badge>
                  <Badge>{idea.effort}</Badge>
                </div>

                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink-2">{idea.title}</p>
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <p className="font-display text-xl font-semibold leading-snug text-ink md:text-2xl">&ldquo;{idea.hook}&rdquo;</p>
                      <CopyButton text={idea.hook} label="Hook" />
                    </div>
                  </div>

                  {idea.script_or_outline.length > 0 && (
                    <details className="group rounded-md border border-line">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                        <span>{/video|reel|tiktok|short|live/i.test(idea.format) ? "Shot list" : "Outline"} ({idea.script_or_outline.length} steps)</span>
                        <ChevronDown size={16} className="text-ink-3 transition group-open:rotate-180" />
                      </summary>
                      <ol className="space-y-1.5 border-t border-line px-3 py-3 text-sm">
                        {idea.script_or_outline.map((s, k) => (
                          <li key={k} className="flex gap-2">
                            <span className="w-5 shrink-0 font-mono text-xs leading-5 text-ink-3">{k + 1}.</span>
                            <span className="min-w-0 break-words">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Label>Caption</Label>
                      <CopyButton text={idea.caption} label="Copy caption" />
                    </div>
                    <p className="whitespace-pre-wrap break-words rounded-md border border-line bg-paper px-3 py-2.5 text-sm">{idea.caption}</p>
                  </div>

                  {idea.hashtags.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Label>Hashtags ({idea.hashtags.length})</Label>
                        <CopyButton text={idea.hashtags.join(" ")} label="Copy hashtags" />
                      </div>
                      <p className="break-words font-mono text-xs leading-relaxed text-scrub-dark">{idea.hashtags.join(" ")}</p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-0.5">Call to action</Label>
                      <p className="text-sm">{idea.cta}</p>
                    </div>
                    <div>
                      <Label className="mb-0.5">Why it works</Label>
                      <p className="text-sm text-ink-2">{idea.why_it_works}</p>
                    </div>
                  </div>

                  {idea.compliance_note && (
                    <p className="flex gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-[#8a5410]">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                      <span>{idea.compliance_note}</span>
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => moreLike(idea.title)}>
                      <Sparkles size={15} /> {pending && moreFor === idea.title ? "Starting..." : "More like this"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Calendar */}
      {calendar.length > 0 && <CalendarSection calendar={calendar} ideaIndex={ideaIndex} />}

      {/* Sources */}
      {sources.length > 0 && (
        <section>
          <Label className="mb-2">Sources checked</Label>
          <Card className="divide-y divide-line">
            {sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 px-4 py-2.5 text-sm hover:bg-mint/50">
                <ExternalLink size={14} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block break-words">{s.title || s.url}</span>
                  <span className="block truncate font-mono text-[11px] text-ink-3">{s.url}</span>
                </span>
              </a>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function SlotLink({ s, ideaIndex, compact }: { s: Slot; ideaIndex: (t: string) => number; compact?: boolean }) {
  const i = ideaIndex(s.idea_title);
  const body = (
    <>
      <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-3">{s.platform}</span>
      <span className={cx("block break-words leading-snug", compact ? "text-xs" : "text-sm")}>{s.idea_title}</span>
    </>
  );
  return i >= 0 ? (
    <a href={`#${ideaAnchor(i)}`} className="block rounded border border-scrub/20 bg-mint px-2 py-1.5 text-ink hover:border-scrub">
      {body}
    </a>
  ) : (
    <div className="rounded border border-line bg-paper px-2 py-1.5">{body}</div>
  );
}

function CalendarSection({ calendar, ideaIndex }: { calendar: Slot[]; ideaIndex: (t: string) => number }) {
  const parsed = calendar.map((s) => ({ ...s, pos: parseDay(s.day) }));
  const unplaced = parsed.filter((s) => !s.pos);

  return (
    <section>
      <Label className="mb-2">2-week posting calendar</Label>

      {/* Desktop grid */}
      <Card className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-paper font-mono text-[11px] uppercase tracking-wider text-ink-3">
          <div className="px-2 py-2" />
          {DAYS.map((d) => (
            <div key={d} className="border-l border-line px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        {[1, 2].map((w) => (
          <div key={w} className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] border-b border-line last:border-0">
            <div className="px-2 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">Week {w}</div>
            {DAYS.map((_, d) => {
              const slots = parsed.filter((s) => s.pos?.week === w && s.pos.dow === d);
              return (
                <div key={d} className="min-h-20 space-y-1 border-l border-line p-1.5">
                  {slots.map((s, k) => (
                    <SlotLink key={k} s={s} ideaIndex={ideaIndex} compact />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* Mobile list */}
      <div className="space-y-4 md:hidden">
        {[1, 2].map((w) => {
          const slots = parsed.filter((s) => s.pos?.week === w).sort((a, b) => a.pos!.dow - b.pos!.dow);
          if (!slots.length) return null;
          return (
            <Card key={w} className="divide-y divide-line">
              <div className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">Week {w}</div>
              {slots.map((s, k) => (
                <div key={k} className="flex items-start gap-3 px-3 py-2">
                  <span className="w-9 shrink-0 pt-1.5 font-mono text-xs font-semibold">{DAYS[s.pos!.dow]}</span>
                  <div className="min-w-0 flex-1">
                    <SlotLink s={s} ideaIndex={ideaIndex} />
                  </div>
                </div>
              ))}
            </Card>
          );
        })}
      </div>

      {unplaced.length > 0 && (
        <Card className="mt-3 divide-y divide-line">
          {unplaced.map((s, k) => (
            <div key={k} className="flex items-start gap-3 px-3 py-2">
              <span className="w-24 shrink-0 pt-1.5 font-mono text-xs">{s.day}</span>
              <div className="min-w-0 flex-1">
                <SlotLink s={s} ideaIndex={ideaIndex} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
