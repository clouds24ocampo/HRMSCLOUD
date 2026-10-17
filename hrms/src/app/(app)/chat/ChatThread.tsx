"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { fetchMessages, sendMessage, type ChatMessage } from "./actions";

const time = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function CallButtons({ conversationId, name }: { conversationId: string; name: string }) {
  const call = (kind: "VOICE" | "VIDEO") => window.dispatchEvent(new CustomEvent("hrms:call", { detail: { conversationId, kind, name } }));
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => call("VOICE")} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold transition hover:bg-bg" aria-label={`Voice call ${name}`}>📞 Voice</button>
      <button type="button" onClick={() => call("VIDEO")} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold transition hover:bg-bg" aria-label={`Video call ${name}`}>📹 Video</button>
    </div>
  );
}

// Messages arrive by polling every 2 s while the tab is visible. Sending shows the message right away.
export function ChatThread({ conversationId, initial }: { conversationId: string; initial: ChatMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const lastAt = messages.at(-1)?.at;

  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const fresh = await fetchMessages(conversationId, lastAt).catch(() => null);
      if (fresh?.length) setMessages((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
    }, 2000);
    return () => clearInterval(t);
  }, [conversationId, lastAt]);

  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect may only return a cleanup function.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(undefined);
    start(async () => {
      const r = await sendMessage(conversationId, body);
      if (r.message) {
        setMessages((m) => [...m, r.message!]);
        setText("");
      } else setError(r.error);
    });
  };

  return (
    <div className="flex h-[65vh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && <p className="text-center text-sm text-muted">No messages yet. Say hello.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "bg-brand text-brand-ink" : "bg-bg"}`}>
              <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
              <p className={`mt-0.5 text-[11px] ${m.mine ? "opacity-80" : "text-muted"}`}>{m.mine ? "" : `${m.sender} · `}{time(m.at)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <label htmlFor="chat-text" className="sr-only">Message</label>
        <textarea
          id="chat-text" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder="Write a message…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
          className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
        />
        <button disabled={pending || !text.trim()} className="rounded-lg bg-brand px-4 py-2.5 font-semibold text-brand-ink transition active:scale-95 disabled:opacity-60">Send</button>
      </form>
      {error && <p role="alert" className="px-3 pb-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
