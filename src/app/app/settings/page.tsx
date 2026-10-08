import { requireWorkspace } from "@/lib/auth";
import { PLANS, BRAND } from "@/lib/config";
import { stripeEnabled } from "@/lib/billing";
import { usage } from "@/lib/runs";
import { ProfileForm } from "@/components/profile-form";
import { WindsorForm, PlanButtons } from "@/components/settings-forms";
import { Badge, Card, Label, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const sp = await searchParams;
  const { ws } = await requireWorkspace();
  const u = usage(ws);
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

      <section>
        <Label className="mb-2">Connections</Label>
        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-semibold">Windsor.ai (Google Ads and Meta Ads sync)</h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">
            Connect your ad accounts to Windsor.ai, then paste your Windsor API key here. Ads Doctor will pull your last 30 days automatically instead of you uploading
            exports. Your key is stored on our server and only used to read your ad data.
          </p>
          <WindsorForm connected={!!ws.windsor_api_key} />
        </Card>
      </section>

      <section id="plan">
        <Label className="mb-2">Plan</Label>
        {sp.upgraded && <p className="mb-3 rounded-md border border-scrub/30 bg-mint px-3 py-2 text-sm text-scrub-dark">Payment received. Your plan updates within a minute.</p>}
        <Card className="p-5 md:p-6">
          <p className="text-sm text-ink-2">
            You&apos;re on <strong>{u.plan.name}</strong>. {u.used} of {u.limit} agent runs used this month (sample runs in demo mode don&apos;t count).
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.id} className={`rounded-md border p-4 ${p.id === ws.plan ? "border-scrub bg-mint/50" : "border-line"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold">{p.name}</span>
                  {p.id === ws.plan && <Badge tone="green">Current</Badge>}
                </div>
                <div className="mt-1 font-mono text-xl tabular-nums">{p.priceMonthly ? `S$${p.priceMonthly}` : "Free"}<span className="text-xs text-ink-3">{p.priceMonthly ? "/mo" : ""}</span></div>
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
