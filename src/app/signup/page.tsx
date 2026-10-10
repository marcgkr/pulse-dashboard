import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";
import { MARKETS } from "@/lib/markets";
import { visitorMarket } from "@/lib/market-server";

export const metadata = { title: "Start free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ website?: string; plan?: string; country?: string; email?: string; code?: string }> }) {
  const sp = await searchParams;
  // The country chosen on the public site: from the link, else the saved cookie / browser guess.
  const fromLink = MARKETS.find((m) => m.code === sp.country?.toUpperCase())?.code;
  const country = fromLink ?? (await visitorMarket()).code;
  const qs = new URLSearchParams();
  if (sp.website) qs.set("website", sp.website);
  if (sp.plan) qs.set("plan", sp.plan);
  qs.set("country", country);
  // Promo link from the admin console, e.g. /signup?code=FRIENDS30
  const code = typeof sp.code === "string" ? sp.code.trim().toUpperCase().slice(0, 32) : "";
  if (/^[A-Z0-9-]{3,32}$/.test(code)) qs.set("code", code);
  const next = `/onboarding?${qs}`;
  if (await currentUser()) redirect(next);
  return (
    <AuthShell
      title={qs.has("code") ? "You've been invited to try MarketingRx" : "Start with a free checkup"}
      sub={qs.has("code") ? "Create your account and your code is applied when you set up your business." : "No card needed. Your first Site Doctor report takes about a minute."}
    >
      <AuthForm mode="signup" next={next} defaultEmail={typeof sp.email === "string" ? sp.email.slice(0, 254) : undefined} defaultPromo={qs.get("code") ?? undefined} />
    </AuthShell>
  );
}
