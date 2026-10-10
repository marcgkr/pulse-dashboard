import { notFound, redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { planById } from "@/lib/config";
import { db, type WebsiteChangeRow } from "@/lib/db";
import { marketFor } from "@/lib/markets";
import { effectivePlan } from "@/lib/promos";
import { loginSummary, parseItems, STATUS_LABEL, STATUS_TONE } from "@/lib/webcare";
import { Logo } from "@/components/brand";
import { Badge, Card, Label, PageHeader } from "@/components/ui";
import { RevealPassword, RoundStatusForm } from "@/components/admin-website-change";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website changes" };

type Row = WebsiteChangeRow & {
  business: string;
  website: string;
  country: string;
  plan: string;
  promo_plan: string | null;
  promo_until: string | null;
  owner: string;
  email: string;
};

const when = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

export default async function WebsiteChangeAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) redirect("/app");
  const { id } = await params;
  const r = db()
    .prepare(
      `SELECT r.*, w.name AS business, w.website, w.country, w.plan, w.promo_plan, w.promo_until, u.name AS owner, u.email
       FROM website_change_requests r JOIN workspaces w ON w.id = r.workspace_id JOIN users u ON u.id = w.owner_id WHERE r.id = ?`,
    )
    .get(id) as Row | undefined;
  if (!r) notFound();
  const items = parseItems(r.items);
  const login = loginSummary(r.workspace_id);
  // Extra outlets inherit the plan from the account's first business.
  const primaryPlan = (db().prepare("SELECT w.plan, w.promo_plan, w.promo_until FROM workspaces w WHERE w.owner_id = (SELECT owner_id FROM workspaces WHERE id = ?) ORDER BY w.created_at, w.id LIMIT 1").get(r.workspace_id) ?? r) as Pick<Row, "plan" | "promo_plan" | "promo_until">;
  const plan = planById(effectivePlan(primaryPlan));
  const reveals = db()
    .prepare(
      `SELECT a.created_at, u.name, u.email FROM admin_audit a LEFT JOIN users u ON u.id = a.admin_id
       WHERE a.workspace_id = ? AND a.action = 'reveal_website_password' ORDER BY a.created_at DESC LIMIT 5`,
    )
    .all(r.workspace_id) as { created_at: string; name: string | null; email: string | null }[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Logo className="mb-6" />
      <a href="/admin/website-changes" className="text-sm font-semibold text-scrub hover:underline">
        Back to website changes
      </a>
      <PageHeader eyebrow="Website changes" title={r.business}>
        <span className="flex flex-wrap items-center gap-2 text-[15px]">
          <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          <Badge tone={plan.id === "pro" ? "ink" : "neutral"}>{plan.name}</Badge>
          <span>{r.owner}</span>
          <a className="font-semibold text-scrub" href={`mailto:${r.email}`}>
            {r.email}
          </a>
          <span className="text-ink-3">
            {marketFor(r.country).name}
            {r.website ? ` · ${r.website}` : ""} · sent {when(r.created_at)}
          </span>
        </span>
      </PageHeader>

      <section className="mb-8">
        <Label className="mb-2">Changes ({items.length})</Label>
        <Card>
          <ol className="divide-y divide-line">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3 px-5 py-4">
                <span className="font-mono text-sm text-ink-3">{i + 1}.</span>
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-[15px]">{it.text}</p>
                  {it.detail && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-2">{it.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mb-8">
        <Label className="mb-2">Website login</Label>
        <Card className="p-5">
          {login ? (
            <dl className="grid gap-x-4 gap-y-3 text-[15px] sm:grid-cols-[9rem_1fr]">
              <dt className="font-semibold text-ink-2">Login page</dt>
              <dd className="break-all">
                <a href={login.loginUrl} target="_blank" rel="noreferrer noopener" className="text-scrub hover:underline">
                  {login.loginUrl}
                </a>
              </dd>
              <dt className="font-semibold text-ink-2">Username</dt>
              <dd className="break-all">{login.username}</dd>
              <dt className="font-semibold text-ink-2">Password</dt>
              <dd>{login.hasPassword ? <RevealPassword requestId={r.id} /> : <span className="text-ink-3">Not saved</span>}</dd>
              {login.notes && (
                <>
                  <dt className="font-semibold text-ink-2">Notes</dt>
                  <dd className="whitespace-pre-wrap break-words">{login.notes}</dd>
                </>
              )}
              <dt className="font-semibold text-ink-2">Last updated</dt>
              <dd className="text-sm text-ink-3">{when(login.updatedAt)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-ink-3">The owner hasn&apos;t saved a login yet.</p>
          )}
          {reveals.length > 0 && (
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              Password revealed by {reveals.map((a) => `${a.name || a.email || "a deleted admin"} (${when(a.created_at)})`).join(", ")}
            </p>
          )}
        </Card>
      </section>

      <section>
        <Label className="mb-2">Status</Label>
        <Card className="p-5">
          <RoundStatusForm requestId={r.id} status={r.status} note={r.admin_note} />
          {r.done_at && <p className="mt-3 text-xs text-ink-3">Marked done {when(r.done_at)}</p>}
        </Card>
      </section>
    </main>
  );
}
