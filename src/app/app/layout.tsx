import { AppNav } from "@/components/app-nav";
import { aiEnabled } from "@/lib/ai";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { isAdmin, ownedWorkspaces, requireWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { usage } from "@/lib/runs";
import { unreadForOwner } from "@/lib/support";
import { outletLimit } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ws } = await requireWorkspace();
  const u = usage(ws);
  const all = ownedWorkspaces(user.id);
  const limit = outletLimit(all[0] ?? ws);
  const owned = all.slice(0, limit);
  const open = (db().prepare("SELECT COUNT(*) n FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing')").get(ws.id) as { n: number }).n;
  return (
    <div className="min-h-screen">
      <AppNav
        agents={AGENT_ORDER.map((id) => ({ id, name: AGENTS[id].name }))}
        openTasks={open}
        businessName={ws.name}
        businesses={owned.map((w) => ({ id: w.id, name: w.name }))}
        currentId={ws.id}
        canAdd={u.plan.extraOutlets}
        plan={u.plan.name}
        used={u.used}
        limit={u.limit}
        demo={!aiEnabled()}
        admin={isAdmin(user)}
        supportUnread={unreadForOwner(ws.id)}
      />
      <main className="lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
