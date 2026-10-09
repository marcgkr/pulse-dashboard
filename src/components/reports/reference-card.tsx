"use client";

import { useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import { parseSocialLink, type Reference } from "@/lib/social-links";
import { cx } from "../ui";

/** One real post a trend or idea borrows from: cover, numbers as reported, what to borrow, and a player. */
export function ReferenceCard({ r }: { r: Reference }) {
  const link = r.sample ? null : parseSocialLink(r.url);
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = [r.platform, r.views, r.posted].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-line">
      <div className="flex gap-3 p-3">
        <button
          type="button"
          disabled={!link?.embed}
          onClick={() => setPlaying(true)}
          aria-label={link?.embed ? `Play ${r.creator}'s ${r.platform} post here` : undefined}
          className={cx(
            "relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/90 text-white",
            link?.embed ? "cursor-pointer" : "cursor-default",
          )}
        >
          {link?.thumb && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/thumb?url=${encodeURIComponent(link.url)}`}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="grid h-full w-full place-items-center bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgb(255_255_255/0.06)_8px_16px)] px-1 text-center text-[11px] font-bold leading-tight"
              style={{ backgroundColor: "var(--rx-accent, var(--color-scrub))", color: "var(--color-ink)" }}
            >
              {r.sample ? "Sample" : r.platform}
            </span>
          )}
          {link?.embed && (
            <span aria-hidden className="absolute inset-0 grid place-items-center bg-ink/20">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink">
                <Play size={14} className="translate-x-px" fill="currentColor" />
              </span>
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-ink">{meta}</p>
          <p className="truncate text-sm text-ink-2">{r.creator}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{r.borrow}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
            {link?.embed && !playing && (
              <button type="button" onClick={() => setPlaying(true)} className="inline-flex items-center gap-1 text-scrub hover:text-scrub-dark">
                <Play size={13} /> Watch here
              </button>
            )}
            {link && (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
                Open on {link.platform} <ExternalLink size={12} aria-hidden />
              </a>
            )}
            {r.sample && <span className="text-ink-2">Sample reference. Live reports link the real post.</span>}
          </div>
        </div>
      </div>

      {playing && link?.embed && (
        <div className="border-t border-line bg-ink p-3">
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => setPlaying(false)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-white/80 hover:text-white">
              <X size={14} /> Close player
            </button>
          </div>
          <div className={cx("mx-auto overflow-hidden rounded-xl bg-black", link.vertical ? "aspect-[9/16] max-w-[325px]" : "aspect-video")}>
            <iframe
              src={link.embed}
              title={`${r.creator} on ${link.platform}`}
              className="h-full w-full"
              allow="encrypted-media; picture-in-picture; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
