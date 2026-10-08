import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, OctagonAlert, Square } from "lucide-react";
import { Badge, Card, Label, cx } from "../ui";
import { CopyButton } from "../copy-button";

type Severity = "high" | "medium" | "low";
type Issue = { quote: string; highlight?: string; rule: string; framework?: string; why: string; severity: Severity; fix: string };
type Flag = { family: string; phrase: string; snippet: string; severity: Severity };
type ComplianceResult = {
  verdict: "looks fine" | "needs edits" | "high risk";
  channel: string;
  category: string;
  source?: { url: string | null; chars: number; image_notes?: string[] };
  flags?: Flag[];
  issues: Issue[];
  rewritten_copy: string;
  checklist: string[];
  demo?: boolean;
};

const DISCLAIMER =
  "This is an automated pre-check, not legal advice. For anything you're unsure about, check the official MOH and ASAS guidance or ask a professional.";

const VERDICT: Record<ComplianceResult["verdict"], { label: string; text: string; cls: string; icon: ReactNode }> = {
  "looks fine": {
    label: "Looks fine",
    text: "Nothing in the text breaks the rules we check. Still go through the human checklist below.",
    cls: "border-scrub/30 bg-mint text-scrub-dark",
    icon: <CircleCheck size={22} />,
  },
  "needs edits": {
    label: "Needs edits",
    text: "Fix the lines below before this goes live.",
    cls: "border-amber/40 bg-amber/10 text-[#8a5410]",
    icon: <CircleAlert size={22} />,
  },
  "high risk": {
    label: "High risk",
    text: "Don't publish this as it is. At least one line is likely to break the rules for your category or get the ad rejected.",
    cls: "border-pulse/30 bg-pulse/10 text-pulse",
    icon: <OctagonAlert size={22} />,
  },
};

const SEV_TONE = { high: "red", medium: "amber", low: "neutral" } as const;

function highlighted(quote: string, phrase?: string): ReactNode {
  if (!phrase) return quote;
  const i = quote.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return quote;
  return (
    <>
      {quote.slice(0, i)}
      <mark className="rounded bg-pulse/15 px-0.5 font-semibold text-pulse">{quote.slice(i, i + phrase.length)}</mark>
      {quote.slice(i + phrase.length)}
    </>
  );
}

export function ComplianceReport({ result }: { result: ComplianceResult }) {
  const r = result;
  const v = VERDICT[r.verdict] ?? VERDICT["needs edits"];
  const counts = { high: 0, medium: 0, low: 0 } as Record<Severity, number>;
  r.issues.forEach((i) => (counts[i.severity] = (counts[i.severity] ?? 0) + 1));

  return (
    <div className="space-y-8">
      <div className={cx("rounded-lg border p-4 sm:p-5", v.cls)}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{v.icon}</span>
          <div className="min-w-0 flex-1">
            <Label className="text-current opacity-80">Verdict</Label>
            <p className="font-display text-2xl font-semibold">{v.label}</p>
            <p className="mt-1 text-sm text-ink-2">{v.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="ink">{r.channel}</Badge>
              <Badge>{r.category}</Badge>
              {(["high", "medium", "low"] as const).map((s) =>
                counts[s] ? (
                  <Badge key={s} tone={SEV_TONE[s]}>
                    {counts[s]} {s}
                  </Badge>
                ) : null,
              )}
              {r.source?.url && <span className="break-all font-mono text-xs text-ink-2">{r.source.url}</span>}
            </div>
          </div>
        </div>
      </div>

      {r.issues.length > 0 && (
        <section>
          <Label className="mb-2">Lines to fix</Label>
          <div className="space-y-3">
            {r.issues.map((issue, i) => (
              <Card key={i} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={SEV_TONE[issue.severity]}>{issue.severity}</Badge>
                  {issue.framework && <Badge tone="ink">{issue.framework}</Badge>}
                  <span className="text-sm font-semibold">{issue.rule}</span>
                </div>
                <blockquote className="border-l-2 border-pulse/50 pl-3 text-sm text-ink">{highlighted(issue.quote, issue.highlight)}</blockquote>
                <p className="mt-2 text-sm text-ink-2">{issue.why}</p>
                <div className="mt-3 rounded-md border border-scrub/20 bg-mint px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="mb-1 text-scrub-dark">Suggested rewrite</Label>
                      <p className="break-words text-sm">{issue.fix || "Delete this line."}</p>
                    </div>
                    {issue.fix && <CopyButton text={issue.fix} />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {r.rewritten_copy && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label>Full rewritten copy</Label>
            <CopyButton text={r.rewritten_copy} label="Copy all" />
          </div>
          <Card className="whitespace-pre-line break-words p-4 text-sm leading-relaxed">{r.rewritten_copy}</Card>
          {r.demo && (
            <p className="mt-1.5 text-xs text-ink-3">
              Made by simple find-and-replace rules (no AI connected). Read it through and fix the wording before you use it.
            </p>
          )}
        </section>
      )}

      {r.checklist.length > 0 && (
        <section>
          <Label className="mb-2">A person still needs to check</Label>
          <Card className="divide-y divide-line">
            {r.checklist.map((c, i) => (
              <div key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                <Square size={15} className="mt-0.5 shrink-0 text-ink-3" />
                <span>{c}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {r.flags && r.flags.length > 0 && (
        <details className="rounded-lg border border-line bg-card">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Phrase scan: {r.flags.length} phrase{r.flags.length === 1 ? "" : "s"} flagged
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {r.flags.map((f, i) => (
              <li key={i} className="px-4 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>
                  <span className="font-semibold">{f.family}</span>
                  <span className="font-mono text-xs text-pulse">&ldquo;{f.phrase}&rdquo;</span>
                </div>
                <p className="mt-1 break-words text-xs text-ink-3">{f.snippet}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="border-t border-line pt-4 text-xs text-ink-3">{DISCLAIMER}</p>
    </div>
  );
}
