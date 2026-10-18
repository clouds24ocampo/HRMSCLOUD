import Link from "next/link";
import { formatDay } from "@/lib/time";
import { CATEGORY_COLOR, monthGrid, shiftMonth } from "@/lib/worksync";
import { dayOf } from "@/lib/worksync-data";
import type { ViewCtx } from "./types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHOW = 3;

// Month calendar: each card on its due date (a ▶ on its start date), colored by status. Click a card to open it.
export function CalendarView({ ctx, month }: { ctx: ViewCtx; month: string }) {
  const weeks = monthGrid(month);
  const listOf = new Map(ctx.lists.map((l) => [l.id, l]));
  const due = new Map<string, typeof ctx.cards>();
  const start = new Map<string, typeof ctx.cards>();
  for (const c of ctx.cards) {
    const d = dayOf(c.dueDate), s = dayOf(c.startDate);
    if (d) due.set(d, [...(due.get(d) ?? []), c]);
    if (s && s !== d) start.set(s, [...(start.get(s) ?? []), c]);
  }
  const undated = ctx.cards.filter((c) => !c.dueDate && !c.startDate).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{formatDay(`${month}-01`, { month: "long", year: "numeric" })}</h2>
        <nav aria-label="Month" className="flex gap-1">
          <Link href={ctx.href({ m: shiftMonth(month, -1) })} scroll={false} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg" aria-label="Previous month">‹</Link>
          <Link href={ctx.href({ m: null })} scroll={false} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg">Today</Link>
          <Link href={ctx.href({ m: shiftMonth(month, 1) })} scroll={false} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-bg" aria-label="Next month">›</Link>
        </nav>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px] overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line" role="grid" aria-label="Calendar">
          <div className="grid grid-cols-7 border-b border-line bg-bg/70 text-center text-xs font-semibold text-muted" role="row">{WEEKDAYS.map((d) => <div key={d} className="py-2" role="columnheader">{d}</div>)}</div>
          {weeks.map((w, i) => (
            <div key={i} className="grid grid-cols-7 border-b border-line/70 last:border-b-0" role="row">
              {w.map((d) => {
                const items = [...(due.get(d.key) ?? []).map((c) => ({ c, kind: "due" as const })), ...(start.get(d.key) ?? []).map((c) => ({ c, kind: "start" as const }))];
                return (
                  <div key={d.key} role="gridcell" aria-label={formatDay(d.key, { weekday: "long", month: "long", day: "numeric" })} className={`min-h-28 border-r border-line/70 p-1.5 last:border-r-0 ${d.inMonth ? "" : "bg-bg/60 text-muted"}`}>
                    <p className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${d.key === ctx.today ? "bg-danger text-white" : ""}`}>{Number(d.key.slice(8))}</p>
                    <ul className="space-y-1">
                      {items.slice(0, SHOW).map(({ c, kind }) => (
                        <li key={`${kind}${c.id}`}>
                          <Link href={ctx.href({ card: c.id })} scroll={false} title={`${c.title} (${kind === "due" ? "due" : "starts"} · ${listOf.get(c.listId)?.name})`} className="block truncate rounded px-1.5 py-0.5 text-[11px] font-semibold text-white hover:brightness-110" style={{ backgroundColor: CATEGORY_COLOR[listOf.get(c.listId)?.category ?? "TODO"], opacity: kind === "start" ? 0.65 : 1 }}>
                            {kind === "start" ? "▶ " : ""}{c.title}
                          </Link>
                        </li>
                      ))}
                      {items.length > SHOW && <li className="px-1 text-[11px] text-muted">+{items.length - SHOW} more</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {undated > 0 && <p className="text-sm text-muted">{undated} {undated === 1 ? "card has" : "cards have"} no dates and {undated === 1 ? "is" : "are"} not shown here.</p>}
    </div>
  );
}
