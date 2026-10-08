"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardList,
  FileSearch,
  FileText,
  KeyRound,
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
  plan: string;
  used: number;
  limit: number;
  demo: boolean;
  admin: boolean;
};

function Item({ href, icon: Icon, label, badge, exact }: { href: string; icon: React.ComponentType<{ size?: number }>; label: string; badge?: number; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
        active ? "bg-white/10 font-semibold text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={17} />
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded bg-pulse px-1.5 font-mono text-[11px] text-white">{badge}</span> : null}
    </Link>
  );
}

export function AppNav(props: NavProps) {
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

      <div className="px-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Patient</div>
        <div className="truncate text-sm font-semibold text-white">{props.businessName}</div>
      </div>

      <div className="space-y-0.5" onClick={() => setOpen(false)}>
        <Item href="/app" icon={Activity} label="Chart" exact />
        <Item href="/app/plan" icon={ClipboardList} label="Prescriptions" badge={props.openTasks} />
        <Item href="/app/ask" icon={MessageCircle} label="Ask PULSE" />
        <Item href="/app/reports" icon={FileText} label="Reports" />
      </div>

      <div onClick={() => setOpen(false)}>
        <div className="mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Specialists</div>
        <div className="space-y-0.5">
          {props.agents.map((a) => (
            <Item key={a.id} href={`/app/agents/${a.id}`} icon={AGENT_ICONS[a.id] ?? FileSearch} label={a.name} />
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3" onClick={() => setOpen(false)}>
        {props.demo && (
          <div className="rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
            Demo mode: agents return sample output until an Anthropic API key is set.
          </div>
        )}
        <div className="px-3">
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            <span>{props.plan} plan</span>
            <span>
              {props.used}/{props.limit} runs
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-scrub" style={{ width: `${Math.min(100, (props.used / Math.max(1, props.limit)) * 100)}%` }} />
          </div>
        </div>
        <div className="space-y-0.5">
          {props.admin && <Item href="/admin" icon={Wrench} label="Admin" />}
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
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-ink lg:block">{nav}</aside>
    </>
  );
}
