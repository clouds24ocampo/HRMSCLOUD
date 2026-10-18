"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, type Category, type DueState } from "@/lib/worksync";
import { addList, archiveList, createCard, moveCard, moveList, updateList } from "./actions";
import { DueBadge, Facepile, LabelChip } from "./parts";

export type BoardCard = {
  id: string;
  title: string;
  href: string;
  priority: keyof typeof PRIORITY_LABEL;
  labels: { name: string; color: string }[];
  due: { label: string; state: DueState } | null;
  assignees: { firstName: string; lastName: string }[];
  checkDone: number;
  checkTotal: number;
  comments: number;
  stuck: boolean;
  hasDescription: boolean;
  creator: string | null;
};
export type BoardList = { id: string; name: string; category: Category; cards: BoardCard[] };

type Drag = { kind: "card" | "list"; id: string };
type Move = { kind: "card"; cardId: string; listId: string; beforeId: string | null } | { kind: "list"; listId: string; beforeId: string | null };

function applyMove(lists: BoardList[], m: Move): BoardList[] {
  if (m.kind === "list") {
    const l = lists.find((x) => x.id === m.listId);
    if (!l) return lists;
    const rest = lists.filter((x) => x.id !== m.listId);
    const at = m.beforeId ? rest.findIndex((x) => x.id === m.beforeId) : -1;
    return at >= 0 ? [...rest.slice(0, at), l, ...rest.slice(at)] : [...rest, l];
  }
  const card = lists.flatMap((l) => l.cards).find((c) => c.id === m.cardId);
  if (!card) return lists;
  return lists.map((l) => {
    const rest = l.cards.filter((c) => c.id !== m.cardId);
    if (l.id !== m.listId) return { ...l, cards: rest };
    const at = m.beforeId ? rest.findIndex((c) => c.id === m.beforeId) : -1;
    return { ...l, cards: at >= 0 ? [...rest.slice(0, at), card, ...rest.slice(at)] : [...rest, card] };
  });
}

// The Trello-style board. Drag a card to another list or into a new place; drag a list header to reorder lists (leads and HR).
// The change shows at once and is saved on the server, which re-checks permission. On a phone, open the card and use "Move to".
export function Board({ projectId, lists, canEdit, canManage, selected }: { projectId: string; lists: BoardList[]; canEdit: boolean; canManage: boolean; selected?: string }) {
  const [shown, move] = useOptimistic(lists, applyMove);
  const [, start] = useTransition();
  const drag = useRef<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const dropCard = (listId: string, beforeId: string | null) => {
    const d = drag.current;
    drag.current = null;
    setOver(null);
    if (!d || d.kind !== "card" || d.id === beforeId) return;
    start(async () => {
      move({ kind: "card", cardId: d.id, listId, beforeId });
      await moveCard(d.id, listId, beforeId);
    });
  };
  const dropList = (beforeId: string | null) => {
    const d = drag.current;
    drag.current = null;
    setOver(null);
    if (!d || d.kind !== "list" || d.id === beforeId) return;
    start(async () => {
      move({ kind: "list", listId: d.id, beforeId });
      await moveList(projectId, d.id, beforeId);
    });
  };

  return (
    <div className="relative flex items-start gap-3 overflow-x-auto pb-2" aria-label="Project board">
      {shown.map((l) => (
        <section
          key={l.id}
          aria-label={`${l.name}, ${l.cards.length} cards`}
          onDragOver={(e) => { if (drag.current && (drag.current.kind === "card" ? canEdit : canManage)) { e.preventDefault(); setOver(l.id); } }}
          onDragLeave={() => setOver((o) => (o === l.id ? null : o))}
          onDrop={(e) => { e.preventDefault(); if (drag.current?.kind === "list") dropList(l.id); else dropCard(l.id, null); }}
          className={`flex max-h-[calc(100dvh-14rem)] w-72 shrink-0 flex-col rounded-2xl p-2 shadow-sm ring-1 transition ${over === l.id ? "bg-white ring-2 ring-white" : "bg-slate-100/95 ring-black/5"}`}
        >
          <header
            draggable={canManage}
            onDragStart={(e) => { drag.current = { kind: "list", id: l.id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); }}
            onDragEnd={() => { drag.current = null; setOver(null); }}
            className={`mb-2 flex items-center justify-between gap-2 px-1.5 pt-1 ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[l.category] }} title={CATEGORY_LABEL[l.category]} />
              <span className="truncate">{l.name}</span>
              <span className="rounded-full bg-slate-200 px-1.5 text-xs font-semibold tabular-nums text-slate-600">{l.cards.length}</span>
            </h3>
            {canManage && <ListMenu projectId={projectId} list={l} />}
          </header>
          <ul className="flex min-h-2 flex-col gap-2 overflow-y-auto px-0.5 pb-0.5">
            {l.cards.map((c) => (
              <li
                key={c.id}
                draggable={canEdit}
                onDragStart={(e) => { e.stopPropagation(); drag.current = { kind: "card", id: c.id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
                onDragEnd={() => { drag.current = null; setOver(null); }}
                onDragOver={(e) => { if (canEdit && drag.current?.kind === "card") e.preventDefault(); }}
                onDrop={(e) => { if (drag.current?.kind !== "card") return; e.preventDefault(); e.stopPropagation(); dropCard(l.id, c.id); }}
                className={`group rounded-xl bg-white p-2.5 shadow-sm ring-1 transition hover:shadow-md ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${selected === c.id ? "ring-2 ring-brand" : "ring-black/5"}`}
              >
                {c.labels.length > 0 && <div className="mb-1.5 flex flex-wrap gap-1">{c.labels.map((x) => <LabelChip key={x.name} label={x} compact />)}</div>}
                <Link href={c.href} draggable={false} scroll={false} className="block text-sm font-medium leading-snug text-slate-900 hover:text-brand">{c.title}</Link>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  {c.priority !== "NORMAL" && c.priority !== "LOW" && <span className="inline-flex items-center gap-1 font-semibold" style={{ color: PRIORITY_COLOR[c.priority] }}><span aria-hidden>⚑</span>{PRIORITY_LABEL[c.priority]}</span>}
                  {c.due && <DueBadge label={c.due.label} state={c.due.state} />}
                  {c.stuck && <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning">Stuck</span>}
                  {c.hasDescription && <span title="Has a description" aria-label="Has a description">≡</span>}
                  {c.checkTotal > 0 && <span className={`inline-flex items-center gap-1 ${c.checkDone === c.checkTotal ? "rounded-md bg-success/15 px-1.5 py-0.5 font-semibold text-success" : ""}`} title="Checklist"><span aria-hidden>☑</span>{c.checkDone}/{c.checkTotal}</span>}
                  {c.comments > 0 && <span title="Comments"><span aria-hidden>💬</span> {c.comments}</span>}
                  <span className="ml-auto"><Facepile people={c.assignees} size={22} /></span>
                </div>
                {c.creator && <p className="mt-1.5 truncate text-[11px] text-slate-400" title={`Added by ${c.creator}`}>Added by {c.creator}</p>}
              </li>
            ))}
          </ul>
          {canEdit && <AddCard projectId={projectId} listId={l.id} />}
        </section>
      ))}
      {canManage && (
        <div
          onDragOver={(e) => { if (drag.current?.kind === "list") { e.preventDefault(); setOver("end"); } }}
          onDragLeave={() => setOver((o) => (o === "end" ? null : o))}
          onDrop={(e) => { e.preventDefault(); dropList(null); }}
          className={`w-72 shrink-0 rounded-2xl ${over === "end" ? "ring-2 ring-white" : ""}`}
        >
          <AddList projectId={projectId} />
        </div>
      )}
    </div>
  );
}

function AddCard({ projectId, listId }: { projectId: string; listId: string }) {
  const f = useKeptForm(createCard.bind(null, projectId, listId));
  const [focused, setFocused] = useState(false);
  return (
    <form {...f.formProps} onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }} className="mt-2 space-y-1.5">
      <label className="block"><span className="sr-only">New card title</span>
        <input name="title" required maxLength={200} autoComplete="off" placeholder="+ Add a card" className="block w-full rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-sm text-slate-700 placeholder:text-slate-500 hover:bg-slate-200/70 focus:border-brand focus:bg-white" />
      </label>
      {(focused || f.pending) && (
        <div className="flex items-center gap-2">
          <button disabled={f.pending} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-60">{f.pending ? "Adding…" : "Add card"}</button>
          <span className="text-[11px] text-slate-500">or press Enter</span>
        </div>
      )}
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <p role="status" className="text-[11px] font-medium text-success">Card added.</p>}
    </form>
  );
}

function AddList({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const f = useKeptForm(addList.bind(null, projectId));
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl bg-white/25 px-4 py-3 text-left text-sm font-semibold text-white backdrop-blur transition hover:bg-white/35">+ Add another list</button>;
  return (
    <form {...f.formProps} className="space-y-2 rounded-2xl bg-slate-100/95 p-3 shadow-sm">
      <label className="block text-xs font-semibold text-slate-600">List name<input name="name" required maxLength={60} autoFocus placeholder="e.g. Staging" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" /></label>
      <label className="block text-xs font-semibold text-slate-600">Counts as
        <select name="category" defaultValue="DOING" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      <div className="flex gap-2">
        <button disabled={f.pending} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink">Add list</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
      </div>
    </form>
  );
}

// ⋯ menu on a list: rename, change what it counts as, remove (only when empty).
function ListMenu({ projectId, list }: { projectId: string; list: BoardList }) {
  const f = useKeptForm(updateList.bind(null, projectId, list.id));
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <details className="relative">
      <summary aria-label={`Settings of list ${list.name}`} className="cursor-pointer list-none rounded-md px-1.5 py-0.5 text-lg leading-none text-slate-500 hover:bg-slate-200">⋯</summary>
      <div className="absolute right-0 z-20 mt-1 w-64 space-y-2 rounded-xl bg-white p-3 text-slate-900 shadow-xl ring-1 ring-black/10">
        <form {...f.formProps} className="space-y-2">
          <label className="block text-xs font-semibold text-slate-600">Name<input name="name" required maxLength={60} defaultValue={list.name} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" /></label>
          <label className="block text-xs font-semibold text-slate-600">Counts as
            <select name="category" defaultValue={list.category} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
          {f.state?.error && <p role="alert" className="text-xs text-danger">{f.state.error}</p>}
          {f.state?.ok && <p className="text-xs text-success">{f.state.ok}</p>}
          <button disabled={f.pending} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink">Save</button>
        </form>
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await archiveList(projectId, list.id); setMsg(r?.error ?? r?.ok); })} className="block text-xs font-medium text-danger hover:underline">Remove this list</button>
        {msg && <p role="alert" className="text-xs text-slate-600">{msg}</p>}
      </div>
    </details>
  );
}
