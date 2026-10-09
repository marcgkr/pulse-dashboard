"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { MARKETS, MARKET_COOKIE, marketFor, type MarketCode } from "@/lib/markets";
import { cx } from "../ui";
import { marketChip } from "./market-copy";

/**
 * Country and currency picker for the public site. Saves the choice in a cookie and refreshes,
 * so every server component (prices, rules, examples, signup links) re-renders for that market.
 */
export function MarketPicker({ current, placement = "down", className }: { current: MarketCode; placement?: "up" | "down"; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<MarketCode>(current);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => setShown(current), [current]);

  // Close on outside press; focus the selected country when the list opens.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    const selected = listRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]') ?? listRef.current?.querySelector("button");
    selected?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function choose(code: MarketCode) {
    document.cookie = `${MARKET_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
    setShown(code);
    setOpen(false);
    buttonRef.current?.focus();
    startTransition(() => router.refresh());
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    const items = Array.from(listRef.current?.querySelectorAll("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  const m = marketFor(shown);

  return (
    <div ref={wrapRef} className={cx("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Country: ${m.name}, prices in ${m.currency}. Change country`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          "inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-semibold text-ink ring-1 ring-line transition hover:ring-ink-3 motion-reduce:transition-none",
          pending && "opacity-60",
        )}
      >
        <Globe size={15} className="text-scrub" aria-hidden />
        <span className="tabular-nums">{marketChip(m)}</span>
        <ChevronDown size={15} className={cx("text-ink-3 transition motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          className={cx(
            "absolute z-50 w-[17rem] max-w-[calc(100vw-2rem)] rounded-3xl bg-card p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-line",
            placement === "down" ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2",
          )}
        >
          <p className="px-3 pb-1 pt-2 text-[13px] font-semibold text-ink-3">Where is your business?</p>
          <ul id={listId} ref={listRef} onKeyDown={onListKey} className="max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain">
            {MARKETS.map((x) => {
              const selected = x.code === shown;
              return (
                <li key={x.code}>
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => choose(x.code)}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-[15px] transition hover:bg-paper focus-visible:bg-paper motion-reduce:transition-none",
                      selected ? "font-semibold text-scrub" : "text-ink",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {x.name}
                      {selected && <Check size={15} aria-hidden />}
                    </span>
                    <span className="font-mono text-xs text-ink-3">{x.currency}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
