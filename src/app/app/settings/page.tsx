import { requireWorkspace } from "@/lib/auth";
import { PLANS, BRAND, planPrice } from "@/lib/config";
import { formatPrice, marketFor } from "@/lib/markets";
import { stripeEnabled } from "@/lib/billing";
import { usage } from "@/lib/runs";
import { ProfileForm } from "@/components/profile-form";
import { PlanButtons } from "@/components/settings-forms";
import { Badge, ButtonLink, Card, Label, PageHeader } from "@/components/ui";
import { clientConnections } from "@/lib/connectors/store";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const sp = await searchParams;
  const { ws } = await requireWorkspace();
  const u = usage(ws);
  const market = marketFor(ws.country);
  const conns = clientConnections(ws.id);
  const summary = conns
    .filter((c) => c.connected)
    .map((c) => `${c.provider === "google" ? "Google" : "Meta"}${c.needsReconnect ? " (reconnect needed)" : ""}`);
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

      <section id="plan">
        <Label className="mb-2">Plan</Label>
        {sp.upgraded && <p className="mb-3 rounded-md border border-scrub/30 bg-mint px-3 py-2 text-sm text-scrub-dark">Payment received. Your plan updates within a minute.</p>}
        <Card className="p-5 md:p-6">
          <p className="text-sm text-ink-2">
            Prices in {market.currency}. You&apos;re on <strong>{u.plan.name}</strong>. {u.used} of {u.limit} agent runs used this month (sample runs in demo mode don&apos;t count).
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.id} className={`rounded-3xl p-5 ring-1 ${p.id === ws.plan ? "bg-mint ring-scrub" : "ring-line"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold">{p.name}</span>
                  {p.id === ws.plan && <Badge tone="green">Current</Badge>}
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                  {p.id === "free" ? "Free" : formatPrice(market, planPrice(p, market))}
                  <span className="text-xs font-semibold text-ink-3">{p.id === "free" ? "" : "/mo"}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-2">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <PlanButtons current={ws.plan} stripe={stripeEnabled()} hasCustomer={!!ws.stripe_customer_id} hasSubscription={!!ws.stripe_subscription_id} contact={BRAND.contactEmail} />
          </div>
        </Card>
      </section>
    </div>
  );
}
