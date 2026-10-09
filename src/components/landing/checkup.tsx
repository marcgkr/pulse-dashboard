"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { Check, CheckGroup } from "@/lib/agents/site-audit";
import type { Prescription } from "@/lib/ai";
import type { Market } from "@/lib/markets";
import { Meter, ScoreDial } from "../brand";
import { RxSlip } from "../rx-slip";
import { Badge, cx } from "../ui";
import { Heartbeat, type BeatState } from "./heartbeat";
import { exampleSite, signupHref } from "./market-copy";

type CheckupResult = {
  host: string;
  score: number;
  groupScores: Record<CheckGroup, number>;
  platform: string;
  topIssues: Check[];
  prescriptions: Prescription[];
  country?: string | null;
};

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

/**
 * The hero's live checkup. `intro` (eyebrow, headline, lead) sits on top; the heartbeat runs
 * into the URL capsule; results open full width underneath.
 */
export function Checkup({ intro, market }: { intro: ReactNode; market: Market }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<BeatState>("idle");
  const [result, setResult] = useState<CheckupResult | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const example = exampleSite(market);

  const running = phase === "running";

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(clock);
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
      setError(`Enter your website address, for example ${example}.`);
      inputRef.current?.focus();
      return;
    }
    setPhase("running");
    setError("");
    setResult(null);
    setElapsed(0);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65_000);
    try {
      const res = await fetch("/api/checkup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value, country: market.code }),
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

  return (
    <div>
      {intro}

      {/* Heartbeat running into the URL capsule */}
      <form onSubmit={submit} noValidate className="rise mt-10 md:mt-14" style={{ animationDelay: "320ms" }}>
        <label htmlFor="checkup-url" className="mb-3 block font-display text-xl font-bold tracking-tight md:ml-auto md:w-[min(36rem,60%)] md:pl-6 md:text-2xl">
          Check your website&apos;s pulse
        </label>
        <div className="flex flex-col md:flex-row md:items-center">
          <div className="-mx-5 h-12 md:-ml-14 md:mr-0 md:h-16 md:flex-1">
            <Heartbeat state={phase} className="h-full" />
          </div>
          <div className="relative md:w-[min(36rem,60%)] md:shrink-0">
            <span aria-hidden className={cx("absolute -left-1.5 top-1/2 z-10 hidden h-3 w-3 -translate-y-1/2 rounded-full md:block", phase === "error" ? "bg-ink-3" : "bg-pulse")} />
            <div
              className={cx(
                "flex items-center gap-2 rounded-full bg-card p-1.5 shadow-[var(--shadow-lift)] ring-1 transition focus-within:ring-4 motion-reduce:transition-none",
                phase === "error" ? "ring-pulse/50 focus-within:ring-pulse/40" : "ring-ink/5 focus-within:ring-scrub/45",
              )}
            >
              <input
                ref={inputRef}
                id="checkup-url"
                name="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={example}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={phase === "error" || undefined}
                aria-describedby={phase === "error" ? "checkup-error" : "checkup-hint"}
                className="h-12 min-w-0 flex-1 rounded-full bg-transparent pl-4 text-[16px] text-ink placeholder:text-ink-3/70 focus:outline-none focus-visible:outline-none! md:h-14 md:pl-6 md:text-lg"
              />
              <button
                type="submit"
                disabled={running}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-scrub px-4 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(91_61_245/0.7)] transition hover:bg-scrub-dark disabled:opacity-80 motion-reduce:transition-none md:h-14 md:px-6 md:text-base"
              >
                {running ? (
                  "Checking..."
                ) : (
                  <>
                    <span className="sm:hidden">Check</span>
                    <span className="hidden sm:inline">Run free checkup</span>
                    <ArrowRight size={17} aria-hidden />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 md:ml-auto md:w-[min(36rem,60%)] md:pl-6">
          {phase === "idle" && (
            <p id="checkup-hint" className="text-sm text-ink-2">
              No sign-up. Takes 20 to 40 seconds. We only read public pages.
            </p>
          )}
          {(running || phase === "done") && (
            <p className="inline-flex max-w-full items-center gap-2.5 rounded-full bg-card/80 py-1.5 pl-3 pr-4 text-sm text-ink ring-1 ring-ink/5" aria-live="polite">
              <span className={cx("h-2 w-2 shrink-0 rounded-full", running ? "blip bg-pulse" : "bg-good")} aria-hidden />
              <span className="truncate">{running ? `${STEPS[stepIndex]}...` : `Checkup complete for ${result?.host}`}</span>
              <span className="font-mono text-xs tabular-nums text-ink-3">{mmss(elapsed)}</span>
            </p>
          )}
          {phase === "error" && error && (
            <div id="checkup-error" role="alert" className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-ink ring-1 ring-pulse/30">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-pulse" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </div>
      </form>

      {phase === "done" && result && <Results result={result} market={market} headingRef={resultsRef} />}
    </div>
  );
}

function verdict(score: number) {
  if (score >= 75) return "In good shape. A few fixes will tighten it up.";
  if (score >= 50) return "Working, but losing enquiries it should be getting.";
  return "Several basics are missing. Start with the slips below.";
}

function Results({
  result,
  market,
  headingRef,
}: {
  result: CheckupResult;
  market: Market;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section aria-labelledby="checkup-results" className="mt-12 overflow-hidden rounded-[2rem] bg-card shadow-[var(--shadow-lift)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 md:px-8 md:pt-8">
        <h2
          id="checkup-results"
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 break-words font-display text-2xl font-extrabold tracking-[-0.02em] focus:outline-none md:text-3xl"
        >
          Results for {result.host}
        </h2>
        <Badge>Built with {result.platform}</Badge>
      </div>

      <div className="grid gap-6 p-5 md:p-8 lg:grid-cols-[auto_1fr_1.3fr] lg:gap-10">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-paper p-5 lg:items-start">
          <ScoreDial score={result.score} size={148} />
          <div className="text-center lg:text-left">
            <p className="text-[13px] font-semibold text-ink-3">Site health</p>
            <p className="mt-1 max-w-[15rem] text-sm text-ink-2">{verdict(result.score)}</p>
          </div>
        </div>

        <div>
          <p className="mb-4 text-[15px] font-semibold text-ink">By area</p>
          <div className="space-y-4">
            {GROUP_ORDER.map((g) => (
              <Meter key={g} label={GROUP_LABEL[g]} value={result.groupScores[g] ?? null} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-4 text-[15px] font-semibold text-ink">Top findings</p>
          {result.topIssues.length === 0 ? (
            <p className="text-sm text-ink-2">Every check we ran passed. Nice work.</p>
          ) : (
            <ul className="space-y-2">
              {result.topIssues.map((c) => (
                <li key={c.id} className="flex gap-3 rounded-2xl bg-paper px-4 py-3">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: c.status === "fail" ? "var(--color-pulse)" : "var(--color-amber)" }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {c.label} <span className="sr-only">({c.status === "fail" ? "fail" : "warning"})</span>
                    </p>
                    <p className="break-words text-sm text-ink-2">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {result.prescriptions.length > 0 && (
        <div className="px-5 pb-6 md:px-8 md:pb-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-xl font-extrabold tracking-[-0.02em]">
              Your first {result.prescriptions.length === 1 ? "prescription" : `${result.prescriptions.length} prescriptions`}
            </h3>
            <p className="text-sm text-ink-3">Steps written for {result.platform}</p>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {result.prescriptions.map((p, i) => (
              <RxSlip key={p.title} data={{ ...p, agent: "site", agentName: "Site Doctor" }} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      )}

      <LeadForm result={result} market={market} />
    </section>
  );
}

/** Captures the visitor's email as a lead, then continues to signup with it filled in. */
function LeadForm({ result, market }: { result: CheckupResult; market: Market }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, url: result.host, score: result.score, country: market.code }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setPending(false);
      setError((data as { error?: string }).error || "That didn't go through. Check your email address and try again.");
      return;
    }
    const href = signupHref(market, { website: result.host });
    window.location.href = `${href}${href.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`;
  }

  return (
    <div className="bg-scrub px-5 py-6 text-white md:px-8 md:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em] md:text-2xl">Get the full report for {result.host}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-white/85">
            The full checkup reads more pages and puts every fix on a board you can tick off, with a re-check date for each. Free, no card.
          </p>
        </div>
        <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-md">
          <label className="sr-only" htmlFor="lead-email">
            Your email
          </label>
          <input
            id="lead-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            className="min-w-0 flex-1 rounded-full border-0 bg-white px-5 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60 motion-reduce:transition-none"
          >
            {pending ? "One moment..." : "Get my full report"} <ArrowRight size={17} aria-hidden />
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-white">
          {error}
        </p>
      )}
    </div>
  );
}
