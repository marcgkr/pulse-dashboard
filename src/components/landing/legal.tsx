import type { ReactNode } from "react";
import { visitorMarket } from "@/lib/market-server";
import { SiteFooter, SiteNav } from "./site-chrome";

/** Shared layout for the privacy policy and terms. Shows a clear draft notice until reviewed. */
export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const market = await visitorMarket();
  return (
    <>
      <SiteNav market={market} />
      <main className="px-3 pb-16 md:px-4 md:pb-24">
        <div className="chart-grid mx-auto max-w-[90rem] rounded-[2rem] bg-lilac/45 px-5 pb-10 pt-10 md:rounded-[2.75rem] md:px-14 md:pb-14 md:pt-14">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-scrub-dark">Last updated {updated}</p>
            <h1 className="mt-3 font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.035em] md:text-6xl">{title}</h1>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-3xl px-1 md:mt-14">
          <div role="note" className="mb-10 rounded-3xl bg-amber/15 px-5 py-4 text-sm leading-relaxed text-[#6b420c] ring-1 ring-amber/30">
            <strong className="font-semibold">Draft for review.</strong> This document is a placeholder written for launch planning. It has not been reviewed by a lawyer
            and must be checked and finalised before the service takes payments or personal data from the public.
          </div>
          <div className="space-y-4 text-[16px] leading-relaxed text-ink-2 [&_a]:font-semibold [&_a]:text-scrub [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-[-0.02em] [&_h2]:text-ink md:[&_h2]:text-3xl [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-1.5">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter market={market} />
    </>
  );
}
