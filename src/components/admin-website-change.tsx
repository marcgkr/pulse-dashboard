"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, Textarea } from "./ui";
import { CopyButton } from "./copy-button";

/** Admin: shows the website password only after a click. Each reveal is recorded on the server. */
export function RevealPassword({ requestId }: { requestId: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function reveal() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/website-changes/${requestId}/reveal`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { password?: string; error?: string };
    setBusy(false);
    if (!res.ok || !data.password) return setError(data.error || "Couldn't reveal the password.");
    setPassword(data.password);
  }
  if (password !== null) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-paper px-2 py-1 font-mono text-sm" data-testid="revealed-password">
          {password}
        </code>
        <CopyButton text={password} />
        <button type="button" onClick={() => setPassword(null)} className="text-xs font-semibold text-ink-3 hover:text-ink">
          Hide
        </button>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={reveal} disabled={busy} className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink ring-1 ring-line hover:ring-ink-3 disabled:opacity-50">
        {busy ? "One moment..." : "Reveal password"}
      </button>
      {error && <span className="text-sm text-pulse">{error}</span>}
    </span>
  );
}

/** Admin: moves a round to in progress or done, with a note the owner sees. */
export function RoundStatusForm({ requestId, status, note }: { requestId: string; status: string; note: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [text, setText] = useState(note);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch(`/api/admin/website-changes/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: value, note: text }),
    });
    setState(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Status</span>
        <Select value={value} onChange={(e) => setValue(e.target.value)} className="sm:w-72">
          <option value="submitted">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </Select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Note for the owner</span>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="What we changed, or anything we need from them." />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"}>
          {state === "saving" ? "Saving..." : "Save"}
        </Button>
        {state === "saved" && <span className="text-sm text-scrub">Saved. The owner sees it on their Website changes page.</span>}
        {state === "error" && <span className="text-sm text-pulse">That didn&apos;t save. Try again.</span>}
      </div>
    </form>
  );
}
