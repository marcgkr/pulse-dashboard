import { redirect } from "next/navigation";
import { currentUser, workspaceFor } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ website?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (workspaceFor(user.id)) redirect("/app");
  const sp = await searchParams;
  return (
    <main className="chart-grid min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo className="mb-8" />
        <div className="rounded-lg border border-line bg-card p-6 md:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">New patient intake</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Tell us about your business</h1>
          <p className="mb-6 mt-2 text-ink-2">
            Every agent reads this before it advises you, so the more specific you are, the more specific the prescriptions. You can change it later.
          </p>
          <ProfileForm mode="create" initial={{ website: sp.website ?? "", location: "Singapore" }} />
        </div>
      </div>
    </main>
  );
}
