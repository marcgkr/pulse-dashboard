import { redirect } from "next/navigation";
import { currentUser, workspaceFor } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { ProfileForm } from "@/components/profile-form";
import { marketFor } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ website?: string; country?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (workspaceFor(user.id)) redirect("/app");
  const sp = await searchParams;
  // Only trust the param when it names a real market (marketFor falls back to the default otherwise).
  const param = sp.country?.toUpperCase();
  const country = param && marketFor(param).code === param ? param : (await visitorMarket()).code;
  return (
    <main className="min-h-screen p-3 md:p-4">
      <div className="chart-grid min-h-[calc(100vh-1.5rem)] rounded-[2rem] bg-lilac/45 px-4 py-10 md:min-h-[calc(100vh-2rem)] md:rounded-[2.75rem] md:py-14">
        <div className="mx-auto max-w-2xl">
          <Logo className="mb-8" />
          <div className="rise rounded-[1.75rem] bg-card p-6 shadow-[var(--shadow-lift)] md:p-9">
            <h1 className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em] md:text-4xl">Tell us about your business</h1>
            <p className="mb-7 mt-3 text-[15px] leading-relaxed text-ink-2">
              Every specialist reads this before it advises you, so the more specific you are, the more specific the prescriptions. You can change it later.
            </p>
            <ProfileForm mode="create" initial={{ website: sp.website ?? "", location: "", country }} />
          </div>
        </div>
      </div>
    </main>
  );
}
