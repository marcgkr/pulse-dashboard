import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/config";
import type { Market } from "@/lib/markets";
import { AGENT_COLORS } from "@/lib/agent-colors";
import { Logo } from "../brand";
import { ButtonLink, cx } from "../ui";
import { MarketPicker } from "./market-picker";
import { signupHref } from "./market-copy";

/** Public site top bar: logo, section links, country picker, log in, start free. */
export function SiteNav({ market }: { market: Market }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 md:px-8" aria-label="Main">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="mr-2 hidden items-center gap-1 lg:flex">
            <NavLink href="/#specialists">Specialists</NavLink>
            <NavLink href="/#how">How it works</NavLink>
            <NavLink href="/pricing">Pricing</NavLink>
          </div>
          <MarketPicker current={market.code} />
          <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-ink-2 transition hover:bg-card hover:text-ink">
            Log in
          </Link>
          <ButtonLink href={signupHref(market)} className="hidden px-4 sm:inline-flex">
            Start free
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-2 transition hover:bg-card hover:text-ink">
      {children}
    </Link>
  );
}

/** Public site footer. */
export function SiteFooter({ market }: { market: Market }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-paper px-3 pb-3 md:px-4 md:pb-4">
      <div className="rounded-[2rem] bg-card shadow-[var(--shadow-box)] md:rounded-[2.5rem]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:px-10">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-[15px] text-ink-2">{BRAND.tagline}</p>
            <div className="mt-6">
              <p className="mb-2 text-[13px] font-semibold text-ink-3">Country and currency</p>
              <MarketPicker current={market.code} placement="up" />
            </div>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-semibold text-ink-3">Product</p>
            <ul className="space-y-2.5 text-[15px]">
              <FooterLink href="/#checkup">Free website checkup</FooterLink>
              <FooterLink href="/#specialists">The specialists</FooterLink>
              <FooterLink href="/pricing">Pricing</FooterLink>
              <FooterLink href={signupHref(market)}>Start free</FooterLink>
              <FooterLink href="/login">Log in</FooterLink>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-semibold text-ink-3">Company</p>
            <ul className="space-y-2.5 text-[15px]">
              <li>
                <a href={BRAND.parentUrl} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">
                  {BRAND.parent}
                </a>
              </li>
              <FooterLink href="/privacy">Privacy policy</FooterLink>
              <FooterLink href="/terms">Terms of service</FooterLink>
              <li>
                <a href={`mailto:${BRAND.contactEmail}`} className="break-all text-ink-2 hover:text-ink">
                  {BRAND.contactEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line px-6 py-5 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <span>
            &copy; {year} {BRAND.parent}. Made in Singapore.
          </span>
          <ColourRow />
        </div>
      </div>
    </footer>
  );
}

/** The six specialist colours in a row, like the colour code on a box flap. */
export function ColourRow({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex gap-1", className)} aria-hidden>
      {Object.values(AGENT_COLORS).map((c) => (
        <span key={c.label} className={cx("h-2.5 w-5 rounded-full", c.box)} />
      ))}
    </span>
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

/** Section opener: an optional short kicker, a heavy display headline, and a lead paragraph. */
export function SectionHead({
  kicker,
  title,
  children,
  className,
  id,
  align = "left",
}: {
  kicker?: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cx("mb-10 md:mb-14", align === "center" && "mx-auto text-center", className)}>
      {kicker && <p className="mb-3 text-[15px] font-semibold text-scrub">{kicker}</p>}
      <h2
        id={id}
        className={cx(
          "max-w-3xl font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl md:text-[3.5rem]",
          align === "center" && "mx-auto",
        )}
      >
        {title}
      </h2>
      {children && <div className={cx("mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2", align === "center" && "mx-auto")}>{children}</div>}
    </div>
  );
}

/** Accessible FAQ list built on details/summary, as rounded cards. */
export function FaqList({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <details key={it.q} className="group rounded-3xl bg-card ring-1 ring-line/80 transition open:shadow-[var(--shadow-box)] motion-reduce:transition-none">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-3xl px-5 py-4 text-left font-semibold text-ink marker:hidden md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
            <span className="text-[17px]">{it.q}</span>
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-lg leading-none text-scrub transition group-open:rotate-45 group-open:bg-scrub group-open:text-white motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <div className="max-w-3xl px-5 pb-5 text-[15px] leading-relaxed text-ink-2 md:px-6 md:pb-6 [&_a]:font-semibold [&_a]:text-scrub [&_a]:underline [&_a]:underline-offset-4">
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}
