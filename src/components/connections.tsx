"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, RefreshCw, Unplug } from "lucide-react";
import type { ClientAccount, ClientConnection } from "@/lib/connectors/store";
import { agentColor } from "@/lib/agent-colors";
import { Badge, Button, Card, cx } from "./ui";
import { FormError } from "./run-agent";

type Kind = ClientAccount["kind"];

const COPY: Record<ClientConnection["provider"], { title: string; what: string; uses: string[] }> = {
  google: { title: "Google", what: "Google Ads and Search Console", uses: ["ads", "keywords"] },
  meta: { title: "Meta", what: "Facebook and Instagram ads", uses: ["ads"] },
};

const KIND_LABEL: Record<Kind, string> = { google_ads: "Google Ads accounts", search_console: "Search Console property", meta_ads: "Ad accounts" };

const pill =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200";

export function ConnectionCard({ c, lastSync, livePlan }: { c: ClientConnection; lastSync: string | null; livePlan: boolean }) {
  const router = useRouter();
  const copy = COPY[c.provider];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = !c.ready ? "off" : !c.connected ? "none" : c.needsReconnect ? "reconnect" : "on";
  const kinds: Kind[] = c.provider === "google" ? ["google_ads", "search_console"] : ["meta_ads"];

  async function disconnect() {
    if (!window.confirm(`Disconnect ${copy.title}? We delete the access you gave us. Past reports stay.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/connect/${c.provider}/disconnect`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't disconnect. Try again.");
    router.refresh();
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{copy.title}</h2>
          <p className="text-sm text-ink-2">{copy.what}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {copy.uses.map((a) => (
              <span key={a} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-ink", agentColor(a).soft)}>
                <span className={cx("h-2 w-2 rounded-full", agentColor(a).dot)} /> {agentColor(a).label}
              </span>
            ))}
          </div>
        </div>
        <Badge tone={status === "on" ? "green" : status === "reconnect" ? "amber" : "neutral"}>
          {status === "on" ? "Connected" : status === "reconnect" ? "Reconnect needed" : status === "off" ? "Not set up yet" : "Not connected"}
        </Badge>
      </div>

      {status === "off" ? (
        <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm text-ink-2">This connection isn&apos;t switched on yet. Upload your exports instead.</p>
      ) : (
        <>
          {!c.connected && (
            <p className="mt-4 text-sm text-ink-2">
              {c.provider === "google" && !c.adsReady
                ? "Google Ads isn't switched on yet, so this connects Search Console only. "
                : ""}
              Read-only: we see your performance numbers and never change anything. Disconnect any time.
            </p>
          )}

          {c.connected && (
            <div className="mt-4 space-y-0.5 text-sm text-ink-2">
              {c.externalUser && (
                <p>
                  Connected as <span className="font-semibold text-ink">{c.externalUser}</span>
                </p>
              )}
              <p>{lastSync ? `Last read ${lastSync}` : "Not read yet. Your next report reads it."}</p>
              {c.lastError && <p className="text-pulse">{c.lastError}</p>}
            </div>
          )}

          {c.connected &&
            kinds.map((k) => (
              <AccountPicker key={k} provider={c.provider} kind={k} c={c} livePlan={livePlan} />
            ))}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* A plain link: the start route redirects to Google or Facebook. */}
            <a
              href={`/api/connect/${c.provider}/start`}
              className={cx(pill, c.connected ? "bg-card text-ink ring-1 ring-line hover:ring-ink-3" : "bg-scrub text-white hover:bg-scrub-dark")}
            >
              {c.connected ? <RefreshCw size={15} /> : <Link2 size={15} />} {c.connected ? "Reconnect" : `Connect ${copy.title}`}
            </a>
            {c.connected && (
              <Button variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                <Unplug size={15} /> {busy ? "Disconnecting..." : "Disconnect"}
              </Button>
            )}
          </div>
          <FormError error={error} />
        </>
      )}
    </Card>
  );
}

function AccountPicker({ provider, kind, c, livePlan }: { provider: ClientConnection["provider"]; kind: Kind; c: ClientConnection; livePlan: boolean }) {
  const router = useRouter();
  const accounts = c.accounts.filter((a) => a.kind === kind);
  const [selected, setSelected] = useState<string[]>(accounts.filter((a) => a.selected).map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const single = kind === "search_console";

  async function save(ids: string[]) {
    const before = selected;
    setSelected(ids);
    setSaving(true);
    setError(null);
    const res = await fetch("/api/connect/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, kind, ids }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setSelected(before);
      return setError("Couldn't save that choice. Try again.");
    }
    router.refresh();
  }

  let note: string | null = null;
  if (kind === "google_ads" && !c.adsReady) note = "Google Ads isn't switched on yet. Upload your Google Ads exports instead.";
  else if (!c.granted.includes(kind)) note = `You didn't give access to ${kind === "search_console" ? "Search Console" : kind === "google_ads" ? "Google Ads" : "your ad accounts"}. Click Reconnect and tick that box.`;
  else if (accounts.length === 0) note = kind === "search_console" ? "No Search Console properties on this login." : "No ad accounts on this login.";

  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold text-ink">{KIND_LABEL[kind]}</p>
      {note ? (
        <p className="text-sm text-ink-3">{note}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {accounts.map((a) => {
              const on = selected.includes(a.id);
              return (
                <label key={a.id} className={cx("flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-2.5 text-sm ring-1 transition", on ? "bg-mint ring-scrub/40" : "bg-card ring-line hover:ring-ink-3")}>
                  <input
                    type={single ? "radio" : "checkbox"}
                    name={`${provider}-${kind}`}
                    checked={on}
                    disabled={saving}
                    onChange={() => void save(single ? (on ? [] : [a.id]) : on ? selected.filter((x) => x !== a.id) : [...selected, a.id])}
                    onClick={(e) => {
                      // Clicking the chosen property again clears it.
                      if (single && on) {
                        e.preventDefault();
                        void save([]);
                      }
                    }}
                    className="h-4 w-4 accent-[var(--color-scrub)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.currency && <span className="font-mono text-xs text-ink-3">{a.currency}</span>}
                </label>
              );
            })}
          </div>
          {selected.length === 0 && (
            <p className="mt-2 text-xs text-ink-3">{single ? "Pick the property for your website." : "Tick the accounts you want us to read."}</p>
          )}
          {kind !== "search_console" && !livePlan && (
            <p className="mt-2 text-xs text-ink-3">Ads Doctor reads these on the Growth and Pro plans. Until you upgrade, upload your exports.</p>
          )}
        </>
      )}
      <FormError error={error} />
    </div>
  );
}
