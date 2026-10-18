// WorkSync reports: who added, who resolved, who worked on what, and how far it got. Pure functions over plain rows,
// so every figure can be checked against a hand count. Day boundaries follow the organization's time zone.
import { addDays, dayKey } from "@/lib/time";
import type { Category } from "@/lib/worksync";

export type RCard = {
  id: string;
  projectId: string;
  title: string;
  listName: string;
  category: Category;
  createdById: string; // user id
  createdAt: Date;
  completedById: string | null; // user id
  completedAt: Date | null;
  dueDay: string | null;
  progress: number; // 0-100
  assigneeKeys: string[]; // user id (or "e:<employee id>" when the person has no login)
};
export type REvent = { actorId: string; type: string; detail: string | null; createdAt: Date; cardId: string | null };
export type Range = { from: string; to: string }; // day keys, inclusive

export const rangeOf = (today: string, days: number): Range => ({ from: addDays(today, -(days - 1)), to: today });
const inRange = (day: string, r: Range) => day >= r.from && day <= r.to;

export type PersonRow = {
  key: string;
  added: number; // cards created in the range
  resolved: number; // cards moved to a done list in the range
  resolvedOnTime: number; // of those, on or before the due date (cards without a due date count as on time)
  assignedOpen: number; // right now
  assignedDone: number; // right now
  overdue: number; // assigned, not done, past due
  avgProgress: number; // of everything assigned, right now
  comments: number;
  moves: number; // moved, finished or blocked a card
  steps: number; // checklist steps ticked
  edits: number; // edited or (re)assigned
  activeDays: number; // days with any board action in the range
};

const blank = (key: string): PersonRow => ({ key, added: 0, resolved: 0, resolvedOnTime: 0, assignedOpen: 0, assignedDone: 0, overdue: 0, avgProgress: 0, comments: 0, moves: 0, steps: 0, edits: 0, activeDays: 0 });

export function personReport(cards: RCard[], events: REvent[], r: Range, tz: string, today: string): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  const row = (k: string) => rows.get(k) ?? (rows.set(k, blank(k)), rows.get(k)!);
  const days = new Map<string, Set<string>>();
  const progress = new Map<string, number[]>();

  for (const c of cards) {
    if (inRange(dayKey(c.createdAt, tz), r)) row(c.createdById).added += 1;
    if (c.category === "DONE" && c.completedAt && c.completedById) {
      const d = dayKey(c.completedAt, tz);
      if (inRange(d, r)) {
        row(c.completedById).resolved += 1;
        if (!c.dueDay || d <= c.dueDay) row(c.completedById).resolvedOnTime += 1;
      }
    }
    for (const k of c.assigneeKeys) {
      const p = row(k);
      if (c.category === "DONE") p.assignedDone += 1;
      else {
        p.assignedOpen += 1;
        if (c.dueDay && c.dueDay < today) p.overdue += 1;
      }
      progress.set(k, [...(progress.get(k) ?? []), c.progress]);
    }
  }
  for (const e of events) {
    const d = dayKey(e.createdAt, tz);
    if (!inRange(d, r)) continue;
    const p = row(e.actorId);
    days.set(e.actorId, (days.get(e.actorId) ?? new Set()).add(d));
    if (e.type === "COMMENTED") p.comments += 1;
    else if (e.type === "MOVED" || e.type === "DONE" || e.type === "BLOCKED") p.moves += 1;
    else if (e.type === "CHECKED" && e.detail?.startsWith("done")) p.steps += 1;
    else if (e.type === "EDITED" || e.type === "ASSIGNED") p.edits += 1;
  }
  for (const [k, p] of rows) {
    p.activeDays = days.get(k)?.size ?? 0;
    const pr = progress.get(k);
    p.avgProgress = pr?.length ? Math.round(pr.reduce((a, b) => a + b, 0) / pr.length) : 0;
  }
  return [...rows.values()].sort((a, b) => b.resolved - a.resolved || b.added - a.added || b.moves - a.moves);
}

// One entry per day of the range: cards added and cards resolved that day.
export function dailySeries(cards: RCard[], r: Range, tz: string): { day: string; added: number; resolved: number }[] {
  const out: { day: string; added: number; resolved: number }[] = [];
  const idx = new Map<string, number>();
  for (let d = r.from; d <= r.to && out.length < 400; d = addDays(d, 1)) { idx.set(d, out.length); out.push({ day: d, added: 0, resolved: 0 }); }
  for (const c of cards) {
    const a = idx.get(dayKey(c.createdAt, tz));
    if (a !== undefined) out[a].added += 1;
    if (c.category === "DONE" && c.completedAt) {
      const b = idx.get(dayKey(c.completedAt, tz));
      if (b !== undefined) out[b].resolved += 1;
    }
  }
  return out;
}

// Cumulative cards created and cards finished by the end of each day (what was already there before the range counts too).
export function burnUp(cards: RCard[], r: Range, tz: string): { day: string; created: number; done: number }[] {
  const created = cards.map((c) => dayKey(c.createdAt, tz));
  const done = cards.filter((c) => c.category === "DONE" && c.completedAt).map((c) => dayKey(c.completedAt!, tz));
  const out: { day: string; created: number; done: number }[] = [];
  for (let d = r.from; d <= r.to && out.length < 400; d = addDays(d, 1)) out.push({ day: d, created: created.filter((x) => x <= d).length, done: done.filter((x) => x <= d).length });
  return out;
}

// Hours from "added" to "resolved" for cards resolved in the range: average and median. Null when nothing was resolved.
export function cycleTime(cards: RCard[], r: Range, tz: string): { avgHours: number; medianHours: number; n: number } | null {
  const hs = cards
    .filter((c) => c.category === "DONE" && c.completedAt && inRange(dayKey(c.completedAt, tz), r))
    .map((c) => Math.max(0, (c.completedAt!.getTime() - c.createdAt.getTime()) / 3_600_000))
    .sort((a, b) => a - b);
  if (!hs.length) return null;
  const mid = Math.floor(hs.length / 2);
  return { avgHours: hs.reduce((a, b) => a + b, 0) / hs.length, medianHours: hs.length % 2 ? hs[mid] : (hs[mid - 1] + hs[mid]) / 2, n: hs.length };
}

export const formatHours = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round((h / 24) * 10) / 10} days`);

// Everyone who did something on a card, with what they did: the "worked on" list of the card report.
export type Contribution = { actorId: string; created: boolean; resolved: boolean; assigned: boolean; actions: number; comments: number };
export function cardContributors(card: RCard, events: REvent[]): Contribution[] {
  const m = new Map<string, Contribution>();
  const get = (id: string) => m.get(id) ?? (m.set(id, { actorId: id, created: false, resolved: false, assigned: false, actions: 0, comments: 0 }), m.get(id)!);
  get(card.createdById).created = true;
  if (card.category === "DONE" && card.completedById) get(card.completedById).resolved = true;
  for (const k of card.assigneeKeys) get(k).assigned = true;
  for (const e of events) {
    if (e.cardId !== card.id) continue;
    const c = get(e.actorId);
    if (e.type === "COMMENTED") c.comments += 1;
    if (e.type !== "CARD_CREATED") c.actions += 1;
  }
  return [...m.values()].sort((a, b) => b.actions - a.actions);
}
