"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardList,
  FileSearch,
  FileText,
  KeyRound,
  LifeBuoy,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Telescope,
  X,
  Wrench,
} from "lucide-react";
import { cx } from "./ui";
import { agentColor } from "@/lib/agent-colors";

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  site: Stethoscope,
  keywords: KeyRound,
  visibility: Telescope,
  content: Sparkles,
  ads: BarChart3,
  compliance: ShieldCheck,
};

export type NavProps = {
  agents: { id: string; name: string }[];
  openTasks: number;
  businessName: string;
  /** Pro: every business on the login, the open one, and whether another can be added. */
  businesses: { id: string; name: string }[];
  currentId: string;
  canAdd: boolean;
  plan: string;
  used: number;
  limit: number;
  demo: boolean;
  admin: boolean;
  /** Team replies in the Help chat the owner hasn't read yet. */
  supportUnread: number;
};

function Item({
  href,
  icon: Icon,
  label,
  badge,
  exact,
  dot,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
  exact?: boolean;
  dot?: string;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center gap-3 rounded-full px-3.5 py-2 text-[14.5px] transition",
        active ? "bg-white font-semibold text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
      aria-current={active ? "page" : undefined}
    >
      {dot ? <span className={cx("grid h-6 w-6 place-items-center rounded-full text-ink", dot)}><Icon size={14} /></span> : <Icon size={17} />}
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-pulse px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}

/** The unread badge on Help. Checks again on every page change and every minute; clears on the Help page itself. */
function useSupportUnread(initial: number): number {
  const path = usePathname();
  const onHelp = path === "/app/help";
  const [unread, setUnread] = useState(initial);
  useEffect(() => {
    if (onHelp) {
      setUnread(0);
      return;
    }
    let live = true;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/support/unread", { cache: "no-store" });
        const data = res.ok ? ((await res.json()) as { unread?: number }) : null;
        if (live && typeof data?.unread === "number") setUnread(data.unread);
      } catch {
        /* keep the last count */
      }
    };
    void check();
    const timer = setInterval(check, 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [path, onHelp]);
  return onHelp ? 0 : unread;
}

export function AppNav(props: NavProps) {
  const supportUnread = useSupportUnread(props.supportUnread);
  const [switching, setSwitching] = useState(false);
  async function switchTo(id: string) {
    setSwitching(true);
    const res = await fetch("/api/workspace/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) window.location.assign("/app");
    else setSwitching(false);
  }
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <Link href="/app" className="flex items-center gap-2 px-3" onClick={() => setOpen(false)}>
        <svg width="26" height="20" viewBox="0 0 30 22" fill="none" aria-hidden>
          <path d="M1 13h7l2.5-7 4 13 3-9 1.8 3H29" stroke="var(--color-pulse)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-display text-lg font-bold text-white">
          Marketing<span className="text-pulse">Rx</span>
        </span>
      </Link>

      <div className="px-1">
        <div className="rounded-2xl bg-white/[0.07] px-3.5 py-3">
          {props.businesses.length > 1 ? (
            <label className="block">
              <span className="text-xs font-semibold text-white/60">Your business</span>
              <select
                value={props.currentId}
                disabled={switching}
                onChange={(e) => switchTo(e.target.value)}
                className="mt-0.5 w-full truncate rounded-lg bg-transparent font-display text-[15px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-lilac [&>option]:text-ink"
              >
                {props.businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <div className="text-xs font-semibold text-white/60">Your business</div>
              <div className="truncate font-display text-[15px] font-bold text-white">{props.businessName}</div>
            </>
          )}
          {props.canAdd && (
            <Link href="/onboarding?add=1" className="mt-1.5 inline-block text-[13px] font-semibold text-lilac hover:text-white">
              + Add an outlet
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-0.5" onClick={() => setOpen(false)}>
        <Item href="/app" icon={Activity} label="Chart" exact />
        <Item href="/app/plan" icon={ClipboardList} label="Prescriptions" badge={props.openTasks} />
        <Item href="/app/ask" icon={MessageCircle} label="Ask PULSE" />
        <Item href="/app/reports" icon={FileText} label="Reports" />
      </div>

      <div onClick={() => setOpen(false)}>
        <div className="mb-1.5 px-3.5 text-[12px] font-semibold text-white/45">Specialists</div>
        <div className="space-y-0.5">
          {props.agents.map((a) => (
            <Item key={a.id} href={`/app/agents/${a.id}`} icon={AGENT_ICONS[a.id] ?? FileSearch} label={a.name} dot={agentColor(a.id).box} />
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3" onClick={() => setOpen(false)}>
        {props.demo && (
          <div className="rounded-2xl bg-amber/15 px-3.5 py-2.5 text-xs leading-relaxed text-amber">
            Demo mode: agents return sample output until an Anthropic API key is set.
          </div>
        )}
        <div className="px-3">
          <div className="flex justify-between text-[12px] font-semibold text-white/50">
            <span>{props.plan} plan</span>
            <span>
              {props.used}/{props.limit} reports
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-lilac" style={{ width: `${Math.min(100, (props.used / Math.max(1, props.limit)) * 100)}%` }} />
          </div>
        </div>
        <div className="space-y-0.5">
          {props.admin && <Item href="/admin" icon={Wrench} label="Admin" />}
          <Item href="/app/help" icon={LifeBuoy} label="Help" badge={supportUnread} />
          <Item href="/app/settings" icon={Settings} label="Settings" />
        </div>
        <form action="/api/auth/logout" method="post" className="px-3">
          <button className="text-xs text-white/50 hover:text-white">Log out</button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden print:hidden">
        <Link href="/app" className="font-display text-lg font-bold text-white">
          Marketing<span className="text-pulse">Rx</span>
        </Link>
        <button onClick={() => setOpen(true)} className="text-white" aria-label="Open menu">
          <Menu />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-ink">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white/70" aria-label="Close menu">
              <X />
            </button>
            {nav}
          </div>
        </div>
      )}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-ink lg:block print:hidden">{nav}</aside>
    </>
  );
}
