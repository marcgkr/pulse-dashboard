"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, Label, ReportSection, cx } from "../ui";
import { CopyButton } from "../copy-button";
import { FeedbackBar, type ItemFeedback } from "../feedback-bar";
import { FormError, useRunAgent } from "../run-agent";
import type { Reference } from "@/lib/social-links";
import { beatsFromLines, defaultShootStyle, fixBeat, spokenScript, type Beat, type ShootStyle } from "@/lib/script-beats";
import { ReferenceCard } from "./reference-card";
import type { ReportProps } from "./index";

type Trend = {
  name: string;
  what_it_is: string;
  how_to_use_it: string;
  platform: string;
  shelf_life: string;
  /** Real posts showing the trend. Older reports have none. */
  examples?: Reference[];
};
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
  /** Script beat by beat and how to shoot it. Older reports have only script_or_outline. */
  beats?: Beat[];
  shoot_style?: ShootStyle;
  /** What this idea borrows from what is working now, and why. Older reports have none. */
  trend_basis?: string;
  references?: Reference[];
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

/** Feedback keys: ideas use their title, trends are prefixed so the two can't clash. */
const trendKey = (name: string) => `Trend: ${name}`;

export function ContentReport({ result, run, feedback = {} }: ReportProps) {
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
    // The public sample report (/sample) has no account behind it: send visitors to sign up.
    if (run.id === "sample") return window.location.assign("/signup?from=sample");
    setMoreFor(title);
    void start({ ...run.input, more_like: title }, run.id);
  };

  return (
    <div className="space-y-8">
      {/* Trends */}
      {(trends.length > 0 || r.trends_note) && (
        <ReportSection title="Trending now" hint="What is getting traction on your platforms this month, and how to use it for your business.">
          {trends.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {trends.map((t, i) => (
                <Card key={i} className="flex flex-col p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="ink">{t.platform}</Badge>
                    <Badge tone={SHELF_TONE[t.shelf_life] ?? "neutral"}>{t.shelf_life}</Badge>
                  </div>
                  <p className="font-display text-lg font-semibold leading-snug">{t.name}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{t.what_it_is}</p>
                  <div className="mt-3 border-t border-line pt-3">
                    <Label className="mb-1">How to use it</Label>
                    <p className="text-[15px] leading-relaxed">{t.how_to_use_it}</p>
                  </div>
                  {(t.examples?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2">Posts showing it</Label>
                      <div className="space-y-2">
                        {t.examples!.map((ex, k) => (
                          <ReferenceCard key={k} r={ex} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-auto pt-4">
                    <FeedbackBar
                      runId={run.id}
                      item={trendKey(t.name)}
                      agentName="Social Media Content"
                      initial={feedback[trendKey(t.name)]}
                      placeholder="e.g. This isn't a trend in our area, or our customers would find this format too casual."
                    />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-5 text-[15px] leading-relaxed text-ink-2">{r.trends_note}</Card>
          )}
        </ReportSection>
      )}

      {/* Pillar mix */}
      {pillars.length > 0 && (
        <ReportSection title="Content pillar mix" hint="How to split your posts across the month so you are not only selling.">
          <Card className="p-5">
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
                    <p className="text-[15px] leading-relaxed text-ink-2">{p.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </ReportSection>
      )}

      {/* Ideas */}
      {ideas.length > 0 && (
        <ReportSection
          title={r.more_like ? `Variations on "${r.more_like}"` : "Post ideas"}
          hint="Each idea has two halves: what to film or design, then what to paste when you post it."
        >
          <FormError error={error} />
          <div className="space-y-5">
            {ideas.map((idea, i) => (
              <IdeaCard
                key={i}
                idea={idea}
                n={i + 1}
                runId={run.id}
                initialFeedback={feedback[idea.title]}
                pillarColor={pillarColor(idea.pillar)}
                pending={pending}
                starting={pending && moreFor === idea.title}
                onMore={() => moreLike(idea.title)}
              />
            ))}
          </div>
        </ReportSection>
      )}

      {/* Calendar */}
      {calendar.length > 0 && <CalendarSection calendar={calendar} ideaIndex={ideaIndex} />}

      {/* Sources */}
      {sources.length > 0 && (
        <ReportSection title="Sources checked">
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
        </ReportSection>
      )}
    </div>
  );
}

/** One cell of a script beat. On phones each cell carries its own label. */
function BeatCell({ label, text, quote, screen }: { label: string; text: string; quote?: boolean; screen?: boolean }) {
  return (
    <div className={cx("px-3 py-2.5 md:border-l md:border-line", !text && "hidden md:block")}>
      <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-2 md:hidden">{label}</span>
      {text ? (
        screen ? (
          <span className="inline-block rounded-lg bg-ink px-2 py-1 text-[14px] font-semibold leading-snug text-white">{text}</span>
        ) : (
          <p className={cx("text-[15px] leading-relaxed", quote ? "font-semibold text-ink" : "text-ink-2")}>{quote ? <>&ldquo;{text}&rdquo;</> : text}</p>
        )
      ) : (
        <span className="text-ink-3" aria-label="Nothing">
          -
        </span>
      )}
    </div>
  );
}

/** Small heading for one half of an idea card. */
function Half({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-2">{children}</p>;
}

function IdeaCard({
  idea,
  n,
  runId,
  initialFeedback,
  pillarColor,
  pending,
  starting,
  onMore,
}: {
  idea: Idea;
  n: number;
  runId: string;
  initialFeedback?: ItemFeedback;
  pillarColor: string;
  pending: boolean;
  starting: boolean;
  onMore: () => void;
}) {
  const isVideo = /video|reel|tiktok|short|live|story/i.test(idea.format);
  const [verdict, setVerdict] = useState(initialFeedback?.verdict ?? null);
  // Older reports have one line per beat; split them the same way a live report arrives.
  const text = /text post|thread/i.test(idea.format);
  const beats = (text ? [] : (idea.beats ?? beatsFromLines(idea.script_or_outline))).map(fixBeat).map((b, k) =>
    // "Say the hook" in the first beat: put the hook's words where they're said.
    k === 0 && !b.say && /\bhook\b/i.test(b.shot) ? { ...b, say: idea.hook } : b,
  );
  const style = text ? null : (idea.shoot_style ?? defaultShootStyle(idea.format, idea.platform));
  const spoken = spokenScript(beats);
  const refs = idea.references ?? [];
  return (
    <Card id={ideaAnchor(n - 1)} className={cx("scroll-mt-32 overflow-hidden transition", verdict === "reject" && "opacity-70 ring-pulse/40")}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 pt-5 md:px-6">
        <span className="mr-1 font-display text-2xl font-extrabold leading-none tabular-nums text-ink/25" aria-label={`Idea ${n}`}>
          {String(n).padStart(2, "0")}
        </span>
        <Badge tone="ink">{idea.platform}</Badge>
        <Badge>{idea.format}</Badge>
        <Badge>
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: pillarColor }} />
          {idea.pillar}
        </Badge>
        <span className="ml-auto text-[13px] text-ink-2">
          Effort: <span className="font-semibold text-ink">{idea.effort}</span>
        </span>
      </header>
      <div className="flex flex-col gap-3 px-5 pt-3 md:flex-row md:items-start md:justify-between md:px-6">
        <h4 className="text-[15px] font-semibold text-ink-2 md:pt-2">{idea.title}</h4>
        <div className="md:max-w-sm md:shrink-0">
          <FeedbackBar
            runId={runId}
            item={idea.title}
            agentName="Social Media Content"
            initial={initialFeedback}
            onChange={(f) => setVerdict(f?.verdict ?? null)}
            placeholder="e.g. Good topic, but we never film customers. Or: the price angle is wrong, we quote after a site visit."
          />
        </div>
      </div>

      {(idea.trend_basis || refs.length > 0) && (
        <div className="mx-5 mt-4 rounded-2xl bg-paper p-4 md:mx-6">
          <Label className="mb-1">Why this, now</Label>
          {idea.trend_basis && <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2">{idea.trend_basis}</p>}
          {refs.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {refs.map((ref, k) => (
                <ReferenceCard key={k} r={ref} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1. The hook */}
      <section className="mt-4 border-t border-line p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <Half>{isVideo ? "Open with" : "Lead with"}</Half>
          <CopyButton text={idea.hook} label="Copy hook" />
        </div>
        <p className="max-w-[40ch] font-display text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink md:text-[28px]">&ldquo;{idea.hook}&rdquo;</p>
        <p className="mt-1.5 text-[13px] text-ink-2">{isVideo ? "Say it and show it as text in the first two seconds." : "The first line or first slide."}</p>
      </section>

      {/* 2. How to shoot or design it */}
      {style && (
        <section className="border-t border-line bg-paper/60 p-5 md:p-6">
          <Half>{isVideo ? "How to shoot it" : "How to make it"}</Half>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Format", style.format],
                ["Where", style.setting],
                ["Camera", style.camera],
                ["Who", style.people],
                ["Sound", style.sound],
                ["Editing", style.editing],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2">{k}</dt>
                  <dd className="mt-0.5 text-[15px] leading-relaxed text-ink">{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {/* 3. The script, beat by beat */}
      {beats.length > 0 ? (
        <section className="border-t border-line p-5 md:p-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <Half>{isVideo ? "Script, beat by beat" : "Slide by slide"}</Half>
            {spoken && <CopyButton text={spoken} label="Copy spoken script" />}
          </div>
          <div className="overflow-hidden rounded-2xl ring-1 ring-line">
            <div className="hidden grid-cols-[5.5rem_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)] bg-paper text-xs font-bold uppercase tracking-[0.06em] text-ink-2 md:grid">
              <div className="px-3 py-2.5">{isVideo ? "When" : "Slide"}</div>
              <div className="border-l border-line px-3 py-2.5">{isVideo ? "Film" : "Show"}</div>
              <div className="border-l border-line px-3 py-2.5">Say</div>
              <div className="border-l border-line px-3 py-2.5">On screen</div>
            </div>
            <ol>
              {beats.map((b, k) => (
                <li key={k} className="grid border-t border-line first:border-t-0 md:grid-cols-[5.5rem_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:first:border-t">
                  <div className="flex items-center gap-2 bg-paper/50 px-3 py-2.5 md:block md:bg-transparent">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums text-ink"
                      style={{ background: "var(--rx-accent, var(--color-mint))" }}
                    >
                      {b.time || "Tip"}
                    </span>
                  </div>
                  <BeatCell label={isVideo ? "Film" : "Show"} text={b.shot} />
                  <BeatCell label="Say" text={b.say} quote />
                  <BeatCell label="On screen" text={b.on_screen} screen />
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        idea.script_or_outline.length > 0 && (
          <section className="border-t border-line p-5 md:p-6">
            <Half>Outline</Half>
            <ol className="space-y-2.5">
              {idea.script_or_outline.map((step, k) => (
                <li key={k} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-ink"
                    style={{ background: "var(--rx-accent, var(--color-mint))" }}
                  >
                    {k + 1}
                  </span>
                  <span className="min-w-0 max-w-prose break-words text-[15px] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )
      )}

      {/* 4. What to paste, and why it works */}
      <div className="grid border-t border-line lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="p-5 md:p-6 lg:border-r lg:border-line">
          <Half>Post this</Half>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label>Caption</Label>
            <CopyButton text={idea.caption} label="Copy caption" />
          </div>
          <p className="whitespace-pre-wrap break-words rounded-2xl bg-paper px-4 py-3 text-[15px] leading-relaxed ring-1 ring-line">{idea.caption}</p>

          {idea.hashtags.length > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Label>Hashtags ({idea.hashtags.length})</Label>
                <CopyButton text={idea.hashtags.join(" ")} label="Copy hashtags" />
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {idea.hashtags.map((h) => (
                  <li key={h} className="break-all rounded-lg bg-card px-2 py-1 text-[13px] font-medium text-scrub-dark ring-1 ring-line">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <Label className="mb-1">Call to action</Label>
            <p className="text-[15px] font-semibold leading-relaxed">{idea.cta}</p>
          </div>
        </section>

        <section className="border-t border-line bg-paper/60 p-5 md:p-6 lg:border-t-0">
          <Label className="mb-1">Why it works</Label>
          <p className="max-w-prose text-[15px] leading-relaxed text-ink-2">{idea.why_it_works}</p>
          {idea.compliance_note && (
            <p className="mt-5 flex gap-2 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm leading-relaxed text-[#8a5410]">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>{idea.compliance_note}</span>
            </p>
          )}
        </section>
      </div>

      <footer className="flex justify-end border-t border-line px-5 py-3 md:px-6">
        <Button type="button" variant="secondary" disabled={pending} onClick={onMore}>
          <Sparkles size={15} /> {starting ? "Starting..." : "More like this"}
        </Button>
      </footer>
    </Card>
  );
}

function SlotLink({ s, ideaIndex, compact }: { s: Slot; ideaIndex: (t: string) => number; compact?: boolean }) {
  const i = ideaIndex(s.idea_title);
  const body = (
    <>
      <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-2">{s.platform}</span>
      <span className={cx("mt-0.5 block break-words leading-snug", compact ? "text-[13px]" : "text-sm")}>{s.idea_title}</span>
    </>
  );
  return i >= 0 ? (
    <a href={`#${ideaAnchor(i)}`} className="block rounded-xl border border-scrub/20 bg-mint px-2.5 py-2 text-ink hover:border-scrub">
      {body}
    </a>
  ) : (
    <div className="rounded-xl border border-line bg-paper px-2.5 py-2">{body}</div>
  );
}

function CalendarSection({ calendar, ideaIndex }: { calendar: Slot[]; ideaIndex: (t: string) => number }) {
  const parsed = calendar.map((s) => ({ ...s, pos: parseDay(s.day) }));
  const unplaced = parsed.filter((s) => !s.pos);

  return (
    <ReportSection title="2-week posting calendar" hint="Tap a post to jump to its idea.">

      {/* Desktop grid */}
      <Card className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-paper text-[13px] font-semibold text-ink-2">
          <div className="px-2 py-2" />
          {DAYS.map((d) => (
            <div key={d} className="border-l border-line px-2.5 py-2.5">
              {d}
            </div>
          ))}
        </div>
        {[1, 2].map((w) => (
          <div key={w} className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] border-b border-line last:border-0">
            <div className="px-3 py-3 text-[13px] font-semibold text-ink">Week {w}</div>
            {DAYS.map((_, d) => {
              const slots = parsed.filter((s) => s.pos?.week === w && s.pos.dow === d);
              return (
                <div key={d} className="min-h-24 space-y-1.5 border-l border-line p-2">
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
              <div className="px-4 py-2.5 text-sm font-semibold">Week {w}</div>
              {slots.map((s, k) => (
                <div key={k} className="flex items-start gap-3 px-3 py-2">
                  <span className="w-10 shrink-0 pt-2 text-sm font-semibold text-ink-2">{DAYS[s.pos!.dow]}</span>
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
              <span className="w-24 shrink-0 pt-2 text-sm font-semibold text-ink-2">{s.day}</span>
              <div className="min-w-0 flex-1">
                <SlotLink s={s} ideaIndex={ideaIndex} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </ReportSection>
  );
}
