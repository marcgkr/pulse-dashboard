import type { ReactNode } from "react";
import { Label } from "../ui";
import { SiteFooter, SiteNav } from "./site-chrome";

/** Shared layout for the privacy policy and terms. Shows a clear draft notice until reviewed. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <div role="note" className="mb-10 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-[#6b420c]">
          <strong className="font-semibold">Draft for review.</strong> This document is a placeholder written for launch planning. It has not been reviewed by a lawyer and
          must be checked and finalised before the service takes payments or personal data from the public.
        </div>
        <Label className="mb-3">Last updated {updated}</Label>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-ink-2 [&_a]:font-semibold [&_a]:text-scrub [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
