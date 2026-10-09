import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";
import { MARKETS } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";

export const metadata = { title: "Start free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ website?: string; plan?: string; country?: string }> }) {
  const sp = await searchParams;
  // The country chosen on the public site: from the link, else the saved cookie / browser guess.
  const fromLink = MARKETS.find((m) => m.code === sp.country?.toUpperCase())?.code;
  const country = fromLink ?? (await visitorMarket()).code;
  const qs = new URLSearchParams();
  if (sp.website) qs.set("website", sp.website);
  if (sp.plan) qs.set("plan", sp.plan);
  qs.set("country", country);
  const next = `/onboarding?${qs}`;
  if (await currentUser()) redirect(next);
  return (
    <AuthShell title="Start with a free checkup" sub="No card needed. Your first Site Doctor report takes about a minute.">
      <AuthForm mode="signup" next={next} />
    </AuthShell>
  );
}
