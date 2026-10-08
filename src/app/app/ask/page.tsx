import { requireWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chat } from "@/components/chat";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Ask PULSE" };

export default async function AskPage() {
  const { ws } = await requireWorkspace();
  const messages = db()
    .prepare("SELECT id, role, content FROM chat_messages WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(ws.id)
    .reverse() as { id: string; role: "user" | "assistant"; content: string }[];
  return (
    <div>
      <PageHeader eyebrow="Strategist" title="Ask PULSE">
        It has read your business profile, your latest reports and your open prescriptions. Ask it what to do next.
      </PageHeader>
      <Chat initial={messages} businessName={ws.name} />
    </div>
  );
}
