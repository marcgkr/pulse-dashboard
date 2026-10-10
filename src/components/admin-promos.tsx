"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Input, cx } from "./ui";
import { CopyButton } from "./copy-button";

export type AdminPromo = {
  code: string;
  plan: string;
  planName: string;
  days: number | null;
  max_uses: number | null;
  uses: number;
  redeem_by: string | null;
  note: string;
  active: boolean;
  redemptions: { workspaceId: string; business: string; email: string; until: string | null; redeemedAt: string; live: boolean }[];
};

const PLAN_OPTIONS = [
  { id: "pro", name: "Pro" },
  { id: "growth", name: "Growth" },
  { id: "starter", name: "Starter" },
];

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

type Draft = { code: string; plan: string; days: string; max_uses: string; redeem_by: string; note: string };

function fromPromo(p: AdminPromo): Draft {
  return { code: p.code, plan: p.plan, days: p.days ? String(p.days) : "", max_uses: p.max_uses ? String(p.max_uses) : "", redeem_by: p.redeem_by?.slice(0, 10) ?? "", note: p.note };
}

/** The fields shared by "create" and "edit". */
function PromoFields({ d, set, withCode }: { d: Draft; set: (k: keyof Draft, v: string) => void; withCode?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {withCode && (
        <Field label="Code" hint="Leave blank and we'll make one up.">
          <Input value={d.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="FRIENDS30" maxLength={32} className="uppercase" />
        </Field>
      )}
      <Field label="Plan it unlocks">
        <select value={d.plan} onChange={(e) => set("plan", e.target.value)} className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[15px]">
          {PLAN_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Free for (days)" hint="Blank: until you end it.">
        <Input value={d.days} onChange={(e) => set("days", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="30" />
      </Field>
      <Field label="How many people can use it" hint="Blank: no limit.">
        <Input value={d.max_uses} onChange={(e) => set("max_uses", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="5" />
      </Field>
      <Field label="Last day to redeem" hint="Blank: no deadline.">
        <Input type="date" value={d.redeem_by} onChange={(e) => set("redeem_by", e.target.value)} />
      </Field>
      <Field label="Note (only you see it)">
        <Input value={d.note} onChange={(e) => set("note", e.target.value)} placeholder="Friends testing in October" maxLength={200} />
      </Field>
    </div>
  );
}

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't work. Try again.";
}

const payload = (d: Draft) => ({ plan: d.plan, days: d.days || null, max_uses: d.max_uses || null, redeem_by: d.redeem_by || null, note: d.note });

export function AdminPromos({ promos }: { promos: AdminPromo[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ code: "", plan: "pro", days: "30", max_uses: "5", redeem_by: "", note: "" });
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated("");
    const res = await fetch("/api/admin/promos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: draft.code || undefined, ...payload(draft) }) });
    const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error || "That code wasn't created.");
    setCreated(data.code ?? "");
    setDraft((d) => ({ ...d, code: "", note: "" }));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <form onSubmit={create}>
          <p className="mb-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            A code puts an account on a plan for free for a while, then it drops back to whatever they pay for. Nothing is charged. Send people the signup link, or
            they can type the code at signup or in Settings.
          </p>
          <PromoFields d={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} withCode />
          {error && <p className="mt-3 text-sm text-pulse">{error}</p>}
          {created && (
            <p className="mt-3 text-sm text-good">
              Created <strong>{created}</strong>. Its signup link is in the list below.
            </p>
          )}
          <Button type="submit" disabled={busy} className="mt-4">
            {busy ? "Creating..." : "Create code"}
          </Button>
        </form>
      </Card>

      {promos.length === 0 ? (
        <p className="text-sm text-ink-2">No codes yet.</p>
      ) : (
        promos.map((p) => <PromoRow key={p.code} p={p} />)
      )}
    </div>
  );
}

function PromoRow({ p }: { p: AdminPromo }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(fromPromo(p));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/signup?code=${p.code}`;
  const expired = p.redeem_by != null && Date.parse(p.redeem_by) < Date.now();
  const usedUp = p.max_uses != null && p.uses >= p.max_uses;

  async function act(fn: () => Promise<string | null>) {
    setBusy(true);
    setError("");
    const err = await fn();
    setBusy(false);
    if (err) return setError(err);
    setEditing(false);
    router.refresh();
  }

  const url = `/api/admin/promos/${encodeURIComponent(p.code)}`;
  return (
    <Card className={cx("overflow-hidden", !p.active && "opacity-70")}>
      <div className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold tracking-wide">{p.code}</span>
            <Badge tone={p.active && !expired && !usedUp ? "green" : "neutral"}>{!p.active ? "Switched off" : expired ? "Expired" : usedUp ? "Used up" : "Active"}</Badge>
          </div>
          <p className="mt-1 text-[15px] text-ink">
            {p.planName} {p.days ? `free for ${p.days} days` : "free until you end it"} · used {p.uses}
            {p.max_uses ? ` of ${p.max_uses}` : ""}
            {p.redeem_by ? ` · redeem by ${day(p.redeem_by)}` : ""}
          </p>
          {p.note && <p className="text-sm text-ink-2">{p.note}</p>}
          <p className="mt-2 break-all font-mono text-xs text-ink-2">{link}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopyButton text={link} label="Copy signup link" />
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-line hover:ring-ink-3">
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => send(url, "PATCH", { active: !p.active }))}
            className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-line hover:ring-ink-3 disabled:opacity-50"
          >
            {p.active ? "Switch off" : "Switch on"}
          </button>
          {p.uses === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => window.confirm(`Delete ${p.code}?`) && act(() => send(url, "DELETE"))}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink-2 ring-1 ring-line hover:text-pulse hover:ring-pulse disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-5 pb-3 text-sm text-pulse md:px-6">{error}</p>}

      {editing && (
        <div className="border-t border-line bg-paper/60 p-5 md:p-6">
          <PromoFields d={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} />
          <p className="mt-3 text-sm text-ink-2">Changes apply to people who redeem the code from now on. To change someone who already used it, end their access below.</p>
          <Button type="button" disabled={busy} className="mt-3" onClick={() => act(() => send(url, "PATCH", payload(draft)))}>
            Save changes
          </Button>
        </div>
      )}

      {p.redemptions.length > 0 && (
        <div className="border-t border-line">
          <p className="px-5 pt-4 text-sm font-semibold md:px-6">Who used it</p>
          <ul className="divide-y divide-line">
            {p.redemptions.map((r) => (
              <li key={r.workspaceId} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
                <div className="min-w-0 text-sm">
                  <span className="font-semibold">{r.business}</span> <span className="text-ink-2">{r.email}</span>
                  <span className="block text-ink-2">
                    Redeemed {day(r.redeemedAt)} · {r.live ? (r.until ? `free until ${day(r.until)}` : "free until you end it") : `ended ${day(r.until)}`}
                  </span>
                </div>
                {r.live && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => window.confirm(`End ${r.business}'s free access now?`) && act(() => send("/api/admin/promos/end", "POST", { workspaceId: r.workspaceId }))}
                    className="shrink-0 self-start rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink-2 ring-1 ring-line hover:text-pulse hover:ring-pulse disabled:opacity-50"
                  >
                    End access now
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
