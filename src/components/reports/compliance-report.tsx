import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, OctagonAlert, Square } from "lucide-react";
import { Badge, Card, Label, ReportSection, cx } from "../ui";
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
  /** Names the official guidance for the business's country. */
  disclaimer?: string;
  demo?: boolean;
};

// Fallback for results saved before the disclaimer followed the business's country (all Singapore).
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
    <div className="space-y-12">
      <div className={cx("rounded-lg border p-5", v.cls)}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{v.icon}</span>
          <div className="min-w-0 flex-1">
            <Label className="text-current opacity-80">Verdict</Label>
            <p className="font-display text-2xl font-semibold">{v.label}</p>
            <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-ink-2">{v.text}</p>
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
        <ReportSection title="Lines to fix" hint="Each line we flagged, why it is a problem, and wording you can use instead.">
          <div className="space-y-4">
            {r.issues.map((issue, i) => (
              <Card key={i} className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={SEV_TONE[issue.severity]}>{issue.severity}</Badge>
                  {issue.framework && <Badge tone="ink">{issue.framework}</Badge>}
                  <span className="font-semibold">{issue.rule}</span>
                </div>
                <blockquote className="max-w-3xl border-l-2 border-pulse/50 pl-3 text-[15px] leading-relaxed text-ink">{highlighted(issue.quote, issue.highlight)}</blockquote>
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{issue.why}</p>
                <div className="mt-4 rounded-md border border-scrub/20 bg-mint px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="mb-1 text-scrub-dark">Suggested rewrite</Label>
                      <p className="max-w-3xl break-words text-[15px] leading-relaxed">{issue.fix || "Delete this line."}</p>
                    </div>
                    {issue.fix && <CopyButton text={issue.fix} />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ReportSection>
      )}

      {r.rewritten_copy && (
        <ReportSection title="Full rewritten copy" hint="Your text with every fix applied." actions={<CopyButton text={r.rewritten_copy} label="Copy all" />}>
          <Card className="p-5">
            <p className="max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed">{r.rewritten_copy}</p>
          </Card>
          {r.demo && (
            <p className="mt-2 text-sm text-ink-3">
              Made by simple find-and-replace rules (no AI connected). Read it through and fix the wording before you use it.
            </p>
          )}
        </ReportSection>
      )}

      {r.checklist.length > 0 && (
        <ReportSection title="A person still needs to check" hint="Things software cannot judge from the text alone.">
          <Card className="divide-y divide-line">
            {r.checklist.map((c, i) => (
              <div key={i} className="flex gap-3 px-5 py-3 text-[15px] leading-relaxed">
                <Square size={15} className="mt-1 shrink-0 text-ink-3" />
                <span className="max-w-3xl">{c}</span>
              </div>
            ))}
          </Card>
        </ReportSection>
      )}

      {r.flags && r.flags.length > 0 && (
        <details className="rounded-lg border border-line bg-card">
          <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-ink-2 hover:text-ink">
            Phrase scan: {r.flags.length} phrase{r.flags.length === 1 ? "" : "s"} flagged
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {r.flags.map((f, i) => (
              <li key={i} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>
                  <span className="font-semibold">{f.family}</span>
                  <span className="font-mono text-xs text-pulse">&ldquo;{f.phrase}&rdquo;</span>
                </div>
                <p className="mt-1 max-w-3xl break-words text-sm leading-relaxed text-ink-2">{f.snippet}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="border-t border-line pt-4 text-sm leading-relaxed text-ink-3">
        <span className="block max-w-3xl">{r.disclaimer || DISCLAIMER}</span>
      </p>
    </div>
  );
}
