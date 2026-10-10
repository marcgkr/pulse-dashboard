import { CheckCircle2, CircleAlert, CircleX, Star } from "lucide-react";
import type { GbpResult } from "@/lib/agents/gbp";
import { Badge, Card, ReportSection } from "../ui";
import { CopyButton } from "../copy-button";

const icon = {
  pass: <CheckCircle2 size={16} className="shrink-0 text-scrub" />,
  warn: <CircleAlert size={16} className="shrink-0 text-amber" />,
  fail: <CircleX size={16} className="shrink-0 text-pulse" />,
};

export function GbpReport({ result }: { result: GbpResult }) {
  const p = result.profile;
  const stats: [string, string][] = [
    ["Rating", p.rating != null ? `${p.rating.toFixed(1)} from ${p.reviewCount ?? 0} reviews` : "No rating yet"],
    ["Photos", p.photos != null ? String(p.photos) : "Unknown"],
    ...(p.actions
      ? ([
          ["Calls, last 30 days", String(p.actions.calls)],
          ["Website clicks", String(p.actions.websiteClicks)],
          ["Direction requests", String(p.actions.directions)],
        ] as [string, string][])
      : []),
  ];
  return (
    <div className="space-y-12">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          {result.sample ? <Badge tone="amber">Sample profile</Badge> : <Badge tone="ink">{result.location}</Badge>}
          {p.primaryCategory && <Badge tone="neutral">{p.primaryCategory}</Badge>}
          {p.mapsUri && (
            <a href={p.mapsUri} target="_blank" rel="noopener noreferrer" className="font-semibold text-scrub underline underline-offset-2">
              Open on Google Maps
            </a>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold text-ink-3">{k}</dt>
              <dd className="mt-0.5 font-display text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {result.warnings.length > 0 && <p className="mt-4 text-sm text-ink-3">{result.warnings.join(" ")}</p>}
      </Card>

      <ReportSection title="Profile checklist" hint="What Google looks at when it picks which businesses to show on the map.">
        <Card className="divide-y divide-line">
          {result.checks.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5">{icon[c.status]}</span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{c.label}</p>
                <p className="text-sm text-ink-2">{c.detail}</p>
              </div>
            </div>
          ))}
        </Card>
      </ReportSection>

      {result.description.suggested && (
        <ReportSection title="New business description" hint="Paste it in Edit profile > About > Description. Google allows 750 characters.">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="max-w-3xl text-[15px] leading-relaxed">{result.description.suggested}</p>
              <CopyButton text={result.description.suggested} />
            </div>
            <p className="mt-2 text-xs text-ink-3">{result.description.suggested.length} characters</p>
            {result.description.current && (
              <details className="mt-3 text-sm text-ink-2">
                <summary className="cursor-pointer font-semibold">Your current description</summary>
                <p className="mt-2 leading-relaxed">{result.description.current}</p>
              </details>
            )}
          </Card>
        </ReportSection>
      )}

      {(result.categories.length > 0 || result.services.length > 0) && (
        <ReportSection title="Categories and services to add" hint="Edit profile > Business category, and Edit services. Each one is another set of searches you can show up for.">
          <div className="grid gap-4 md:grid-cols-2">
            {result.categories.length > 0 && (
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink-2">Additional categories</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {result.categories.map((c) => (
                    <li key={c} className="rounded-full bg-paper px-3 py-1 text-sm ring-1 ring-line">
                      {c}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {result.services.length > 0 && (
              <Card className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-2">Services</p>
                  <CopyButton text={result.services.join("\n")} />
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {result.services.map((c) => (
                    <li key={c} className="rounded-full bg-paper px-3 py-1 text-sm ring-1 ring-line">
                      {c}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </ReportSection>
      )}

      {result.posts.length > 0 && (
        <ReportSection title="Posts to publish" hint="In your profile, click Add update (or Add offer / Add event), paste the text, add the photo and pick the button.">
          <div className="grid gap-4 md:grid-cols-2">
            {result.posts.map((post, i) => (
              <Card key={i} className="flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{post.type}</Badge>
                  <span className="text-xs font-semibold text-ink-3">{post.when}</span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">{post.title}</p>
                  <CopyButton text={post.text} />
                </div>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{post.text}</p>
                <dl className="mt-auto grid gap-1 pt-4 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-ink-3">Button</dt>
                    <dd>{post.button}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-ink-3">Photo</dt>
                    <dd>{post.photo}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </ReportSection>
      )}

      {result.replies.length > 0 && (
        <ReportSection title="Replies to reviews still waiting" hint="Open Read reviews in your profile, click Reply under each one and paste.">
          <div className="space-y-3">
            {result.replies.map((r, i) => (
              <Card key={i} className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{r.reviewer}</span>
                  {r.stars != null && (
                    <span className="inline-flex items-center gap-0.5 text-amber" aria-label={`${r.stars} stars`}>
                      {Array.from({ length: r.stars }, (_, k) => (
                        <Star key={k} size={13} fill="currentColor" />
                      ))}
                    </span>
                  )}
                </div>
                {r.review && <p className="mt-2 text-sm italic leading-relaxed text-ink-2">&ldquo;{r.review}&rdquo;</p>}
                <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-mint px-4 py-3">
                  <p className="text-[15px] leading-relaxed">{r.reply}</p>
                  <CopyButton text={r.reply} />
                </div>
              </Card>
            ))}
          </div>
        </ReportSection>
      )}
    </div>
  );
}
