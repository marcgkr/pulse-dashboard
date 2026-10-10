import { requireWorkspace } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { planById } from "@/lib/config";
import { db } from "@/lib/db";
import { Chat } from "@/components/chat";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Ask PULSE" };

export default async function AskPage() {
  const { ws } = await requireWorkspace();
  // Checkup and Starter don't include the strategist; say so here rather than after their first question.
  if (aiEnabled() && planById(ws.plan).chatPerMonth === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader eyebrow="Strategist" title="Ask PULSE">
          A strategist that has read your profile, your reports and your prescriptions.
        </PageHeader>
        <Card className="p-6">
          <p className="font-display text-lg font-semibold">Ask PULSE is on the Growth and Pro plans.</p>
          <p className="mt-1 text-sm text-ink-2">
            Ask what to do first this week, why a fix matters, or how to do a step on your own setup. Need a hand now? Message the PULSE team on Help.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/app/settings#plan">See plans</ButtonLink>
            <ButtonLink href="/app/help" variant="secondary">
              Open Help
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }
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
