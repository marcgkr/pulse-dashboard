import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { BRAND } from "@/lib/config";
import { ownerThread } from "@/lib/support";
import { supportWhatsAppLink } from "@/lib/whatsapp";
import { SupportThread } from "@/components/support-thread";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help" };

export default async function HelpPage() {
  const { ws } = await requireWorkspace();
  const messages = ownerThread(ws.id);
  // ws.plan is the plan in effect (a promo code can lift it). Without SUPPORT_WHATSAPP, Pro uses the chat below.
  const pro = ws.plan === "pro";
  const whatsapp = pro ? supportWhatsAppLink(ws.name) : null;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Support" title="Help">
        Message the PULSE team about your reports, your plan or anything you&apos;re stuck on. We reply here when we&apos;re available, and you&apos;ll see a
        badge on Help when we do.
      </PageHeader>

      {whatsapp && (
        <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <p className="font-display text-lg font-bold">Priority support on WhatsApp</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">Your Pro plan includes WhatsApp support. You can still write here too.</p>
          </div>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-good px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:opacity-90"
          >
            <MessageCircle size={17} /> WhatsApp the PULSE team
          </a>
        </Card>
      )}

      <SupportThread
        endpoint="/api/support"
        initial={messages}
        side="owner"
        otherName="PULSE team"
        inputLabel="Your message"
        placeholder="Write your message"
        empty="No messages yet. Tell us what you need help with."
      />

      <p className="mt-4 text-sm text-ink-2">
        {!pro && (
          <>
            Pro accounts also get priority support on WhatsApp.{" "}
            <Link href="/app/settings#plan" className="font-semibold text-scrub hover:text-scrub-dark">
              See plans
            </Link>
            .{" "}
          </>
        )}
        Prefer email? Write to{" "}
        <a href={`mailto:${BRAND.contactEmail}`} className="font-semibold text-scrub hover:text-scrub-dark">
          {BRAND.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
