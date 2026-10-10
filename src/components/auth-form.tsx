"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input } from "./ui";
import { FormError } from "./run-agent";

export function AuthForm({ mode, next, defaultEmail, defaultPromo }: { mode: "login" | "signup"; next?: string; defaultEmail?: string; defaultPromo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromo, setShowPromo] = useState(Boolean(defaultPromo));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    // Check a promo code before creating the account, so a typo can be fixed first.
    const promo = String(form.promo ?? "").trim().toUpperCase();
    delete form.promo;
    if (mode === "signup" && promo) {
      const check = await fetch("/api/promo/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: promo }) });
      if (!check.ok) {
        setError(((await check.json().catch(() => ({}))) as { error?: string }).error || "That code isn't valid.");
        setPending(false);
        return;
      }
    }
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setPending(false);
      return;
    }
    let to = next || (mode === "signup" ? "/onboarding" : "/app");
    if (mode === "signup" && promo) {
      const u = new URL(to, window.location.origin);
      u.searchParams.set("code", promo);
      to = u.pathname + u.search;
    }
    router.push(to);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <Field label="Your name">
          <Input name="name" autoComplete="name" required />
        </Field>
      )}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <Input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required />
      </Field>
      {mode === "signup" &&
        (showPromo ? (
          <Field label="Promo code" hint="Leave blank if you don't have one.">
            <Input name="promo" defaultValue={defaultPromo} autoComplete="off" spellCheck={false} className="uppercase" />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowPromo(true)} className="text-sm font-semibold text-scrub hover:underline">
            Have a promo code?
          </button>
        ))}
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "One moment..." : mode === "signup" ? "Create account" : "Log in"}
      </Button>
      <p className="text-center text-sm text-ink-2">
        {mode === "signup" ? (
          <>
            Already have an account? <Link className="font-semibold text-scrub hover:underline" href="/login">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link className="font-semibold text-scrub hover:underline" href="/signup">Start free</Link>
          </>
        )}
      </p>
    </form>
  );
}
