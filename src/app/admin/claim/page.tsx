import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { ClaimForm } from "@/components/claim-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin setup" };

export default async function ClaimPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");
  return (
    <AuthShell title="Admin setup" sub="Enter the ADMIN_SETUP_TOKEN from your server settings to make this account an admin.">
      <ClaimForm />
    </AuthShell>
  );
}
