"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cx } from "./ui";

export type SupportMsg = { id: string; sender: "owner" | "team"; body: string; created_at: string };

const MAX = 2000;
const POLL_MS = 10_000;

/**
 * The Help chat between a business and the PULSE team. Owners use it on /app/help (side "owner"),
 * admins on /admin/support/[id] (side "team"). Polls every 10 seconds while the tab is open.
 */
export function SupportThread({
  endpoint,
  initial,
  side,
  otherName,
  inputLabel,
  placeholder,
  empty,
}: {
  endpoint: string;
  initial: SupportMsg[];
  side: "owner" | "team";
  /** Shown on the other side's messages. */
  otherName: string;
  inputLabel: string;
  placeholder: string;
  empty: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // Bumped on every send, so a poll that started before it can't drop the new message.
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: SupportMsg[] };
      if (mine === seq.current && data.messages) setMessages(data.messages);
    } catch {
      /* offline for a moment; the next poll tries again */
    }
  }, [endpoint]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Keep the newest message in view without scrolling the whole page.
  const count = messages.length;
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [count]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    if (body.length > MAX) return setError(`Keep it under ${MAX.toLocaleString("en")} characters.`);
    setBusy(true);
    setError("");
    seq.current++;
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const data = (await res.json().catch(() => ({}))) as { message?: SupportMsg; error?: string };
      if (!res.ok || !data.message) {
        setError(data.error || "That didn't send. Try again.");
        return;
      }
      const sent = data.message;
      setMessages((m) => (m.some((x) => x.id === sent.id) ? m : [...m, sent]));
      setText("");
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-3xl bg-card ring-1 ring-line">
      <div ref={list} className="max-h-[60vh] min-h-64 space-y-4 overflow-y-auto p-4 md:p-6" aria-live="polite">
        {messages.length === 0 && <p className="py-6 text-center text-[15px] text-ink-2">{empty}</p>}
        {messages.map((m) => {
          const mine = m.sender === side;
          return (
            <div key={m.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed", mine ? "bg-ink text-white" : "bg-paper ring-1 ring-line")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
              <span className="mt-1 px-1 text-xs text-ink-3">
                {mine ? "You" : otherName} ·{" "}
                <time dateTime={m.created_at} suppressHydrationWarning>
                  {new Date(m.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </time>
              </span>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={MAX}
            placeholder={placeholder}
            aria-label={inputLabel}
            className="max-h-48 min-h-11 flex-1 resize-y rounded-2xl border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-scrub focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-scrub text-white transition hover:bg-scrub-dark disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </div>
        <div className="mt-1.5 flex justify-between gap-3 px-1 text-xs">
          <span role="status" className="text-pulse">
            {error}
          </span>
          {text.length > MAX - 200 && <span className="text-ink-3 tabular-nums">{text.length}/{MAX}</span>}
        </div>
      </form>
    </div>
  );
}
