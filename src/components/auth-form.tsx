"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input } from "./ui";
import { FormError } from "./run-agent";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget));
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
    router.push(next || (mode === "signup" ? "/onboarding" : "/app"));
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
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <Input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required />
      </Field>
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
