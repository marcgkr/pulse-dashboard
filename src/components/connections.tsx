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
  google: { title: "Google", what: "Google Ads, Search Console, your YouTube channel and your Business Profile", uses: ["ads", "keywords", "content", "gbp"] },
  meta: { title: "Meta", what: "Facebook and Instagram ads, plus your Page and Instagram posts and Reels", uses: ["ads", "content"] },
  tiktok: { title: "TikTok", what: "Your TikTok videos and how they performed", uses: ["content"] },
};

// The same lists as PROVIDER_KINDS in the store (kept here so this client file doesn't import server code).
const KINDS: Record<ClientConnection["provider"], Kind[]> = {
  google: ["google_ads", "search_console", "gbp_location", "youtube_channel"],
  meta: ["meta_ads", "instagram_account", "facebook_page"],
  tiktok: ["tiktok_account"],
};

const KIND_LABEL: Record<Kind, string> = {
  google_ads: "Google Ads accounts",
  search_console: "Search Console property",
  meta_ads: "Ad accounts",
  instagram_account: "Instagram accounts",
  facebook_page: "Facebook Pages",
  youtube_channel: "YouTube channels",
  tiktok_account: "TikTok account",
  gbp_location: "Business Profile location for this outlet",
};

const KIND_NAME: Record<Kind, string> = {
  google_ads: "Google Ads",
  search_console: "Search Console",
  meta_ads: "your ad accounts",
  instagram_account: "Instagram",
  facebook_page: "your Facebook Pages",
  youtube_channel: "YouTube",
  tiktok_account: "your TikTok videos",
  gbp_location: "your Business Profile",
};

const SOCIAL: Kind[] = ["instagram_account", "facebook_page", "youtube_channel", "tiktok_account"];

const pill =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200";

export function ConnectionCard({ c, lastSync, livePlan, gbpPlan }: { c: ClientConnection; lastSync: string | null; livePlan: boolean; gbpPlan: boolean }) {
  const router = useRouter();
  const copy = COPY[c.provider];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = !c.ready ? "off" : !c.connected ? "none" : c.needsReconnect ? "reconnect" : "on";
  // Business Profile only shows once Google has approved the API and it's switched on (the login asked for it).
  const kinds = KINDS[c.provider].filter((k) => k !== "gbp_location" || c.gbpReady);

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
              Read-only: we see your performance numbers and your own posts, and never change or post anything. Disconnect any time.
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
              <AccountPicker key={k} provider={c.provider} kind={k} c={c} livePlan={livePlan} gbpPlan={gbpPlan} />
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

function AccountPicker({ provider, kind, c, livePlan, gbpPlan }: { provider: ClientConnection["provider"]; kind: Kind; c: ClientConnection; livePlan: boolean; gbpPlan: boolean }) {
  const router = useRouter();
  const accounts = c.accounts.filter((a) => a.kind === kind);
  const [selected, setSelected] = useState<string[]>(accounts.filter((a) => a.selected).map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const single = kind === "search_console" || kind === "gbp_location";

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

  const social = SOCIAL.includes(kind);
  let note: string | null = null;
  if (kind === "google_ads" && !c.adsReady) note = "Google Ads isn't switched on yet. Upload your Google Ads exports instead.";
  else if (!c.granted.includes(kind)) {
    // A social kind that was never asked for (connected before it existed) is only worth one line.
    note = `We can't see ${KIND_NAME[kind]} on this connection. Click Reconnect and allow it.`;
  } else if (accounts.length === 0) {
    note =
      kind === "search_console"
        ? "No Search Console properties on this login."
        : kind === "instagram_account"
          ? "No Instagram professional account is linked to your Facebook Pages. Link it in Instagram > Settings > Account type and tools, then reconnect."
          : kind === "gbp_location"
            ? "No Business Profile locations on this login. Connect with the Google account that owns or manages the profile."
            : social
            ? `No ${KIND_LABEL[kind]} on this login.`
            : "No ad accounts on this login.";
  }

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
            <p className="mt-2 text-xs text-ink-3">
              {kind === "gbp_location" ? "Pick this outlet's location." : single ? "Pick the property for your website." : "Tick the accounts you want us to read."}
            </p>
          )}
          {kind === "gbp_location" && !gbpPlan && <p className="mt-2 text-xs text-ink-3">Business Profile fixes, posts and review replies are on the Pro plan.</p>}
          {social && selected.length > 0 && (
            <p className="mt-2 text-xs text-ink-3">We read your latest videos for Social Media Content ideas and to link them in your articles.</p>
          )}
          {!social && kind !== "search_console" && !livePlan && (
            <p className="mt-2 text-xs text-ink-3">Ads Doctor reads these on the Growth and Pro plans. Until you upgrade, upload your exports.</p>
          )}
        </>
      )}
      <FormError error={error} />
    </div>
  );
}

type Library = { videos: number; byPlatform: Partial<Record<"instagram" | "facebook" | "youtube" | "tiktok", number>>; transcribed: number; transcribeCap: number; transcriptionOn: boolean };

const PLATFORM_NAME = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok" } as const;

/** What we've read from the owner's own social accounts, with a "Read my posts now" button. */
export function VideoLibraryCard({ lib, syncedAt, hasAccounts }: { lib: Library; syncedAt: string | null; hasAccounts: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/social/sync", { method: "POST" }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string; done?: boolean; errors?: string[] } | null;
    setBusy(false);
    if (!res?.ok) return setError(body?.error ?? "Couldn't read your posts. Try again.");
    if (body?.errors?.length) setError(body.errors.join(" "));
    setMsg(body?.done ? "Done." : "Still reading. Refresh in a few minutes to see the rest.");
    router.refresh();
  }

  const parts = (Object.keys(PLATFORM_NAME) as (keyof typeof PLATFORM_NAME)[]).filter((p) => lib.byPlatform[p]).map((p) => `${lib.byPlatform[p]} from ${PLATFORM_NAME[p]}`);
  let transcripts: string;
  if (lib.transcribeCap === 0) transcripts = "Growth and Pro also transcribe your latest videos, so the specialists know what you said in them.";
  else if (!lib.transcriptionOn) transcripts = `Your plan transcribes your latest ${lib.transcribeCap} videos. Transcription isn't switched on yet; we use titles and captions for now.`;
  else transcripts = `${lib.transcribed} of your latest ${lib.transcribeCap} videos transcribed. Instagram and Facebook share the video so we can transcribe it; YouTube and TikTok don't, so we use the title and caption.`;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Your videos</h2>
          <p className="text-sm text-ink-2">Your own posts from the accounts you ticked above, for Social Media Content and your Keyword Lab articles.</p>
        </div>
        <Badge tone={lib.videos ? "green" : "neutral"}>{lib.videos ? `${lib.videos} videos` : "None yet"}</Badge>
      </div>
      <div className="mt-4 space-y-1 text-sm text-ink-2">
        {!hasAccounts ? (
          <p>Connect Meta, Google or TikTok and tick your Instagram, Facebook Page, YouTube channel or TikTok account above.</p>
        ) : (
          <>
            <p>{parts.length ? parts.join(", ") + "." : "Nothing read yet."}</p>
            <p>{syncedAt ? `Last read ${syncedAt}. We read them again before each content plan when they're more than 12 hours old.` : "Not read yet."}</p>
            <p>{transcripts}</p>
          </>
        )}
      </div>
      {hasAccounts && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => void sync()}>
            <RefreshCw size={15} className={busy ? "animate-spin" : undefined} /> {busy ? "Reading your posts..." : "Read my posts now"}
          </Button>
          {msg && <span className="text-sm text-ink-2">{msg}</span>}
        </div>
      )}
      <FormError error={error} />
    </Card>
  );
}
