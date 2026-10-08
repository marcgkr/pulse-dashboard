import type { ReactNode } from "react";
import { Logo, EcgTrace } from "./brand";

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="chart-grid flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        <div className="rounded-lg border border-line bg-card p-6 shadow-[0_1px_0_rgba(14,26,36,0.04)]">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-ink-2">{sub}</p>
          {children}
        </div>
        <EcgTrace className="mt-6 h-10 opacity-60" />
      </div>
    </main>
  );
}
