import type { ReactNode } from "react";
import { AGENT_COLORS } from "@/lib/agent-colors";
import { Logo } from "./brand";
import { Heartbeat } from "./landing/heartbeat";
import { cx } from "./ui";

/** Login and signup frame: a soft violet block with the form on a white card. */
export function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="min-h-screen p-3 md:p-4">
      <div className="chart-grid flex min-h-[calc(100vh-1.5rem)] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-lilac/45 px-4 py-12 md:min-h-[calc(100vh-2rem)] md:rounded-[2.75rem]">
        <div className="w-full max-w-sm">
          <Logo className="mb-8" />
          <div className="rise rounded-[1.75rem] bg-card p-6 shadow-[var(--shadow-lift)] md:p-7">
            <span className="mb-5 flex gap-1" aria-hidden>
              {Object.values(AGENT_COLORS).map((c) => (
                <span key={c.label} className={cx("h-2.5 w-6 rounded-full", c.box)} />
              ))}
            </span>
            <h1 className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em]">{title}</h1>
            <p className="mb-6 mt-2 text-[15px] text-ink-2">{sub}</p>
            {children}
          </div>
        </div>
        <div className="mt-10 h-12 w-full max-w-md" aria-hidden>
          <Heartbeat className="h-full" />
        </div>
      </div>
    </main>
  );
}
