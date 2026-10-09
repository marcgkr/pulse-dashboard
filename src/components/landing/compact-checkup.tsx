"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { Market } from "@/lib/markets";
import { cx } from "../ui";
import { exampleSite } from "./market-copy";

/**
 * A second checkup input for the bottom of a page. It does not run its own checkup: it hands the
 * address to the hero checkup (the input with id "checkup-url" in <Checkup>), scrolls up to it and
 * submits it, so the heartbeat and results show in one place. On a page without the hero
 * checkup it goes to the homepage checkup instead.
 */
export function CompactCheckup({ market, id = "close-checkup-url" }: { market: Market; id?: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const example = exampleSite(market);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) {
      setError(`Enter your website address, for example ${example}.`);
      return;
    }
    setError("");
    const target = document.getElementById("checkup-url") as HTMLInputElement | null;
    const form = target?.form;
    if (!target || !form) {
      window.location.assign("/#checkup");
      return;
    }
    // Set the value the way a keystroke would, so React's controlled input picks it up.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(target, value);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("checkup")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Let React commit the new value before the hero form reads it.
    requestAnimationFrame(() => form.requestSubmit());
  }

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-xl">
      <label htmlFor={id} className="sr-only">
        Your website address
      </label>
      <div
        className={cx(
          "flex items-center gap-2 rounded-full bg-card p-1.5 shadow-[var(--shadow-lift)] ring-1 transition focus-within:ring-4 motion-reduce:transition-none",
          error ? "ring-pulse/60 focus-within:ring-pulse/40" : "ring-ink/5 focus-within:ring-white/50",
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={example}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-12 min-w-0 flex-1 rounded-full bg-transparent pl-4 text-[16px] text-ink placeholder:text-ink-3/70 focus:outline-none focus-visible:outline-none! md:h-14 md:pl-6 md:text-lg"
        />
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[15px] font-semibold text-white transition hover:bg-ink-2 motion-reduce:transition-none md:h-14 md:px-6 md:text-base"
        >
          <span className="sm:hidden">Check</span>
          <span className="hidden sm:inline">Run free checkup</span>
          <ArrowRight size={17} aria-hidden />
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-3 inline-flex items-start gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm text-ink">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-pulse" aria-hidden />
          {error}
        </p>
      )}
    </form>
  );
}
