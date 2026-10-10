import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { planById } from "@/lib/config";
import { effectivePlan } from "@/lib/promos";
import { supportThreads } from "@/lib/support";
import { Logo } from "@/components/brand";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support inbox" };

export default async function SupportInboxPage() {
  const user = await currentUser();
  if (!user || !isAdmin(user)) redirect("/app");
  const threads = supportThreads();
  const waiting = threads.filter((t) => t.last_sender === "owner").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <Logo className="mb-6" />
      <a href="/admin" className="text-sm font-semibold text-scrub hover:underline">
        Back to the admin console
      </a>
      <PageHeader eyebrow="PULSE Digital" title="Support inbox">
        Messages owners send from Help in the app, newest first. {waiting ? `${waiting} waiting for a reply.` : "Nothing waiting for a reply."}
      </PageHeader>
      <Card className="overflow-hidden">
        {threads.length === 0 ? (
          <p className="p-5 text-sm text-ink-3">No messages yet. They appear here when an owner writes from Help in the app.</p>
        ) : (
          <ul className="divide-y divide-line">
            {threads.map((t) => {
              const plan = planById(effectivePlan(t));
              return (
                <li key={t.workspace_id}>
                  <a href={`/admin/support/${t.workspace_id}`} className="block px-5 py-4 transition hover:bg-paper">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{t.business}</span>
                      <Badge tone={plan.id === "pro" ? "ink" : "neutral"}>{plan.name}</Badge>
                      {t.last_sender === "owner" && <Badge tone="red">Waiting for a reply</Badge>}
                      {t.unread > 0 && <Badge tone="amber">{t.unread} new</Badge>}
                      <span className="ml-auto text-xs text-ink-3">{t.last_at.slice(0, 16).replace("T", " ")} UTC</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {t.owner} · {t.email} · {t.messages} {t.messages === 1 ? "message" : "messages"}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">
                      <span className="font-semibold text-ink">{t.last_sender === "owner" ? "Owner" : "Team"}:</span> {t.last_body}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
