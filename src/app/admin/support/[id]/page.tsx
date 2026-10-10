import { notFound, redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { planById } from "@/lib/config";
import { db } from "@/lib/db";
import { marketFor } from "@/lib/markets";
import { effectivePlan } from "@/lib/promos";
import { teamThread } from "@/lib/support";
import { Logo } from "@/components/brand";
import { Badge, PageHeader } from "@/components/ui";
import { SupportThread } from "@/components/support-thread";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support thread" };

type Row = { id: string; name: string; website: string; country: string; plan: string; promo_plan: string | null; promo_until: string | null; owner: string; email: string };

export default async function SupportThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) redirect("/app");
  const { id } = await params;
  const ws = db()
    .prepare(
      `SELECT w.id, w.name, w.website, w.country, w.plan, w.promo_plan, w.promo_until, u.name AS owner, u.email
       FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE w.id = ?`,
    )
    .get(id) as Row | undefined;
  if (!ws) notFound();
  const plan = planById(effectivePlan(ws));
  const messages = teamThread(ws.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Logo className="mb-6" />
      <a href="/admin/support" className="text-sm font-semibold text-scrub hover:underline">
        Back to the support inbox
      </a>
      <PageHeader eyebrow="Support thread" title={ws.name}>
        <span className="flex flex-wrap items-center gap-2 text-[15px]">
          <Badge tone={plan.id === "pro" ? "ink" : "neutral"}>{plan.name}</Badge>
          <span>{ws.owner}</span>
          <a className="font-semibold text-scrub" href={`mailto:${ws.email}`}>
            {ws.email}
          </a>
          <span className="text-ink-3">
            {marketFor(ws.country).name}
            {ws.website ? ` · ${ws.website}` : ""}
          </span>
        </span>
      </PageHeader>
      <SupportThread
        endpoint={`/api/admin/support/${ws.id}`}
        initial={messages}
        side="team"
        otherName={ws.owner || ws.name}
        inputLabel="Your reply"
        placeholder="Write a reply. The owner sees it on their Help page."
        empty="No messages in this thread yet."
      />
    </main>
  );
}
