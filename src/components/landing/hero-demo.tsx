"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { agentColor } from "@/lib/agent-colors";
import { cx } from "../ui";

/**
 * The hero's example checkup: a website goes in, the pulse runs, a score counts up and the first three
 * fixes drop in, each with how long it takes. Plays once on load; reduced motion shows the end state.
 * It's labelled as an example: the numbers are illustrative, not anyone's real result.
 */
const SITE = "yourbusiness.com";
const SCORE = 58;

export function HeroDemo({ area }: { area: string }) {
  const fixes = [
    { agent: "site", title: "Put a WhatsApp button on every page", time: "10 min" },
    { agent: "keywords", title: `Name ${area} in your homepage headline`, time: "5 min" },
    { agent: "visibility", title: "Answer “How much does it cost?” on your site", time: "20 min" },
  ];
  const [typed, setTyped] = useState(SITE.length);
  const [score, setScore] = useState(SCORE);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTyped(0);
    setScore(0);
    let i = 0;
    const type = window.setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= SITE.length) window.clearInterval(type);
    }, 55);
    // The score counts up while the pulse line draws.
    const start = performance.now() + 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 1300));
      setScore(Math.round(SCORE * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.clearInterval(type);
      cancelAnimationFrame(raf);
    };
  }, []);

  const arc = 2 * Math.PI * 34;
  return (
    <figure aria-label="Example checkup: a score of 58 and three fixes that take 5 to 20 minutes" className="w-full max-w-[26rem]">
      <div className="rounded-[1.75rem] bg-card p-4 shadow-[var(--shadow-lift)] ring-1 ring-ink/5 md:p-5" aria-hidden>
        {/* Address bar */}
        <div className="flex items-center gap-2 rounded-full bg-paper px-3 py-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
          <span className="font-mono text-[13px] text-ink-2">
            {SITE.slice(0, typed)}
            <span className={cx("ml-px inline-block h-3.5 w-px translate-y-0.5 bg-ink", typed < SITE.length ? "blip" : "opacity-0")} />
          </span>
        </div>

        {/* Score and pulse */}
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-mint)" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="var(--color-amber)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={arc}
                strokeDashoffset={arc * (1 - score / 100)}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center font-display text-2xl font-extrabold tabular-nums">{score}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-3">Site health</p>
            <svg viewBox="0 0 200 40" className="mt-1 h-9 w-full" preserveAspectRatio="none">
              <path
                d="M0 22 H62 L70 22 L76 6 L84 36 L90 22 H130 L136 22 L142 12 L148 30 L153 22 H200"
                fill="none"
                stroke="var(--color-pulse)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="ecg-trace"
                style={{ ["--len" as string]: 260, animationDelay: "0.9s" }}
              />
            </svg>
          </div>
        </div>

        {/* First fixes */}
        <p className="rise mt-4 text-[13px] font-semibold text-ink-3" style={{ animationDelay: "2.4s" }}>
          Your first 3 fixes
        </p>
        <ul className="mt-2 space-y-2">
          {fixes.map((f, i) => (
            <li
              key={f.title}
              className="rise flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3"
              style={{ animationDelay: `${2.6 + i * 0.35}s` }}
            >
              <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", agentColor(f.agent).dot)} />
              <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-ink">{f.title}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[12px] font-semibold text-ink-2 ring-1 ring-line">
                <Clock size={12} /> {f.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-center text-[13px] text-ink-3">An example checkup. Yours takes about a minute.</figcaption>
    </figure>
  );
}
