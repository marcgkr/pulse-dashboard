import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/config";
import { Logo } from "../brand";
import { ButtonLink, Label, cx } from "../ui";

/** Public site top bar: Logo, Pricing, Log in, Start free. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6" aria-label="Main">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/pricing" className="hidden rounded-md px-3 py-2 text-sm font-semibold text-ink-2 hover:text-ink sm:inline-flex">
            Pricing
          </Link>
          <Link href="/login" className="rounded-md px-2.5 py-2 text-sm font-semibold text-ink-2 hover:text-ink sm:px-3">
            Log in
          </Link>
          <ButtonLink href="/signup" className="px-3 sm:px-4">
            Start free
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

/** Public site footer. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-2">{BRAND.tagline}</p>
          <p className="mt-4 text-sm text-ink-2">
            A{" "}
            <a href={BRAND.parentUrl} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-scrub">
              {BRAND.parent}
            </a>{" "}
            product. Made in Singapore.
          </p>
        </div>
        <div>
          <Label className="mb-3">Product</Label>
          <ul className="space-y-2 text-sm">
            <FooterLink href="/#checkup">Free website checkup</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/signup">Start free</FooterLink>
            <FooterLink href="/login">Log in</FooterLink>
          </ul>
        </div>
        <div>
          <Label className="mb-3">Company</Label>
          <ul className="space-y-2 text-sm">
            <FooterLink href="/privacy">Privacy policy</FooterLink>
            <FooterLink href="/terms">Terms of service</FooterLink>
            <li>
              <a href={`mailto:${BRAND.contactEmail}`} className="text-ink-2 hover:text-ink">
                {BRAND.contactEmail}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 font-mono text-[11px] uppercase tracking-wider text-ink-3 sm:flex-row sm:justify-between md:px-6">
          <span>
            &copy; {year} {BRAND.parent}
          </span>
          <span>Diagnose. Prescribe. You do the rest.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-2 hover:text-ink">
        {children}
      </Link>
    </li>
  );
}

/**
 * Section header styled like a field on a patient chart: a heavy rule, the field name in mono,
 * then the headline. `code` is a short right-aligned mono note (e.g. what the section covers).
 */
export function SectionHead({
  field,
  title,
  children,
  code,
  className,
  id,
}: {
  field: string;
  title: string;
  children?: ReactNode;
  code?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cx("mb-10", className)}>
      <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-2">
        <Label className="text-ink">{field}</Label>
        {code && <Label className="hidden sm:block">{code}</Label>}
      </div>
      <h2 id={id} className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-[1.1] tracking-tight md:text-[2.6rem]">
        {title}
      </h2>
      {children && <div className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

/** Accessible FAQ list built on details/summary. */
export function FaqList({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="text-[17px]">{it.q}</span>
            <span
              aria-hidden
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line font-mono text-sm text-scrub transition group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <div className="-mt-1 max-w-3xl pb-6 pr-10 text-[15px] leading-relaxed text-ink-2 [&_a]:font-semibold [&_a]:text-scrub [&_a]:underline [&_a]:underline-offset-4">
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Formats an SGD monthly price from PLANS. */
export function sgd(n: number) {
  return `S$${n.toLocaleString("en-SG")}`;
}
