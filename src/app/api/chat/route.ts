import type Anthropic from "@anthropic-ai/sdk";
import { apiWorkspace } from "@/lib/auth";
import { aiEnabled, businessContext, chatStream } from "@/lib/ai";
import { db, id, now, type RunRow, type TaskRow } from "@/lib/db";
import { getAgent } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `You are Ask PULSE, the strategist inside MarketingRx. You answer the owner's marketing questions using their business profile, their latest agent reports and their open prescriptions (all below).
- Answer first, reasoning after. Keep answers short unless they ask for detail.
- When you recommend an action, make it concrete and do-it-yourself: exact steps, copy to paste, where to click.
- If a question needs data you don't have, say which agent to run (Site Doctor, Keyword Lab, AI Visibility, Content Studio, Ads Doctor, Compliance Check) or what data to look at.
- If the owner is clearly out of their depth or the job is large (a site rebuild, a full ads restructure), you may mention PULSE Digital can do it for them, at most once per conversation.
- Use simple markdown: short paragraphs, bullet lists, bold sparingly.`;

function contextFor(wsId: string) {
  const runs = db()
    .prepare(
      `SELECT r.* FROM runs r JOIN (SELECT agent, MAX(created_at) m FROM runs WHERE workspace_id = ? AND status = 'done' GROUP BY agent) x
       ON r.agent = x.agent AND r.created_at = x.m WHERE r.workspace_id = ?`,
    )
    .all(wsId, wsId) as RunRow[];
  const reports = runs
    .map((r) => {
      let summary = "";
      try {
        summary = (JSON.parse(r.result_json ?? "{}") as { summary?: string }).summary ?? "";
      } catch {
        /* ignore */
      }
      return `- ${getAgent(r.agent)?.name ?? r.agent} (${r.created_at.slice(0, 10)}${r.score != null ? `, score ${r.score}/100` : ""}): ${summary}`;
    })
    .join("\n");
  const tasks = db()
    .prepare("SELECT * FROM tasks WHERE workspace_id = ? AND status IN ('todo','doing') ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 25")
    .all(wsId) as TaskRow[];
  const done = db().prepare("SELECT title FROM tasks WHERE workspace_id = ? AND status = 'done' ORDER BY completed_at DESC LIMIT 10").all(wsId) as { title: string }[];
  return `LATEST REPORTS\n${reports || "None yet."}\n\nOPEN PRESCRIPTIONS\n${tasks.map((t) => `- [${t.priority}] ${t.title} (${t.status})`).join("\n") || "None."}\n\nRECENTLY DONE\n${done.map((d) => `- ${d.title}`).join("\n") || "None."}`;
}

export async function POST(req: Request) {
  const auth = await apiWorkspace();
  if (!auth) return new Response("Log in first.", { status: 401 });
  const { ws } = auth;
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? "").trim().slice(0, 4000);
  if (!message) return new Response("Type a question first.", { status: 400 });

  const history = db()
    .prepare("SELECT role, content FROM chat_messages WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(ws.id)
    .reverse() as { role: "user" | "assistant"; content: string }[];
  db().prepare("INSERT INTO chat_messages (id, workspace_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)").run(id("m_"), ws.id, message, now());

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      // The browser went away (navigated, closed the tab). Keep generating so the answer is saved.
      cancelled = true;
    },
    async start(controller) {
      let full = "";
      const send = (text: string) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cancelled = true;
        }
      };
      try {
        if (!aiEnabled()) {
          full =
            "I'm running in demo mode, so I can't answer live yet. Once an Anthropic API key is added, I'll answer using your business profile, your latest reports and your open prescriptions.\n\nIn the meantime, the best next step is usually to work through your **urgent** prescriptions on the Prescriptions board, then re-run Site Doctor to see your score move.";
          for (const chunk of full.match(/.{1,24}/gs) ?? []) {
            send(chunk);
            if (!cancelled) await new Promise((r) => setTimeout(r, 20));
          }
        } else {
          const messages: Anthropic.Beta.BetaMessageParam[] = [
            ...history.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: message },
          ];
          const system = `${SYSTEM}\n\nBUSINESS PROFILE\n${businessContext(ws)}\n\n${contextFor(ws.id)}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`;
          for await (const delta of chatStream({ system, messages })) {
            full += delta;
            send(delta);
          }
        }
      } catch (e) {
        console.error("[chat]", e);
        const msg = "\n\n(Something went wrong reaching the AI. Try again in a minute.)";
        full += msg;
        send(msg);
      } finally {
        if (full.trim()) {
          db().prepare("INSERT INTO chat_messages (id, workspace_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)").run(id("m_"), ws.id, full, now());
        }
        if (!cancelled) controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

export async function DELETE() {
  const auth = await apiWorkspace();
  if (!auth) return new Response("Log in first.", { status: 401 });
  db().prepare("DELETE FROM chat_messages WHERE workspace_id = ?").run(auth.ws.id);
  return Response.json({ ok: true });
}
