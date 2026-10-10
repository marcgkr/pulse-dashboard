import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { LIVE_SYNC_PLANS, type PlanId } from "@/lib/config";
import { clientConnections } from "@/lib/connectors/store";
import { marketFor } from "@/lib/markets";
import { ConnectionCard, VideoLibraryCard } from "@/components/connections";
import { hasSocialAccounts, libraryStatus } from "@/lib/social-sync";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Connected accounts" };
export const dynamic = "force-dynamic";

type Search = { connected?: string; error?: string; warn?: string; provider?: string };

function flash(sp: Search): { tone: "good" | "bad"; text: string } | null {
  const who = sp.provider === "meta" ? "Meta" : sp.provider === "google" ? "Google" : sp.provider === "tiktok" ? "TikTok" : "That account";
  if (sp.error === "denied") return { tone: "bad", text: `You cancelled the ${who} connection. Nothing was saved.` };
  if (sp.error === "state") return { tone: "bad", text: "That sign-in link expired or was opened in a different browser. Click Connect again." };
  if (sp.error === "exchange") return { tone: "bad", text: `${who} didn't let us finish connecting. Try again in a minute.` };
  if (sp.error === "not_ready") return { tone: "bad", text: "This connection isn't switched on yet. Upload your exports instead." };
  if (sp.error === "plan") return { tone: "bad", text: "Connecting accounts is part of the paid plans. Choose a plan in Settings first." };
  if (sp.error === "busy") return { tone: "bad", text: "Too many tries in a row. Wait a few minutes, then try again." };
  if (sp.error) return { tone: "bad", text: "Something went wrong. Try again." };
  if (sp.connected && sp.warn === "scopes")
    return { tone: "bad", text: "Connected, but the Google Ads and Search Console boxes weren't ticked, so we can't read anything yet. Click Reconnect and tick them." };
  if (sp.connected && sp.warn === "discover") return { tone: "bad", text: `${who} is connected, but we couldn't list all of your accounts yet. Click Reconnect in a few minutes.` };
  if (sp.connected) return { tone: "good", text: `${who} is connected. Check the accounts we'll read below.` };
  return null;
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { ws } = await requireWorkspace();
  const tz = marketFor(ws.country).timeZone;
  const conns = clientConnections(ws.id);
  const livePlan = LIVE_SYNC_PLANS.includes(ws.plan as PlanId);
  const msg = flash(sp);
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }) : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="Connected accounts">
        Connect once and the specialists read your latest numbers themselves: Ads Doctor your campaigns, Keyword Lab your Search Console searches, and Social Media
        Content your own Instagram, Facebook, YouTube and TikTok posts. Read-only: we never change your ads or post anything. You can disconnect any time.
      </PageHeader>

      {msg && (
        <p role="status" className={msg.tone === "good" ? "rounded-2xl bg-mint px-4 py-3 text-sm text-scrub-dark" : "rounded-2xl bg-pulse/5 px-4 py-3 text-sm text-pulse ring-1 ring-pulse/25"}>
          {msg.text}
        </p>
      )}

      {ws.plan === "free" ? (
        <div className="rounded-3xl bg-card p-6 ring-1 ring-line md:p-8">
          <h2 className="font-display text-xl font-bold">Connecting accounts is on the paid plans</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            On Starter and up, connect Google, Meta and your social accounts so the specialists read your real numbers and your own posts: Ads Doctor uses your
            campaigns, Keyword Lab your Search Console searches, and Social Media Content what already works on your channels when it looks for trends.
          </p>
          <Link href="/app/settings#plan" className="mt-5 inline-flex rounded-full bg-scrub px-5 py-2.5 text-sm font-semibold text-white hover:bg-scrub-dark">
            See the plans
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {conns.map((c) => (
              <ConnectionCard key={c.provider} c={c} lastSync={when(c.lastSyncAt)} livePlan={livePlan} gbpPlan={ws.plan === "pro"} />
            ))}
          </div>
          <VideoLibraryCard lib={libraryStatus(ws)} syncedAt={when(ws.videos_synced_at ?? null)} hasAccounts={hasSocialAccounts(ws.id)} />
        </>
      )}

      <div className="max-w-2xl space-y-2 text-sm text-ink-2">
        <p>
          <span className="font-semibold text-ink">What we read:</span> campaign, ad set, ad, keyword and search term performance from the ad accounts you tick, the
          searches your website shows up for from the Search Console property you pick, and your own videos with their captions, views and likes from the social
          accounts you tick. Nothing else.
        </p>
        <p>
          <span className="font-semibold text-ink">What we never do:</span> change budgets, pause ads, post or edit anything. You make every change yourself.
        </p>
        <p>
          Prefer not to connect? Upload your exports in{" "}
          <Link href="/app/agents/ads" className="font-semibold text-scrub underline underline-offset-2">
            Ads Doctor
          </Link>{" "}
          or paste them in{" "}
          <Link href="/app/agents/keywords" className="font-semibold text-scrub underline underline-offset-2">
            Keyword Lab
          </Link>
          .{" "}
          <Link href="/app/settings" className="font-semibold text-scrub underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>
    </div>
  );
}
