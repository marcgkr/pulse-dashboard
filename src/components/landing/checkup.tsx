"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Check, CheckGroup } from "@/lib/agents/site-audit";
import type { Prescription } from "@/lib/ai";
import { EcgTrace, Meter, ScoreDial } from "../brand";
import { RxSlip } from "../rx-slip";
import { Badge, Label, cx, scoreColor } from "../ui";

type CheckupResult = {
  host: string;
  score: number;
  groupScores: Record<CheckGroup, number>;
  platform: string;
  topIssues: Check[];
  prescriptions: Prescription[];
};

type Phase = "idle" | "running" | "done" | "error";

// The steps auditSite actually performs, in order. Shown while the request runs.
const STEPS = [
  "Opening your homepage",
  "Reading up to 3 inner pages",
  "Checking robots.txt, sitemap and llms.txt",
  "Looking for contact options and tracking tags",
  "Scoring what we found",
];

const GROUP_ORDER: CheckGroup[] = ["Technical", "On-page", "Conversion", "Tracking", "AI search"];
const GROUP_LABEL: Record<CheckGroup, string> = {
  Technical: "Technical health",
  "On-page": "On-page SEO",
  Conversion: "Enquiry paths",
  Tracking: "Tracking",
  "AI search": "AI search readiness",
};

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The hero: `intro` sits beside the chart card; results open full width underneath. */
export function Checkup({ intro }: { intro: ReactNode }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CheckupResult | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [beat, setBeat] = useState(0);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const running = phase === "running";

  // Elapsed clock + re-draw the trace every 2.6s while the checkup runs.
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    const trace = setInterval(() => setBeat((b) => b + 1), 2600);
    return () => {
      clearInterval(clock);
      clearInterval(trace);
    };
  }, [running]);

  useEffect(() => {
    if (phase === "done") resultsRef.current?.focus();
  }, [phase]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (running) return;
    const value = url.trim();
    if (!value) {
      setPhase("error");
      setError("Enter your website address, for example yourclinic.sg.");
      inputRef.current?.focus();
      return;
    }
    setPhase("running");
    setError("");
    setResult(null);
    setElapsed(0);
    setBeat((b) => b + 1);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65_000);
    try {
      const res = await fetch("/api/checkup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as (CheckupResult & { error?: string }) | null;
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || `The checkup didn't finish (error ${res.status}). Try again in a minute.`);
      }
      setResult(data);
      setPhase("done");
    } catch (err) {
      const aborted = (err as Error).name === "AbortError";
      setError(aborted ? "The checkup took too long. Check the site loads in your browser, then try again." : (err as Error).message);
      setPhase("error");
    } finally {
      clearTimeout(timer);
    }
  }

  const stepIndex = Math.min(STEPS.length - 1, Math.floor(elapsed / 4));
  const statusLine =
    phase === "running"
      ? STEPS[stepIndex]
      : phase === "done" && result
        ? `Checkup complete: ${result.host}`
        : phase === "error"
          ? "No reading. See the message below."
          : "Waiting for a website address";

  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
        <div>{intro}</div>
        <div className="min-w-0">
          {/* The chart card */}
          <div className="overflow-hidden rounded-lg border border-ink/80 bg-card shadow-[0_1px_0_rgb(14_26_36/0.04),0_12px_32px_-12px_rgb(14_26_36/0.18)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 md:px-5">
              <Label className="text-ink">Patient chart</Label>
              <Label>
                <span className="hidden sm:inline">Site Doctor · </span>Free checkup
              </Label>
            </div>

            <form onSubmit={submit} className="p-4 md:p-5" noValidate>
              <label htmlFor="checkup-url" className="mb-2 block font-display text-xl font-semibold tracking-tight md:text-2xl">
                Check your website&apos;s pulse
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wider text-ink-3" aria-hidden>
                    URL
                  </span>
                  <input
                    ref={inputRef}
                    id="checkup-url"
                    name="url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="yourclinic.sg"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    aria-invalid={phase === "error" || undefined}
                    aria-describedby={phase === "error" ? "checkup-error" : "checkup-hint"}
                    className="h-12 w-full rounded-md border border-line bg-white pl-12 pr-3 font-mono text-[15px] text-ink placeholder:text-ink-3/60 focus:border-scrub focus:outline-none focus:ring-2 focus:ring-scrub/25"
                  />
                </div>
                <button
                  type="submit"
                  disabled={running}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-scrub px-5 text-[15px] font-semibold text-white transition hover:bg-scrub-dark disabled:opacity-70 motion-reduce:transition-none"
                >
                  {running ? "Checking..." : "Run free checkup"}
                  {!running && <ArrowRight size={17} aria-hidden />}
                </button>
              </div>
              <p id="checkup-hint" className="mt-2 text-xs text-ink-3">
                No sign-up. Takes about 20 to 40 seconds. We only read public pages.
              </p>
            </form>

            {/* Bedside monitor strip */}
            <div
              className="relative border-t border-ink bg-ink px-4 pb-3 pt-2.5 text-white md:px-5"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            >
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
                <span className="inline-flex items-center gap-2">
                  <span className={cx("h-1.5 w-1.5 rounded-full", running ? "blip bg-pulse" : phase === "done" ? "bg-[#5fd0b4]" : "bg-white/30")} aria-hidden />
                  {running ? "Live" : phase === "done" ? "Reading taken" : "Standby"}
                </span>
                <span className="tabular-nums">{running || phase === "done" ? mmss(elapsed) : "--:--"}</span>
              </div>
              <div className="mt-1 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <EcgTrace key={running ? `run-${beat}` : phase} flat={phase === "idle" || phase === "error"} className="h-14 md:h-16" />
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Score</div>
                  <div
                    className="font-mono text-3xl font-semibold tabular-nums leading-none"
                    style={{ color: phase === "done" && result ? scoreColor(result.score) : "rgb(255 255 255 / 0.35)" }}
                  >
                    {phase === "done" && result ? result.score : "--"}
                  </div>
                </div>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-white/75" aria-live="polite">
                {statusLine}
                {running && <span aria-hidden>...</span>}
              </p>
            </div>
          </div>

          {phase === "error" && error && (
            <div id="checkup-error" role="alert" className="mt-4 flex items-start gap-3 rounded-md border border-pulse/30 bg-pulse/5 px-4 py-3 text-sm text-ink">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-pulse" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {phase === "done" && result && <Results result={result} headingRef={resultsRef} />}
    </div>
  );
}

function Results({ result, headingRef }: { result: CheckupResult; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const signupHref = `/signup?website=${encodeURIComponent(result.host)}`;
  return (
    <section aria-labelledby="checkup-results" className="mt-10 rounded-lg border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-6">
        <h2 id="checkup-results" ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold tracking-tight focus:outline-none">
          Results for {result.host}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge>Built with {result.platform}</Badge>
          <Badge tone="ink">Free checkup</Badge>
        </div>
      </div>

      <div className="grid gap-8 p-4 md:p-6 lg:grid-cols-[auto_1fr_1.25fr]">
        <div className="flex flex-col items-center gap-2 lg:items-start">
          <ScoreDial score={result.score} size={148} label="Site health" />
          <p className="max-w-[16rem] text-center text-sm text-ink-2 lg:text-left">
            {result.score >= 75
              ? "In good shape. A few fixes will tighten it up."
              : result.score >= 50
                ? "Working, but losing enquiries it should be getting."
                : "Several basics are missing. Start with the slips below."}
          </p>
        </div>

        <div>
          <Label className="mb-3">By area</Label>
          <div className="space-y-3.5">
            {GROUP_ORDER.map((g) => (
              <Meter key={g} label={GROUP_LABEL[g]} value={result.groupScores[g] ?? null} />
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-3">Top findings</Label>
          {result.topIssues.length === 0 ? (
            <p className="text-sm text-ink-2">Every check we ran passed. Nice work.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {result.topIssues.map((c) => (
                <li key={c.id} className="flex gap-3 py-2.5">
                  <Badge tone={c.status === "fail" ? "red" : "amber"} className="mt-0.5 h-fit shrink-0">
                    {c.status === "fail" ? "Fail" : "Warn"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{c.label}</p>
                    <p className="break-words text-sm text-ink-2">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {result.prescriptions.length > 0 && (
        <div className="border-t border-line px-4 py-6 md:px-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold tracking-tight">Your first {result.prescriptions.length === 1 ? "prescription" : `${result.prescriptions.length} prescriptions`}</h3>
            <Label>Steps written for {result.platform}</Label>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {result.prescriptions.map((p, i) => (
              <RxSlip key={p.title} data={p} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-b-lg border-t border-scrub/20 bg-mint px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-2xl text-[15px] text-ink">
          <strong className="font-semibold">This is the short version.</strong> A free account runs the full Site Doctor checkup on more pages and puts every fix on a
          prescription board you can tick off, with a re-check date for each.
        </p>
        <Link
          href={signupHref}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-scrub px-5 py-3 text-[15px] font-semibold text-white hover:bg-scrub-dark"
        >
          Get the full prescription, free <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
