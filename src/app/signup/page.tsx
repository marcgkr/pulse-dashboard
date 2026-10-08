import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Start free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ website?: string; plan?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.website) qs.set("website", sp.website);
  if (sp.plan) qs.set("plan", sp.plan);
  const next = `/onboarding${qs.size ? `?${qs}` : ""}`;
  if (await currentUser()) redirect(next);
  return (
    <AuthShell title="Start with a free checkup" sub="No card needed. Your first Site Doctor report takes about a minute.">
      <AuthForm mode="signup" next={next} />
    </AuthShell>
  );
}
