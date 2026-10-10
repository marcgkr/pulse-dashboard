import { ownedWorkspaces, requireWorkspace } from "@/lib/auth";
import { stripeEnabled } from "@/lib/billing";
import { BRAND, PLANS, planById } from "@/lib/config";
import { db, type TaskRow } from "@/lib/db";
import { formatPrice, marketFor } from "@/lib/markets";
import { AGENTS } from "@/lib/agents";
import {
  loginSummary,
  nextRoundOpens,
  parseItems,
  roundsFor,
  roundsUsed,
  ROUNDS_PER_MONTH,
  STATUS_LABEL,
  STATUS_TONE,
  webcareActive,
  webcareEnding,
  webcareAvailable,
} from "@/lib/webcare";
import { RoundForm, WebcareToggle, WebsiteLoginForm } from "@/components/website-changes";
import { Badge, ButtonLink, Card, Label, PageHeader } from "@/components/ui";

export const metadata = { title: "Website changes" };

export default async function WebsiteChangesPage() {
  const { user, ws } = await requireWorkspace();
  const primary = ownedWorkspaces(user.id)[0] ?? ws;
  // The add-on is billed on the first business, in its currency.
  const market = marketFor(primary.country);
  const price = formatPrice(market, market.prices.webcare);
  const date = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: market.timeZone });
  const canBuy = stripeEnabled() && !!primary.stripe_subscription_id && planById(primary.paid_plan).websiteCare;
  const plans = PLANS.filter((p) => p.websiteCare).map((p) => p.name).join(" and ");

  if (!webcareActive(ws)) {
    return (
      <div className="max-w-3xl">
        <PageHeader eyebrow="Add-on" title="Website changes by PULSE">
          Want us to make your website changes for you? The PULSE team makes them twice a month, as many as you need each round, for {price}/month.
        </PageHeader>
        <Card className="p-5 md:p-6">
          <ol className="space-y-4 text-[15px] leading-relaxed">
            <li>
              <span className="font-semibold">1. Add it to your plan.</span> {price} a month on top of {plans}. Stop it whenever you like.
            </li>
            <li>
              <span className="font-semibold">2. Share a login for your website once.</span> We recommend creating a separate staff or admin user for PULSE rather
              than sharing your own password. It&apos;s stored encrypted and only the PULSE team can see it.
            </li>
            <li>
              <span className="font-semibold">3. Send up to two rounds a month.</span> List as many changes as you want, or pick them from your prescriptions. We make
              them on your website and mark the round done here.
            </li>
          </ol>
          <div className="mt-6 border-t border-line pt-5">
            {webcareAvailable(ws) ? (
              <WebcareToggle on={false} price={price} canBuy={canBuy} contact={BRAND.contactEmail} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink-2">Website changes are an add-on for {plans}.</p>
                <ButtonLink href="/app/settings#plan" variant="secondary">
                  See plans
                </ButtonLink>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const used = roundsUsed(user.id);
  const left = Math.max(0, ROUNDS_PER_MONTH - used);
  const login = loginSummary(ws.id);
  const rounds = roundsFor(ws.id);
  const last = (
    db()
      .prepare("SELECT MAX(created_at) AS at FROM website_change_requests WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)")
      .get(user.id) as { at: string | null }
  ).at;
  const outlets = ownedWorkspaces(user.id).length > 1;
  const ending = webcareEnding(primary);
  const tasks = (
    db()
      .prepare(
        `SELECT * FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing')
         ORDER BY agent = 'site' DESC, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 40`,
      )
      .all(ws.id) as TaskRow[]
  ).map((t) => ({ id: t.id, title: t.title, agent: AGENTS[t.agent as keyof typeof AGENTS]?.name ?? t.agent }));
  const blocked = !login?.hasPassword
    ? "Save your website login above first."
    : left === 0
      ? `You've sent both rounds for this month. Next round opens on ${date(nextRoundOpens())}.`
      : null;

  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader eyebrow="Add-on" title="Website changes by PULSE">
        Two rounds a month, as many changes as you want in each round. {left} of {ROUNDS_PER_MONTH} rounds left this month
        {outlets ? " (shared across your outlets)" : ""}.
        {last && <span className="mt-1 block text-sm text-ink-3">Last round sent on {date(last)}.</span>}
      </PageHeader>

      <section id="login">
        <Label className="mb-2">Your website login</Label>
        <Card className="p-5 md:p-6">
          <WebsiteLoginForm initial={login} />
        </Card>
      </section>

      <section id="round">
        <Label className="mb-2">Submit this round</Label>
        <Card className="p-5 md:p-6">
          <RoundForm tasks={tasks} blocked={blocked} />
        </Card>
      </section>

      <section id="history">
        <Label className="mb-2">Your rounds</Label>
        <Card className="overflow-hidden">
          {rounds.length === 0 ? (
            <p className="p-5 text-sm text-ink-3">Nothing sent yet. Your rounds and what PULSE did appear here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rounds.map((r) => {
                const items = parseItems(r.items);
                return (
                  <li key={r.id} className="px-5 py-4 md:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Sent {date(r.created_at)}</span>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      {r.done_at && <span className="text-xs text-ink-3">Done {date(r.done_at)}</span>}
                    </div>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                      {items.map((it, i) => (
                        <li key={i} className="break-words">
                          {it.text}
                        </li>
                      ))}
                    </ul>
                    {r.admin_note && (
                      <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-mint px-4 py-2.5 text-sm text-scrub-dark">
                        <span className="font-semibold">PULSE:</span> {r.admin_note}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-2">
          {ending ? `Website changes by PULSE stops on ${date(ending)}. You can send rounds until then.` : `Website changes by PULSE is on for ${price}/month.`}
        </p>
        <WebcareToggle on price={price} canBuy={canBuy} contact={BRAND.contactEmail} ending={!!ending} />
      </section>
    </div>
  );
}
