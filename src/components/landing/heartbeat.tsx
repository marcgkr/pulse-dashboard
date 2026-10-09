import { cx } from "../ui";

export type BeatState = "idle" | "running" | "done" | "error";

// Two beats on a flat line, ending flat on the right so it can run straight into the checkup capsule.
const BEAT_PATH =
  "M0 40 H96 l7 -5 l7 5 H150 l6 -30 l9 62 l8 -48 l6 16 H262 l7 -5 l7 5 H316 l6 -30 l9 62 l8 -48 l6 16 H480";
const FLAT_PATH = "M0 40 H480";

/**
 * The live coral heartbeat. A faint trace draws in on load, then a bright pulse sweeps along it
 * (faster while a checkup runs). Flatlines on error. Static under prefers-reduced-motion.
 */
export function Heartbeat({ state = "idle", tone = "coral", className }: { state?: BeatState; tone?: "coral" | "white"; className?: string }) {
  const flat = state === "error";
  const ink = tone === "white" ? "#ffffff" : "var(--color-pulse)";
  const glow = tone === "white" ? "rgb(255 255 255 / 0.5)" : "rgb(255 77 106 / 0.55)";
  const d = flat ? FLAT_PATH : BEAT_PATH;
  return (
    <svg viewBox="0 0 480 80" preserveAspectRatio="none" className={cx("block w-full overflow-visible", className)} aria-hidden>
      <style>{`
        @keyframes mrx-draw { from { stroke-dashoffset: 1000 } to { stroke-dashoffset: 0 } }
        @keyframes mrx-sweep { from { stroke-dashoffset: 160 } to { stroke-dashoffset: -1000 } }
        .mrx-base { stroke-dasharray: 1000; animation: mrx-draw 1.6s cubic-bezier(.6,.05,.3,1) .35s both }
        .mrx-sweep { stroke-dasharray: 160 1160; animation: mrx-sweep var(--mrx-speed, 2.6s) linear 1.6s infinite both }
        @media (prefers-reduced-motion: reduce) {
          .mrx-base { animation: none; stroke-dasharray: none; stroke-opacity: 0.9 }
          .mrx-sweep { display: none }
        }
      `}</style>
      <path
        d={d}
        pathLength={1000}
        fill="none"
        stroke={flat ? "var(--color-ink-3)" : ink}
        strokeOpacity={flat ? 0.5 : tone === "white" ? 0.35 : 0.5}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="mrx-base"
      />
      {!flat && (
        <path
          d={d}
          pathLength={1000}
          fill="none"
          stroke={ink}
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="mrx-sweep"
          style={{ ["--mrx-speed" as string]: state === "running" ? "1s" : "2.6s", filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      )}
    </svg>
  );
}
