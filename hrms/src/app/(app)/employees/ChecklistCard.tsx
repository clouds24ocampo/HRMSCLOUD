"use client";

import { useTransition } from "react";
import { toggleChecklistItem } from "./checklist-actions";

type Item = { id: string; title: string; owner: string; done: boolean; canTick: boolean };

export function ChecklistCard({ title, items }: { title: string; items: Item[] }) {
  const [pending, start] = useTransition();
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted">{done} of {items.length} done</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id}>
            <label className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${i.canTick ? "cursor-pointer hover:bg-bg" : "opacity-70"}`}>
              <input
                type="checkbox" checked={i.done} disabled={!i.canTick || pending} onChange={() => start(() => toggleChecklistItem(i.id))}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              <span className={`flex-1 ${i.done ? "text-muted line-through" : ""}`}>{i.title}</span>
              <span className="rounded-full bg-line/60 px-2 py-0.5 text-xs text-muted">{i.owner}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
