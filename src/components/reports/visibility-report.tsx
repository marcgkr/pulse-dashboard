import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown, CircleMinus, ExternalLink } from "lucide-react";
import { Badge, Card, Label, cx } from "../ui";

type Source = { title: string; url: string };
type PromptRow = {
  prompt: string;
  answer: string;
  mentioned: boolean;
  position: number | null;
  cited: boolean;
  businesses: string[];
  competitors_found: string[];
  sources: Source[];
  sentiment?: string;
  brand_context?: string;
  error?: string;
};
type VisibilityResult = {
  brand: string;
  brand_terms?: string[];
  domain?: string;
  prompts: PromptRow[];
  share_of_voice: { name: string; mentions: number; is_brand?: boolean }[];
  cited_domains: { domain: string; count: number; kind?: string }[];
  insights?: string[];
  demo?: boolean;
};

const LEGAL_SUFFIX = /\s*\b(pte\.?\s*ltd\.?|private\s+limited|sdn\.?\s*bhd\.?|ltd\.?|llp|llc|inc\.?|limited)\s*$/i;

function brandRegex(terms: string[], domain?: string): RegExp | null {
  const variants = new Set<string>();
  for (const t of terms) {
    const base = t.trim();
    if (!base) continue;
    variants.add(base);
    const short = base.replace(LEGAL_SUFFIX, "").replace(/^the\s+/i, "").trim();
    if (short.length >= 3) variants.add(short);
  }
  if (domain) variants.add(domain);
  const parts = [...variants]
    .sort((a, b) => b.length - a.length)
    .map((v) =>
      v
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "[\\s\\-.'’]*"),
    );
  if (!parts.length) return null;
  return new RegExp(`(${parts.join("|")})`, "gi");
}

function highlight(text: string, re: RegExp | null): ReactNode[] {
  if (!re) return [text];
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-scrub/15 px-0.5 font-semibold text-scrub-dark">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** Light clean-up of markdown so the answer reads as text. */
function cleanAnswer(answer: string): string {
  return answer
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Yes({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-scrub">
      <CheckCircle2 size={15} /> {children ?? "Yes"}
    </span>
  );
}
function No() {
  return (
    <span className="inline-flex items-center gap-1 text-pulse">
      <CircleMinus size={15} /> No
    </span>
  );
}

export function VisibilityReport({ result }: { result: VisibilityResult }) {
  const r = result;
  const re = brandRegex(r.brand_terms?.length ? r.brand_terms : [r.brand], r.domain);
  const maxSov = Math.max(1, ...r.share_of_voice.map((s) => s.mentions));
  const counted = r.prompts.filter((p) => !p.error);
  const named = counted.filter((p) => p.mentioned).length;
  const citedCount = counted.filter((p) => p.cited).length;
  const getListed = r.cited_domains.filter((d) => d.kind !== "Your website");

  return (
    <div className="space-y-8">
      <Card className="p-4 text-sm text-ink-2">
        <Label className="mb-2">How to read this</Label>
        <p>
          The answers below come from Claude with web search, used as a stand-in for AI assistants like ChatGPT, Perplexity and Google AI
          Mode. Each assistant uses different sources, and answers change over time, so treat this as a snapshot and re-run it monthly.
        </p>
        <p className="mt-2">
          <span className="font-semibold text-ink">Score:</span> each question scores 100 if {r.brand} is named and your website is one of
          the sources, 70 if you are named but your site is not a source, and 0 if you are not named. The score is the average across{" "}
          {counted.length} question{counted.length === 1 ? "" : "s"}. Here you were named in {named} and cited in {citedCount}.
        </p>
      </Card>

      <section>
        <Label className="mb-2">Question by question</Label>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2">Question</th>
                <th className="px-3 py-2">Named</th>
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Site cited</th>
              </tr>
            </thead>
            <tbody>
              {r.prompts.map((p, i) => (
                <tr key={i} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="mr-1.5 font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    {p.prompt}
                    {p.competitors_found.length > 0 && (
                      <div className="mt-1 text-xs text-ink-3">Competitors named: {p.competitors_found.join(", ")}</div>
                    )}
                  </td>
                  {p.error ? (
                    <td colSpan={3} className="px-3 py-2.5 text-xs text-ink-3">
                      Did not run: {p.error}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 whitespace-nowrap">{p.mentioned ? <Yes /> : <No />}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {p.position ? `#${p.position}${p.businesses.length ? ` of ${Math.max(p.businesses.length, p.position)}` : ""}` : "--"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{p.cited ? <Yes /> : <No />}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {r.share_of_voice.length > 0 && (
        <section>
          <Label className="mb-2">Share of voice: how many answers name each business</Label>
          <Card className="space-y-3 p-4">
            {r.share_of_voice.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={cx("min-w-0 truncate", s.is_brand ? "font-semibold text-scrub-dark" : "text-ink-2")}>
                    {s.name}
                    {s.is_brand && <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-scrub">You</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">
                    {s.mentions} / {counted.length}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className={cx("h-full rounded-full", s.is_brand ? "bg-scrub" : "bg-ink-3")}
                    style={{ width: `${(s.mentions / maxSov) * 100}%`, minWidth: s.mentions ? 6 : 0 }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {getListed.length > 0 && (
        <section>
          <Label className="mb-1">Get listed here: the sites AI read most</Label>
          <p className="mb-2 text-sm text-ink-2">
            These sites came up as sources. Being listed, reviewed or mentioned on them is how businesses end up in AI answers.
          </p>
          <Card className="divide-y divide-line">
            {getListed.map((d) => (
              <div key={d.domain} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <a
                  href={`https://${d.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 break-all font-mono text-sm text-ink hover:text-scrub"
                >
                  {d.domain} <ExternalLink size={12} className="shrink-0" />
                </a>
                {d.kind && <Badge>{d.kind}</Badge>}
                <span className="ml-auto font-mono text-xs tabular-nums text-ink-3">
                  {d.count} question{d.count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {r.insights && r.insights.length > 0 && (
        <section>
          <Label className="mb-2">Why others get named</Label>
          <ul className="space-y-2">
            {r.insights.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-md border border-line bg-card px-3 py-2 text-sm">
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <Label className="mb-2">Full AI answers</Label>
        <div className="space-y-2">
          {r.prompts.map((p, i) => (
            <details key={i} className="group rounded-lg border border-line bg-card">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 font-semibold">{p.prompt}</span>
                {!p.error && <Badge tone={p.mentioned ? "green" : "red"}>{p.mentioned ? "Named" : "Not named"}</Badge>}
                <ChevronDown size={16} className="mt-0.5 shrink-0 text-ink-3 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-line px-4 py-3">
                {p.error ? (
                  <p className="text-sm text-ink-3">This question did not run: {p.error}</p>
                ) : (
                  <>
                    {p.brand_context && (
                      <p className="text-sm">
                        <span className="font-semibold">How you were described</span>
                        {p.sentiment && p.sentiment !== "not mentioned" && (
                          <Badge tone={p.sentiment === "positive" ? "green" : p.sentiment === "negative" ? "red" : "neutral"} className="mx-2">
                            {p.sentiment}
                          </Badge>
                        )}
                        <span className="text-ink-2">{p.brand_context}</span>
                      </p>
                    )}
                    <div className="whitespace-pre-line break-words rounded-md bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink-2">
                      {highlight(cleanAnswer(p.answer) || "No answer returned.", re)}
                    </div>
                    {p.businesses.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Label className="mr-1">Named</Label>
                        {p.businesses.map((b, k) => (
                          <Badge key={k} tone={re && new RegExp(re.source, "i").test(b) ? "green" : "neutral"}>
                            {b}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {p.sources.length > 0 && (
                      <div>
                        <Label className="mb-1">Sources the AI found</Label>
                        <ul className="space-y-1 text-sm">
                          {p.sources.slice(0, 10).map((s, k) => (
                            <li key={k} className="min-w-0">
                              <a href={s.url} target="_blank" rel="noreferrer" className="break-words text-ink-2 hover:text-scrub">
                                <span className="font-mono text-xs text-ink-3">{host(s.url)}</span> {s.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
        {r.demo && <p className="mt-2 text-xs text-ink-3">These are sample answers made up to show the report, not real AI answers.</p>}
      </section>
    </div>
  );
}
