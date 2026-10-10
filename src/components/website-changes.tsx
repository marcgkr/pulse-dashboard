"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, cx } from "./ui";

const errorOf = async (res: Response) => ((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't go through. Try again.";

/** Adds or stops the add-on on the plan subscription. Without online payment, an email link instead. */
export function WebcareToggle({ on, price, canBuy, contact }: { on: boolean; price: string; canBuy: boolean; contact: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: boolean) {
    const q = next
      ? `Add website changes by PULSE for ${price} a month? You're charged for the rest of this month now, on the card you pay with.`
      : "Stop website changes by PULSE? The rest of this month is credited to your next invoice.";
    if (!window.confirm(q)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/billing/webcare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: next }) });
    setBusy(false);
    if (!res.ok) return setError(await errorOf(res));
    router.refresh();
  }

  if (!canBuy) {
    const subject = on ? "MarketingRx: stop website changes" : "MarketingRx: add website changes";
    return (
      <a
        href={`mailto:${contact}?subject=${encodeURIComponent(subject)}`}
        className={cx(
          "inline-flex rounded-full px-5 py-2.5 text-sm font-semibold",
          on ? "text-ink-2 ring-1 ring-line hover:ring-ink-3" : "bg-scrub text-white hover:bg-scrub-dark",
        )}
      >
        {on ? `Email ${contact} to stop website changes` : `Email ${contact} to add website changes`}
      </a>
    );
  }
  return (
    <div className="space-y-2">
      {on ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => change(false)}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-2 ring-1 ring-line hover:text-pulse hover:ring-pulse disabled:opacity-50"
        >
          {busy ? "One moment..." : "Stop website changes"}
        </button>
      ) : (
        <Button type="button" disabled={busy} onClick={() => change(true)}>
          {busy ? "One moment..." : `Add website changes (${price}/month)`}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-pulse">
          {error}
        </p>
      )}
    </div>
  );
}

export type SavedLogin = { loginUrl: string; username: string; notes: string; hasPassword: boolean } | null;

/** The website login PULSE uses. The saved password never comes back to the browser: type a new one to replace it. */
export function WebsiteLoginForm({ initial }: { initial: SavedLogin }) {
  const router = useRouter();
  const [loginUrl, setLoginUrl] = useState(initial?.loginUrl ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [hasPassword, setHasPassword] = useState(Boolean(initial?.hasPassword));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/website-changes/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginUrl, username, password, notes }),
    });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: await errorOf(res) });
    const data = (await res.json()) as { login?: { loginUrl: string } };
    if (data.login?.loginUrl) setLoginUrl(data.login.loginUrl);
    setPassword("");
    setHasPassword(true);
    setMsg({ ok: true, text: "Login details saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="rounded-2xl bg-mint px-4 py-3 text-sm leading-relaxed text-scrub-dark">
        Create a separate staff or admin user for PULSE on your website, rather than sharing your own password. You can delete that user any time to remove our
        access.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website login page" hint="Where you log in to edit your site, for example https://yoursite.com/wp-admin">
          <Input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} maxLength={500} required autoComplete="off" inputMode="url" />
        </Field>
        <Field label="Username or email">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={200} required autoComplete="off" />
        </Field>
        <Field label="Password" hint={hasPassword ? "Saved. Leave it empty to keep it, or type a new one to replace it." : "Stored encrypted. Only the PULSE team can see it."}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={500}
            required={!hasPassword}
            autoComplete="new-password"
            placeholder={hasPassword ? "Saved" : ""}
          />
        </Field>
        <Field label="Notes for PULSE (optional)" hint="For example who to ask for a two-step login code, or which pages not to touch.">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : hasPassword ? "Update login details" : "Save login details"}
        </Button>
        {msg && (
          <p role="status" className={cx("text-sm", msg.ok ? "text-good" : "text-pulse")}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}

/** This round's changes: typed in, one per line, plus open prescriptions picked from the board. */
export function RoundForm({ tasks, blocked }: { tasks: { id: string; title: string; agent: string }[]; blocked: string | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm("Send this round to PULSE? You get two rounds a month.")) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/website-changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, taskIds: picked }) });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: await errorOf(res) });
    setText("");
    setPicked([]);
    setMsg({ ok: true, text: "Sent. The PULSE team has your changes and will mark the round done here." });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Changes for this round" hint="One change per line. Say which page and what to change, for example: Homepage: change the main headline to ...">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!!blocked} className="min-h-36" maxLength={40_000} />
      </Field>
      {tasks.length > 0 && (
        <fieldset disabled={!!blocked}>
          <legend className="mb-1.5 text-sm font-semibold">Add from your prescriptions</legend>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-line bg-white p-3">
            {tasks.map((t) => (
              <label key={t.id} className="flex items-start gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-paper">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={picked.includes(t.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))}
                />
                <span>
                  {t.title} <span className="text-xs text-ink-3">{t.agent}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !!blocked || (!text.trim() && picked.length === 0)}>
          {busy ? "Sending..." : "Submit this round"}
        </Button>
        {blocked && <p className="text-sm text-ink-2">{blocked}</p>}
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={cx("text-sm", msg.ok ? "text-good" : "text-pulse")}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
