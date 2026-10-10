"use client";

import Link from "next/link";
import type { WebcareOffer } from "@/lib/webcare";
import { WebsiteCareNudge } from "../website-care-nudge";
import { CircleAlert, CircleCheck, ExternalLink, FileText, Link2, PlayCircle, TriangleAlert } from "lucide-react";
import {
  META_MAX,
  PAGE_TYPE_LABEL,
  PLATFORM_LABEL,
  SEO_TITLE_MAX,
  articleHtml,
  articleMarkdown,
  articlePlaceholders,
  isLandingPage,
  pageChecklist,
  schemaJson,
  upgradeArticle,
  videosBySection,
  youtubeEmbedUrl,
  youtubeId,
  type Article,
  type ArticleBrief,
  type ArticleVideo,
} from "@/lib/agents/article-format";
import { Badge, Card, Label, ReportSection, cx } from "../ui";
import { CopyButton } from "../copy-button";

export type ArticleResultView = {
  article: Article;
  brief?: ArticleBrief;
  location?: string;
  video_note?: string | null;
  regulated?: boolean;
};

function VideoCard({ v }: { v: ArticleVideo }) {
  const yt = v.platform === "youtube" ? youtubeId(v.url) : null;
  return (
    <figure className="my-6 overflow-hidden rounded-2xl bg-paper/70 ring-1 ring-line">
      {yt && (
        <div className="aspect-video w-full bg-ink">
          <iframe
            src={youtubeEmbedUrl(yt)}
            title={v.title || "YouTube video"}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
      <figcaption className="flex items-start gap-3 px-4 py-3">
        <PlayCircle size={18} className="mt-0.5 shrink-0 text-scrub" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ink">{PLATFORM_LABEL[v.platform] ?? v.platform}</Badge>
            <span className="min-w-0 break-words text-sm font-semibold">{v.title || "Your video"}</span>
          </div>
          {v.intro && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{v.intro}</p>}
        </div>
        <a
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs font-semibold text-ink-2 hover:border-scrub hover:text-scrub"
        >
          <ExternalLink size={13} /> Open
        </a>
      </figcaption>
    </figure>
  );
}

function MetaRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 text-[15px]">
      <span className="w-28 shrink-0 pt-0.5 text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="min-w-0 flex-1 break-words">
        {value}
        {hint && <span className="ml-2 font-mono text-xs text-ink-3">{hint}</span>}
      </span>
      <CopyButton text={value} />
    </div>
  );
}

const CtaButton = ({ text }: { text: string }) => <p className="mt-3 inline-flex rounded-full bg-scrub px-4 py-2 text-sm font-semibold text-white">{text}</p>;

export function ArticleReport({ result, webcare }: { result: ArticleResultView; webcare?: WebcareOffer | null }) {
  const brief = result.brief;
  const a = upgradeArticle(result.article, brief);
  const vids = videosBySection(a);
  const placeholders = articlePlaceholders(a);
  const landing = isLandingPage(a.page_type);
  const checks = pageChecklist(a, { keyword: brief?.target_keyword ?? "", regulated: result.regulated });
  const passed = checks.filter((c) => c.ok).length;
  const noun = a.page_type === "article" ? "article" : "page";

  return (
    <div className="space-y-10">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="ink">{PAGE_TYPE_LABEL[a.page_type]}</Badge>
            {brief?.target_keyword && <Badge tone="green">{brief.target_keyword}</Badge>}
            {result.location && <Badge tone="neutral">{result.location}</Badge>}
            {a.videos.length > 0 && (
              <Badge tone="neutral">
                {a.videos.length} of your videos
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={articleHtml(a)} label="Copy as HTML" />
            <CopyButton text={articleMarkdown(a)} label="Copy as Markdown" />
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
          Paste it into a new {a.page_type === "article" ? "blog post" : "page"}. Most website builders take HTML, which includes the schema; Notion, Ghost and some others take Markdown.
        </p>
      </Card>

      <ReportSection title="Best-practice checklist" hint="Checked against the page below for search (SEO), answer engines like featured snippets (AEO) and AI assistants that cite sources (GEO).">
        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="font-semibold">
              {passed} of {checks.length} pass
            </span>
            {passed < checks.length && <span className="text-ink-2">Fix the ones marked Needs work before you publish.</span>}
          </div>
          {checks.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-5 py-3 text-[15px]" data-check={c.id}>
              {c.ok ? <CircleCheck size={18} className="mt-0.5 shrink-0 text-good" aria-hidden /> : <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.label}</p>
                <p className="break-words text-sm text-ink-2">{c.detail}</p>
              </div>
              <Badge tone={c.ok ? "green" : "amber"}>{c.ok ? "Pass" : "Needs work"}</Badge>
            </div>
          ))}
        </Card>
      </ReportSection>

      <ReportSection title="Search listing" hint="What Google and AI assistants show for this page. Set these in your website builder's SEO settings.">
        <Card className="divide-y divide-line">
          <MetaRow label="SEO title" value={a.seo_title} hint={`${a.seo_title.length}/${SEO_TITLE_MAX}`} />
          <MetaRow label="Meta description" value={a.meta_description} hint={`${a.meta_description.length}/${META_MAX}`} />
          <MetaRow label="URL" value={a.slug} />
          <MetaRow label="H1" value={a.title} />
        </Card>
      </ReportSection>

      {(placeholders.length > 0 || result.video_note) && (
        <div className="space-y-3">
          {placeholders.length > 0 && (
            <div className="flex gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-5 py-4 text-[15px] leading-relaxed text-[#8a5410]">
              <TriangleAlert size={17} className="mt-1 shrink-0" />
              <div>
                <p className="font-semibold">Fill these in before you publish</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {placeholders.map((p) => (
                    <li key={p} className="rounded bg-white/70 px-2 py-0.5 font-mono text-[13px]">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {result.video_note && (
            <div className="flex gap-3 rounded-2xl bg-card px-5 py-4 text-[15px] leading-relaxed text-ink-2 ring-1 ring-line">
              <PlayCircle size={17} className="mt-1 shrink-0 text-ink-3" />
              <p>
                {result.video_note}{" "}
                {/Connected accounts/.test(result.video_note) && (
                  <Link href="/app/settings/connections" className="font-semibold text-scrub hover:underline">
                    Open Connected accounts
                  </Link>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <ReportSection title={a.page_type === "article" ? "The article" : "The page"}>
        <Card className="px-5 py-8 md:px-10 md:py-12">
          <article className="mx-auto max-w-prose text-[16px] leading-[1.7] text-ink md:text-[17px]">
            <Label className="mb-3 flex items-center gap-1.5">
              <FileText size={13} /> {a.slug}
            </Label>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-[-0.02em] md:text-[2.25rem]">{a.title}</h1>
            {a.answer && <p className="mt-5 rounded-xl bg-paper/70 px-4 py-3 text-[17px] ring-1 ring-line md:text-[18px]">{a.answer}</p>}
            {a.intro.map((p, i) => (
              <p key={i} className="mt-4">
                {p}
              </p>
            ))}
            {landing && a.cta.button && <CtaButton text={a.cta.button} />}

            {a.sections.map((s, i) => (
              <section key={i}>
                <h2 className="mt-10 font-display text-2xl font-bold leading-snug tracking-[-0.01em]">{s.heading}</h2>
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="mt-4">
                    {p}
                  </p>
                ))}
                {s.bullets.length > 0 && (
                  <ul className="mt-4 list-disc space-y-1.5 pl-6 marker:text-scrub">
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
                {(s.subsections ?? []).map((x, j) => (
                  <div key={j}>
                    <h3 className="mt-6 font-display text-lg font-bold leading-snug">{x.heading}</h3>
                    {x.paragraphs.map((p, k) => (
                      <p key={k} className="mt-2">
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
                {(vids.get(i) ?? []).map((v) => (
                  <VideoCard key={v.url} v={v} />
                ))}
              </section>
            ))}
            {a.sections.length === 0 && a.videos.map((v) => <VideoCard key={v.url} v={v} />)}

            {a.faq.length > 0 && (
              <section>
                <h2 className="mt-10 font-display text-2xl font-bold leading-snug tracking-[-0.01em]">Frequently asked questions</h2>
                <dl className="mt-4 divide-y divide-line">
                  {a.faq.map((f, i) => (
                    <div key={i} className="py-4 first:pt-0">
                      <dt className="font-semibold">{f.question}</dt>
                      <dd className="mt-1.5 text-ink-2">{f.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {(a.cta.heading || a.cta.text) && (
              <aside className="mt-10 rounded-2xl bg-mint px-6 py-5 ring-1 ring-scrub/20">
                {a.cta.heading && <p className="font-display text-xl font-bold leading-snug">{a.cta.heading}</p>}
                {a.cta.text && <p className="mt-2">{a.cta.text}</p>}
                {a.cta.button && <CtaButton text={a.cta.button} />}
              </aside>
            )}
          </article>
        </Card>
      </ReportSection>

      {(a.key_facts.length > 0 || a.internal_links.length > 0) && (
        <div className={cx("grid gap-6", a.key_facts.length > 0 && a.internal_links.length > 0 && "lg:grid-cols-2")}>
          {a.key_facts.length > 0 && (
            <ReportSection title="Key facts" hint={`The names, places and prices the ${noun} states. Check each one is right; AI assistants repeat them.`}>
              <Card className="divide-y divide-line">
                {a.key_facts.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3 text-[15px]">
                    <span className="w-28 shrink-0 pt-0.5 text-[13px] font-semibold text-ink-2">{f.label}</span>
                    <span className="min-w-0 flex-1 break-words">{f.value}</span>
                  </div>
                ))}
              </Card>
            </ReportSection>
          )}
          {a.internal_links.length > 0 && (
            <ReportSection title="Internal links to add" hint="Links between your pages help Google and AI assistants see what this page is about.">
              <Card className="divide-y divide-line">
                {a.internal_links.map((l, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3 text-[15px]">
                    <Link2 size={16} className="mt-1 shrink-0 text-scrub" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="break-words">
                        <span className="font-semibold">{l.target}</span>, with the words &ldquo;{l.anchor}&rdquo;
                      </p>
                      {l.why && <p className="mt-0.5 text-sm text-ink-2">{l.why}</p>}
                    </div>
                  </div>
                ))}
              </Card>
            </ReportSection>
          )}
        </div>
      )}

      {a.schema && (
        <ReportSection
          title="Schema (JSON-LD)"
          hint="Structured data that tells search engines and AI assistants what the page is. Copy as HTML already includes it; otherwise paste it into your builder's custom code box. Fill in any placeholders here too."
          actions={<CopyButton text={`<script type="application/ld+json">\n${schemaJson(a.schema)}\n</script>`} label="Copy schema" />}
        >
          <Card className="overflow-hidden">
            <pre className="max-h-96 overflow-auto px-5 py-4 font-mono text-xs leading-relaxed text-ink-2">{schemaJson(a.schema)}</pre>
          </Card>
        </ReportSection>
      )}

      <WebsiteCareNudge offer={webcare} ask={`Want us to put this ${noun} on your website for you?`} />
    </div>
  );
}
