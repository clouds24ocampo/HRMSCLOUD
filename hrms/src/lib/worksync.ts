import { addDays, dbDate, weekStart } from "@/lib/time";

// WorkSync rules that need no database: list templates, progress, access level, card ordering.
// Every list maps to one category, so "done", "blocked" and "overdue" mean the same on every board.

export type Category = "TODO" | "DOING" | "BLOCKED" | "DONE";
export type Kind = "PROGRAMMING" | "NETWORK" | "OTHER";
export type MemberRole = "LEAD" | "MEMBER" | "VIEWER";
export type Level = "MANAGE" | "EDIT" | "VIEW";

export const KIND_LABEL: Record<Kind, string> = { PROGRAMMING: "Software", NETWORK: "Network", OTHER: "Other" };
export const CATEGORY_LABEL: Record<Category, string> = { TODO: "To do", DOING: "In progress", BLOCKED: "Blocked", DONE: "Done" };
export const CATEGORY_TONE = { TODO: "neutral", DOING: "brand", BLOCKED: "danger", DONE: "success" } as const;
export const PRIORITY_LABEL = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" } as const;
export const PRIORITY_TONE = { LOW: "neutral", NORMAL: "neutral", HIGH: "warning", URGENT: "danger" } as const;
export const ROLE_LABEL: Record<MemberRole, string> = { LEAD: "Lead", MEMBER: "Member", VIEWER: "Viewer" };

// The lists a new project starts with. Rename or add lists later; the category keeps the reports meaningful.
export const TEMPLATES: Record<Kind, { name: string; category: Category }[]> = {
  PROGRAMMING: [
    { name: "Backlog", category: "TODO" },
    { name: "To do", category: "TODO" },
    { name: "In development", category: "DOING" },
    { name: "Code review", category: "DOING" },
    { name: "Testing / QA", category: "DOING" },
    { name: "Blocked", category: "BLOCKED" },
    { name: "Released", category: "DONE" },
  ],
  NETWORK: [
    { name: "Planned", category: "TODO" },
    { name: "Site survey / design", category: "DOING" },
    { name: "Installation / configuration", category: "DOING" },
    { name: "Testing", category: "DOING" },
    { name: "Blocked", category: "BLOCKED" },
    { name: "Handed over", category: "DONE" },
  ],
  OTHER: [
    { name: "To do", category: "TODO" },
    { name: "In progress", category: "DOING" },
    { name: "Blocked", category: "BLOCKED" },
    { name: "Done", category: "DONE" },
  ],
};

export const STUCK_DAYS = 3;

export type CardFacts = { category: Category; dueDay: string | null; updatedAt: Date; checkDone: number; checkTotal: number };

// A done card is 100%. Otherwise it is the share of its checklist that is ticked, or 0 when it has none.
export function cardProgress(c: Pick<CardFacts, "category" | "checkDone" | "checkTotal">): number {
  if (c.category === "DONE") return 100;
  return c.checkTotal > 0 ? Math.round((c.checkDone / c.checkTotal) * 100) : 0;
}

// Project percent = average of its cards' percent (archived cards are not passed in). No cards: 0.
export function summarize(cards: CardFacts[], today: string, now = Date.now()) {
  const by: Record<Category, number> = { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 0 };
  let overdue = 0;
  let stuck = 0;
  let sum = 0;
  for (const c of cards) {
    by[c.category] += 1;
    sum += cardProgress(c);
    if (c.category !== "DONE" && c.dueDay && c.dueDay < today) overdue += 1;
    if (c.category !== "DONE" && now - c.updatedAt.getTime() > STUCK_DAYS * 86_400_000) stuck += 1;
  }
  return { total: cards.length, by, overdue, stuck, percent: cards.length ? Math.round(sum / cards.length) : 0 };
}

// What a person may do on a project. HR and Super Admin manage everything. A member works by their project role.
// A manager who is only above a member in the supervisor chain may look (and comment), not change.
export function accessLevel(isHr: boolean, memberRole: MemberRole | null, seesViaDownline: boolean): Level | null {
  if (isHr) return "MANAGE";
  if (memberRole === "LEAD") return "MANAGE";
  if (memberRole === "MEMBER") return "EDIT";
  if (memberRole === "VIEWER" || seesViaDownline) return "VIEW";
  return null;
}

// Fractional position for a card dropped between two neighbours (null = start or end of the list).
// The list a one-click status change lands in: the first list (in board order) that counts as that category.
export function listForCategory<T extends { category: Category }>(lists: T[], category: Category): T | undefined {
  return lists.find((l) => l.category === category);
}

export function positionBetween(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return 1000;
  if (prev == null) return next! - 1000;
  if (next == null) return prev + 1000;
  return (prev + next) / 2;
}

// ───────────── colors, themes, labels ─────────────

export const LABEL_COLORS = {
  green: "#22c55e", yellow: "#eab308", orange: "#f97316", red: "#ef4444", purple: "#a855f7",
  blue: "#3b82f6", sky: "#0ea5e9", lime: "#84cc16", pink: "#ec4899", slate: "#64748b",
} as const;
export type LabelColor = keyof typeof LABEL_COLORS;
export const labelColor = (key: string) => LABEL_COLORS[key as LabelColor] ?? LABEL_COLORS.slate;

// Board themes: two colors each, drawn as a gradient behind the board and on the project card.
export const WS_THEMES = {
  indigo: ["#4f46e5", "#7c3aed"], ocean: ["#0ea5e9", "#2563eb"], forest: ["#16a34a", "#0d9488"], sunset: ["#f97316", "#db2777"],
  rose: ["#e11d48", "#be185d"], violet: ["#7c3aed", "#c026d3"], teal: ["#0d9488", "#0891b2"], slate: ["#475569", "#1e293b"],
} as const;
export type ThemeKey = keyof typeof WS_THEMES;
export const themeGradient = (key: string) => {
  const [a, b] = WS_THEMES[key as ThemeKey] ?? WS_THEMES.indigo;
  return `linear-gradient(135deg, ${a}, ${b})`;
};

// Status colors (the category of the list a card sits in), used by pills, bars and charts.
export const CATEGORY_COLOR: Record<Category, string> = { TODO: "#94a3b8", DOING: "#6366f1", BLOCKED: "#ef4444", DONE: "#22c55e" };
export const PRIORITY_COLOR = { LOW: "#94a3b8", NORMAL: "#3b82f6", HIGH: "#f59e0b", URGENT: "#ef4444" } as const;

export const DEFAULT_LABELS: Record<Kind, { name: string; color: LabelColor }[]> = {
  PROGRAMMING: [
    { name: "Feature", color: "green" }, { name: "Bug", color: "red" }, { name: "Improvement", color: "blue" },
    { name: "Urgent", color: "orange" }, { name: "Tech debt", color: "slate" }, { name: "Design", color: "pink" },
  ],
  NETWORK: [
    { name: "Installation", color: "blue" }, { name: "Site survey", color: "sky" }, { name: "Configuration", color: "purple" },
    { name: "Outage", color: "red" }, { name: "Maintenance", color: "yellow" }, { name: "Procurement", color: "orange" },
  ],
  OTHER: [{ name: "Important", color: "red" }, { name: "Idea", color: "yellow" }, { name: "Follow up", color: "blue" }],
};

// ───────────── filters (the same on every view) ─────────────

export type Filters = { q: string; who: string; label: string; pri: string };
export const NO_FILTERS: Filters = { q: "", who: "", label: "", pri: "" };

export function parseFilters(sp: Record<string, string | undefined>): Filters {
  const pri = ["LOW", "NORMAL", "HIGH", "URGENT"].includes(sp.pri ?? "") ? sp.pri! : "";
  return { q: (sp.q ?? "").trim().slice(0, 80), who: (sp.who ?? "").slice(0, 40), label: (sp.label ?? "").slice(0, 40), pri };
}
export const filtersActive = (f: Filters) => !!(f.q || f.who || f.label || f.pri);

export type Filterable = { title: string; description: string | null; priority: string; assigneeIds: string[]; labelIds: string[] };

// who: "me" = assigned to the viewer, "none" = unassigned, otherwise an employee id.
export function matchesFilters(c: Filterable, f: Filters, myEmployeeId: string): boolean {
  if (f.q && !`${c.title} ${c.description ?? ""}`.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.who === "none" ? c.assigneeIds.length > 0 : f.who && !c.assigneeIds.includes(f.who === "me" ? myEmployeeId : f.who)) return false;
  if (f.label && !c.labelIds.includes(f.label)) return false;
  if (f.pri && c.priority !== f.pri) return false;
  return true;
}

// ───────────── timeline (Gantt) ─────────────

const DAY = 86_400_000;
export const dayDiff = (a: string, b: string) => Math.round((dbDate(a).getTime() - dbDate(b).getTime()) / DAY); // a - b in days

// A card's bar: from its start to its due date. Only one of them set: a one-day bar. Neither: no bar.
export function barSpan(from: string, c: { startDay: string | null; dueDay: string | null }): { left: number; days: number } | null {
  if (!c.startDay && !c.dueDay) return null;
  const a = c.startDay ?? c.dueDay!;
  const b = c.dueDay ?? c.startDay!;
  const [s, e] = a <= b ? [a, b] : [b, a];
  return { left: dayDiff(s, from), days: dayDiff(e, s) + 1 };
}

// The visible range: a Monday before the earliest date through ten days after the latest, at least four weeks, at most a year.
export function timelineRange(cards: { startDay: string | null; dueDay: string | null }[], today: string): { from: string; days: number } {
  const all = [today, ...cards.flatMap((c) => [c.startDay, c.dueDay].filter((d): d is string => !!d))].sort();
  const from = weekStart(addDays(all[0], -3));
  const to = addDays(all[all.length - 1], 10);
  return { from, days: Math.min(366, Math.max(28, dayDiff(to, from) + 1)) };
}

// ───────────── calendar ─────────────

// Weeks (Monday first) that cover the month "YYYY-MM", each day marked as inside the month or not.
export function monthGrid(ym: string): { key: string; inMonth: boolean }[][] {
  const end = addDays(`${shiftMonth(ym, 1)}-01`, -1); // last day of the month
  const weeks: { key: string; inMonth: boolean }[][] = [];
  for (let d = weekStart(`${ym}-01`); d <= end; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => ({ key: addDays(d, i), inMonth: addDays(d, i).slice(0, 7) === ym })));
  }
  return weeks;
}
export const shiftMonth = (ym: string, n: number) => {
  const d = dbDate(`${ym}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

// ───────────── charts ─────────────

// CSS conic-gradient for a donut: slices in order, starting at the top.
export function donutGradient(slices: { value: number; color: string }[]): string {
  const total = slices.reduce((n, s) => n + s.value, 0);
  if (total === 0) return "conic-gradient(#e2e8f0 0 100%)";
  let at = 0;
  const stops = slices.filter((s) => s.value > 0).map((s) => {
    const from = at;
    at += (s.value / total) * 100;
    return `${s.color} ${from.toFixed(2)}% ${at.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

// ───────────── small display rules ─────────────

export type DueState = "done" | "overdue" | "soon" | "later";
// Done cards are green; a past date is red; today or tomorrow is amber; anything else is calm.
export function dueState(dueDay: string, today: string, category: Category): DueState {
  if (category === "DONE") return "done";
  if (dueDay < today) return "overdue";
  return dayDiff(dueDay, today) <= 1 ? "soon" : "later";
}

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#3b82f6", "#84cc16"];
// The same person always gets the same color.
export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const personName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`.trim();
export const initials = (e: { firstName: string; lastName: string }) => `${e.firstName[0] ?? ""}${e.lastName[0] ?? ""}`.toUpperCase();
