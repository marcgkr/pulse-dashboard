import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { db, type WebsiteChangeRow } from "@/lib/db";
import { parseItems, STATUS_LABEL, STATUS_TONE } from "@/lib/webcare";
import { Logo } from "@/components/brand";
import { Badge, Card, PageHeader, cx } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website changes" };

const FILTERS = [
  { id: "open", label: "Not done", where: "r.status IN ('submitted','in_progress')" },
  { id: "submitted", label: "Not started", where: "r.status = 'submitted'" },
  { id: "in_progress", label: "In progress", where: "r.status = 'in_progress'" },
  { id: "done", label: "Done", where: "r.status = 'done'" },
  { id: "all", label: "All", where: "1 = 1" },
] as const;

type Row = WebsiteChangeRow & { business: string; email: string };

export default async function WebsiteChangesAdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) redirect("/app");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.status) ?? FILTERS[0];
  const rows = db()
    .prepare(
      `SELECT r.*, w.name AS business, u.email FROM website_change_requests r
       JOIN workspaces w ON w.id = r.workspace_id JOIN users u ON u.id = w.owner_id
       WHERE ${filter.where} ORDER BY r.created_at DESC LIMIT 300`,
    )
    .all() as Row[];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <Logo className="mb-6" />
      <a href="/admin" className="text-sm font-semibold text-scrub hover:underline">
        Back to the admin console
      </a>
      <PageHeader eyebrow="PULSE Digital" title="Website changes">
        Rounds of changes owners send with the website changes add-on, newest first. Open one to see the login and mark it done.
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "open" ? "/admin/website-changes" : `/admin/website-changes?status=${f.id}`}
            className={cx("rounded-full px-4 py-2 text-sm font-semibold transition", f.id === filter.id ? "bg-ink text-white" : "bg-card text-ink-2 ring-1 ring-line hover:ring-ink-3")}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-ink-3">Nothing here. Rounds appear when an owner with the add-on sends their changes.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const items = parseItems(r.items);
              return (
                <li key={r.id}>
                  <a href={`/admin/website-changes/${r.id}`} className="block px-5 py-4 transition hover:bg-paper">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.business}</span>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      <span className="ml-auto text-xs text-ink-3">{r.created_at.slice(0, 16).replace("T", " ")} UTC</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {r.email} · {items.length} {items.length === 1 ? "change" : "changes"}
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-sm text-ink-2">{items[0]?.text}</p>
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
