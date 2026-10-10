import { ownedWorkspaces, requireWorkspace } from "@/lib/auth";
import { PLANS, BRAND, planPrice } from "@/lib/config";
import { formatPrice, marketFor } from "@/lib/markets";
import { applyCheckout, stripe, stripeEnabled } from "@/lib/billing";
import { usage } from "@/lib/runs";
import { ProfileForm } from "@/components/profile-form";
import { PlanPicker } from "@/components/plan-picker";
import { Badge, ButtonLink, Card, Label, PageHeader } from "@/components/ui";
import { clientConnections } from "@/lib/connectors/store";
import { feedbackForWorkspace } from "@/lib/memory";
import { getAgent } from "@/lib/agents";
import { MemoryList } from "@/components/memory-list";
import { AutopilotToggle, BusinessList, PromoRedeem } from "@/components/settings-pro";
import { promoActive } from "@/lib/promos";
import { planById } from "@/lib/config";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ upgraded?: string; checkout?: string }> }) {
  const sp = await searchParams;
  // Back from Stripe Checkout: apply the plan now rather than waiting for the webhook.
  let justPaid = false;
  if (sp.checkout && /^cs_[A-Za-z0-9_]+$/.test(sp.checkout) && stripeEnabled()) {
    const me = await requireWorkspace();
    const owned = ownedWorkspaces(me.user.id);
    try {
      const session = await stripe().checkout.sessions.retrieve(sp.checkout);
      const forMe = owned.some((w) => w.id === (session.client_reference_id || session.metadata?.workspace_id));
      justPaid = forMe && applyCheckout(session);
    } catch (e) {
      console.warn("[billing] checkout session lookup failed", (e as Error).message);
    }
  }
  const { user, ws } = await requireWorkspace();
  const u = usage(ws);
  const market = marketFor(ws.country);
  const conns = clientConnections(ws.id);
  const summary = conns
    .filter((c) => c.connected)
    .map((c) => `${c.provider === "google" ? "Google" : "Meta"}${c.needsReconnect ? " (reconnect needed)" : ""}`);
  const memory = feedbackForWorkspace(ws.id).map((f) => ({
    id: f.id,
    agentName: getAgent(f.agent)?.name ?? f.agent,
    runId: f.run_id,
    item: f.item,
    verdict: f.verdict,
    comment: f.comment,
    when: new Date(f.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: market.timeZone }),
  }));
  const owned = ownedWorkspaces(user.id).slice(0, u.plan.businesses);
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Settings" title="Your business" />

      <section>
        <Label className="mb-2">Business profile</Label>
        <Card className="p-5 md:p-6">
          <ProfileForm
            mode="edit"
            initial={{
              name: ws.name,
              website: ws.website,
              industry: ws.industry,
              location: ws.location,
              country: ws.country,
              audience: ws.audience,
              offers: ws.offers,
              competitors: ws.competitors,
              goals: ws.goals,
              monthly_budget: ws.monthly_budget,
              tone: ws.tone,
              regulated: !!ws.regulated,
            }}
          />
        </Card>
      </section>

      <section id="connections">
        <Label className="mb-2">Connected accounts</Label>
        <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Google and Meta</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-2">
              Connect once and Ads Doctor and Keyword Lab read your latest numbers themselves. We read ad performance and search performance, read-only; we never change
              your ads. You can disconnect any time.
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">{summary.length ? `Connected: ${summary.join(", ")}` : "Nothing connected yet."}</p>
          </div>
          <ButtonLink href="/app/settings/connections" variant="secondary" className="shrink-0">
            Manage connected accounts
          </ButtonLink>
        </Card>
      </section>

      {u.plan.businesses > 1 && (
        <section id="businesses">
          <Label className="mb-2">Your businesses</Label>
          <Card className="overflow-hidden">
            <BusinessList
              businesses={owned.map((w, i) => ({ id: w.id, name: w.name, website: w.website, primary: i === 0 }))}
              currentId={ws.id}
              max={u.plan.businesses}
            />
          </Card>
        </section>
      )}

      {u.plan.autopilot && (
        <section id="autopilot">
          <Label className="mb-2">Autopilot</Label>
          <Card>
            <AutopilotToggle on={ws.autopilot !== 0} businessName={ws.name} />
          </Card>
        </section>
      )}

      <section id="memory">
        <Label className="mb-2">What your specialists remember</Label>
        <Card className="overflow-hidden">
          <p className="border-b border-line px-5 py-4 text-[15px] leading-relaxed text-ink-2 md:px-6">
            Your approvals, rejections and comments on reports. Each specialist reads its notes before it runs, so it stops repeating what you rejected and gets your business right. Forget a note to stop it being used.
          </p>
          <MemoryList rows={memory} />
        </Card>
      </section>

      <section id="plan">
        <Label className="mb-2">Plan</Label>
        {(justPaid || sp.upgraded || sp.checkout) && (
          <p className="mb-3 rounded-2xl border border-scrub/30 bg-mint px-4 py-3 text-[15px] text-scrub-dark">
            {justPaid ? "Payment received. Your new plan is active now." : "Payment received. Your plan updates within a minute."}
          </p>
        )}
        <Card className="p-5 md:p-6">
          {promoActive(ws) && ws.plan !== ws.paid_plan && (
            <p className="mb-4 rounded-2xl bg-mint px-4 py-3 text-[15px] text-scrub-dark">
              You&apos;re on <strong>{u.plan.name}</strong> free with code <strong>{ws.promo_code}</strong>
              {ws.promo_until
                ? ` until ${new Date(ws.promo_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: market.timeZone })}`
                : ""}
              . {ws.promo_until ? `After that you go back to ${planById(ws.paid_plan).name}.` : ""}
            </p>
          )}
          <p className="text-sm text-ink-2">
            Prices in {market.currency}. You&apos;re on <strong>{u.plan.name}</strong>. {u.used} of {u.limit} reports used this month{u.plan.businesses > 1 ? ", across all your businesses" : ""} (sample reports in demo mode don&apos;t count).
          </p>
          <div className="mt-5">
            <PlanPicker
              plans={PLANS.map((p) => ({
                id: p.id,
                name: p.name,
                price: p.id === "free" ? "Free" : `${formatPrice(market, planPrice(p, market))}/mo`,
                features: p.features,
              }))}
              current={ws.plan}
              paid={ws.paid_plan ?? ws.plan}
              stripe={stripeEnabled()}
              hasSubscription={!!ws.stripe_subscription_id}
              hasCustomer={!!ws.stripe_customer_id}
              contact={BRAND.contactEmail}
            />
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <PromoRedeem />
          </div>
        </Card>
      </section>
    </div>
  );
}
