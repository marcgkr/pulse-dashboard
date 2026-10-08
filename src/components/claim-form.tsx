"use client";

import { useState } from "react";
import { Button, Field, Input } from "./ui";
import { FormError } from "./run-agent";

export function ClaimForm() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch("/api/admin/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending(false);
          return setError(data.error || "Couldn't verify the token.");
        }
        window.location.href = "/admin";
      }}
    >
      <Field label="Setup token">
        <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Checking..." : "Make me an admin"}
      </Button>
    </form>
  );
}
