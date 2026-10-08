import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/app");
  return (
    <AuthShell title="Welcome back" sub="Log in to see your prescriptions.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
