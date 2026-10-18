"use client";

import { useState, useTransition } from "react";
import { CATEGORY_COLOR, PRIORITY_COLOR, PRIORITY_LABEL, type Category } from "@/lib/worksync";
import { createCard, moveCard, setCardField } from "./actions";
import { useKeptForm } from "@/components/useKeptForm";

// Cells of the table view. Each one saves on its own the moment it changes (no Save button), shows the new value at once,
// and puts the old value back with a short message if the server says no.

function useSave() {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return { error, pending, run: (fn: () => Promise<{ error?: string } | void>, undo: () => void) => start(async () => { setError(undefined); const r = await fn(); if (r?.error) { setError(r.error); undo(); } }) };
}

const selectBase = "w-full cursor-pointer appearance-none rounded-md px-2 py-1 text-center text-xs font-semibold text-white outline-offset-2 disabled:cursor-default disabled:opacity-100";

// Status = the list a card is in. Changing it moves the card (and stamps or clears its finished time).
export function StatusCell({ cardId, listId, lists, canEdit }: { cardId: string; listId: string; lists: { id: string; name: string; category: Category }[]; canEdit: boolean }) {
  const [value, setValue] = useState(listId);
  const [prev, setPrev] = useState(listId);
  if (prev !== listId) { setPrev(listId); setValue(listId); } // the server value changed (refresh): follow it
  const s = useSave();
  const cur = lists.find((l) => l.id === value) ?? lists[0];
  return (
    <div>
      <select
        aria-label="Status"
        disabled={!canEdit || s.pending}
        value={value}
        onChange={(e) => { const old = value; setValue(e.target.value); s.run(() => moveCard(cardId, e.target.value, null), () => setValue(old)); }}
        className={selectBase}
        style={{ backgroundColor: CATEGORY_COLOR[cur.category] }}
      >
        {lists.map((l) => <option key={l.id} value={l.id} className="text-ink">{l.name}</option>)}
      </select>
      {s.error && <p role="alert" className="mt-0.5 text-[11px] text-danger">{s.error}</p>}
    </div>
  );
}

export function PriorityCell({ cardId, value: server, canEdit }: { cardId: string; value: keyof typeof PRIORITY_LABEL; canEdit: boolean }) {
  const [value, setValue] = useState(server);
  const [prev, setPrev] = useState(server);
  if (prev !== server) { setPrev(server); setValue(server); }
  const s = useSave();
  return (
    <div>
      <select
        aria-label="Priority"
        disabled={!canEdit || s.pending}
        value={value}
        onChange={(e) => { const old = value; const v = e.target.value as keyof typeof PRIORITY_LABEL; setValue(v); s.run(() => setCardField(cardId, "priority", v), () => setValue(old)); }}
        className={selectBase}
        style={{ backgroundColor: PRIORITY_COLOR[value] }}
      >
        {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k} className="text-ink">{v}</option>)}
      </select>
      {s.error && <p role="alert" className="mt-0.5 text-[11px] text-danger">{s.error}</p>}
    </div>
  );
}

export function DateCell({ cardId, field, value: server, canEdit, label }: { cardId: string; field: "startDate" | "dueDate"; value: string; canEdit: boolean; label: string }) {
  const [value, setValue] = useState(server);
  const [prev, setPrev] = useState(server);
  if (prev !== server) { setPrev(server); setValue(server); }
  const s = useSave();
  return (
    <div>
      <input
        type="date"
        aria-label={label}
        disabled={!canEdit || s.pending}
        value={value}
        onChange={(e) => { const old = value; setValue(e.target.value); s.run(() => setCardField(cardId, field, e.target.value), () => setValue(old)); }}
        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs tabular-nums text-ink hover:border-line focus:border-brand focus:bg-surface disabled:hover:border-transparent"
      />
      {s.error && <p role="alert" className="mt-0.5 text-[11px] text-danger">{s.error}</p>}
    </div>
  );
}

// The "+ Add item" row at the bottom of a group.
export function AddItemRow({ projectId, listId }: { projectId: string; listId: string }) {
  const f = useKeptForm(createCard.bind(null, projectId, listId));
  return (
    <form {...f.formProps} className="flex items-center gap-2 border-t border-line/70 px-3 py-1.5">
      <label className="min-w-0 flex-1"><span className="sr-only">New item title</span>
        <input name="title" required maxLength={200} placeholder="+ Add item" className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm placeholder:text-muted hover:bg-bg focus:border-brand focus:bg-surface" />
      </label>
      {f.state?.error && <span role="alert" className="text-xs text-danger">{f.state.error}</span>}
    </form>
  );
}
