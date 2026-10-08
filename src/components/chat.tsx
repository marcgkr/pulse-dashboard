"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Markdown } from "./markdown";
import { cx } from "./ui";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const STARTERS = [
  "What should I fix first this week?",
  "Write me 3 Google Business Profile posts for this month",
  "How do I reply to a bad Google review?",
  "Is my ad budget split right between Google and Meta?",
];

export function Chat({ initial, businessName }: { initial: Msg[]; businessName: string }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setText("");
    const reply: Msg = { id: "a" + Date.now(), role: "assistant", content: "" };
    setMessages((m) => [...m, { id: "u" + Date.now(), role: "user", content: message }, reply]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === reply.id ? { ...x, content: acc } : x)));
      }
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === reply.id ? { ...x, content: (e as Error).message || "Couldn't reach the strategist. Try again." } : x)));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-lg border border-line bg-card">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 && (
          <div className="py-6">
            <p className="font-display text-lg font-semibold">What do you want to know about {businessName}&apos;s marketing?</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-md border border-line bg-paper px-3 py-2 text-left text-sm hover:border-scrub">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[85%] rounded-lg px-4 py-3 text-[15px]", m.role === "user" ? "bg-ink text-white" : "border border-line bg-paper")}>
              {m.role === "assistant" ? (
                m.content ? <Markdown text={m.content} /> : <span className="blip inline-block h-2 w-2 rounded-full bg-pulse" aria-label="Thinking" />
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={1}
          placeholder="Ask anything about your marketing"
          className="max-h-40 min-h-11 flex-1 resize-y rounded-md border border-line bg-white px-3 py-2.5 text-sm focus:border-scrub focus:outline-none"
          aria-label="Your question"
        />
        <button type="submit" disabled={busy || !text.trim()} className="grid h-11 w-11 place-items-center rounded-md bg-scrub text-white disabled:opacity-40" aria-label="Send">
          <ArrowUp size={18} />
        </button>
      </form>
      {messages.length > 0 && (
        <button onClick={clear} className="self-end px-4 pb-3 text-xs text-ink-3 hover:text-ink">
          Clear conversation
        </button>
      )}
    </div>
  );
}
