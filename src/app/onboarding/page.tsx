import { redirect } from "next/navigation";
import { currentUser, ownedWorkspaces } from "@/lib/auth";
import { PLANS, outletLimit, planById } from "@/lib/config";
import { stripeEnabled } from "@/lib/billing";
import { checkPromo } from "@/lib/promos";
import { Logo } from "@/components/brand";
import { ProfileForm } from "@/components/profile-form";
import { marketFor } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ website?: string; country?: string; add?: string; code?: string; plan?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  // Pro accounts come back here (?add=1) to add another business or location.
  const owned = ownedWorkspaces(user.id);
  const adding = owned.length > 0;
  if (adding && (sp.add !== "1" || owned.length >= outletLimit(owned[0]))) redirect(sp.add === "1" ? "/app/settings#businesses" : "/app");
  // Only trust the param when it names a real market (marketFor falls back to the default otherwise).
  const param = sp.country?.toUpperCase();
  const country = param && marketFor(param).code === param ? param : (await visitorMarket()).code;
  let promo: ReturnType<typeof checkPromo> | null = null;
  try {
    promo = sp.code ? checkPromo(sp.code) : null;
  } catch {
    promo = null;
  }
  return (
    <main className="min-h-screen p-3 md:p-4">
      <div className="chart-grid min-h-[calc(100vh-1.5rem)] rounded-[2rem] bg-lilac/45 px-4 py-10 md:min-h-[calc(100vh-2rem)] md:rounded-[2.75rem] md:py-14">
        <div className="mx-auto max-w-2xl">
          <Logo className="mb-8" />
          <div className="rise rounded-[1.75rem] bg-card p-6 shadow-[var(--shadow-lift)] md:p-9">
            <h1 className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em] md:text-4xl">
              {adding ? "Set up your new outlet" : "Tell us about your business"}
            </h1>
            <p className="mb-7 mt-3 text-[15px] leading-relaxed text-ink-2">
              Every specialist reads this before it advises you, so the more specific you are, the more specific the prescriptions. You can change it later.
            </p>
            {!adding && promo && (
              <p className="mb-6 rounded-2xl bg-mint px-4 py-3 text-[15px] text-scrub-dark">
                Code <strong>{promo.code}</strong> gives you {planById(promo.plan).name}
                {promo.days ? ` free for ${promo.days} days` : " free"}. It&apos;s applied when you save.
              </p>
            )}
            <ProfileForm
              mode={adding ? "add" : "create"}
              initial={{
                website: sp.website ?? "",
                location: "",
                country: adding ? owned[0].country : country,
                promo: promo?.code,
                // A paid plan picked on the pricing page opens checkout after this step (only when payments are on).
                checkoutPlan: !adding && !promo && stripeEnabled() && PLANS.some((p) => p.id === sp.plan && p.id !== "free") ? sp.plan : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
