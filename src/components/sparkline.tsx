import { scoreColor } from "./ui";

/** Monitor-style trend line for 0-100 scores. */
export function Sparkline({ points, labels }: { points: number[]; labels?: string[] }) {
  const w = 300;
  const h = 80;
  const pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / 100) * (h - pad * 2);
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" role="img" aria-label={`Score went from ${first} to ${last}`}>
        {[25, 50, 75].map((g) => (
          <line key={g} x1={0} x2={w} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeDasharray="2 4" />
        ))}
        <path d={d} fill="none" stroke={scoreColor(last)} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r="3.5" fill={scoreColor(last)} />
      </svg>
      {labels && (
        <div className="flex justify-between font-mono text-[10px] text-ink-3">
          <span>{labels[0]}</span>
          <span>
            {last - first >= 0 ? "+" : ""}
            {last - first} pts
          </span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
