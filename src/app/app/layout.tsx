import { AppNav } from "@/components/app-nav";
import { aiEnabled } from "@/lib/ai";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { usage } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ws } = await requireWorkspace();
  const u = usage(ws);
  const open = (db().prepare("SELECT COUNT(*) n FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing')").get(ws.id) as { n: number }).n;
  return (
    <div className="min-h-screen">
      <AppNav
        agents={AGENT_ORDER.map((id) => ({ id, name: AGENTS[id].name }))}
        openTasks={open}
        businessName={ws.name}
        plan={u.plan.name}
        used={u.used}
        limit={u.limit}
        demo={!aiEnabled()}
        admin={isAdmin(user)}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
