import Link from "next/link";
import { ArrowRight, Send } from "lucide-react";
import type { WebcareOffer } from "@/lib/webcare";
import { cx } from "./ui";

/**
 * One small card offering "Website changes by PULSE", for Growth and Pro owners without the add-on.
 * Owners who have it get a "Send to PULSE" link instead. Pass webcareOffer(ws) from the page (null
 * hides it, so Checkup and Starter never see it). Use it once per page, after the fixes it refers to.
 */
export function WebsiteCareNudge({ offer, className, ask }: { offer: WebcareOffer | null | undefined; className?: string; ask?: string }) {
  if (!offer) return null;
  if (offer.active) {
    return (
      <p className={cx("print:hidden", className)}>
        <Link href="/app/website-changes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-scrub hover:underline">
          <Send size={14} aria-hidden /> Send to PULSE: add these to your next round of website changes
        </Link>
      </p>
    );
  }
  return (
    <aside
      aria-label="Website changes by PULSE"
      className={cx("flex flex-col gap-3 rounded-3xl bg-mint px-5 py-4 ring-1 ring-scrub/15 sm:flex-row sm:items-center sm:justify-between print:hidden", className)}
    >
      <div className="max-w-2xl">
        <p className="font-semibold text-ink">{ask ?? "Want us to make these changes on your website?"}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
          PULSE makes your website changes twice a month, as many as you need each round, for {offer.price}/month.
        </p>
      </div>
      <Link
        href="/app/website-changes"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-scrub px-4 py-2 text-sm font-semibold text-white hover:bg-scrub-dark"
      >
        See how it works <ArrowRight size={14} aria-hidden />
      </Link>
    </aside>
  );
}
