import Link from "next/link";
import { addDays, formatDay } from "@/lib/time";
import { CATEGORY_COLOR, barSpan, cardProgress, dayDiff, timelineRange } from "@/lib/worksync";
import { dayOf } from "@/lib/worksync-data";
import { Facepile } from "../parts";
import type { ViewCtx } from "./types";

const W = 30; // pixels per day
const LEFT = 240; // width of the sticky title column

// Gantt-style timeline: one bar per card from its start to its due date, colored by status, filled by progress.
// Cards without dates are listed at the bottom. Dates are edited in the table or in the card.
export function TimelineView({ ctx }: { ctx: ViewCtx }) {
  const facts = ctx.cards.map((c) => ({ c, startDay: dayOf(c.startDate), dueDay: dayOf(c.dueDate) }));
  const { from, days } = timelineRange(facts, ctx.today);
  const width = days * W;
  const dayKeys = Array.from({ length: days }, (_, i) => addDays(from, i));
  const months: { label: string; span: number }[] = [];
  for (const k of dayKeys) {
    const label = formatDay(k, { month: "long", year: "numeric" });
    if (months.at(-1)?.label === label) months.at(-1)!.span += 1;
    else months.push({ label, span: 1 });
  }
  const todayAt = dayDiff(ctx.today, from) * W + W / 2;
  const grid = { backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${5 * W}px, rgba(100,116,139,0.09) ${5 * W}px ${7 * W}px), repeating-linear-gradient(to right, transparent 0 ${W - 1}px, rgba(148,163,184,0.25) ${W - 1}px ${W}px)` };
  const dated = facts.filter((f) => f.startDay || f.dueDay);
  const undated = facts.filter((f) => !f.startDay && !f.dueDay);

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm ring-1 ring-line" aria-label="Timeline">
      <div className="relative" style={{ width: LEFT + width }}>
        {/* Header: months, then days (weekday letter + date) */}
        <div className="sticky top-0 z-20 bg-surface">
          <div className="flex border-b border-line">
            <div className="sticky left-0 z-30 shrink-0 border-r border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted" style={{ width: LEFT }}>Item</div>
            {months.map((m) => <div key={m.label} className="truncate border-r border-line px-2 py-1.5 text-xs font-semibold" style={{ width: m.span * W }}>{m.span * W > 90 ? m.label : ""}</div>)}
          </div>
          <div className="flex border-b border-line">
            <div className="sticky left-0 z-30 shrink-0 border-r border-line bg-surface" style={{ width: LEFT }} />
            {dayKeys.map((k) => {
              const wd = new Date(`${k}T00:00:00Z`).getUTCDay();
              return (
                <div key={k} className={`shrink-0 py-1 text-center text-[10px] leading-tight ${k === ctx.today ? "bg-danger text-white" : wd === 0 || wd === 6 ? "bg-bg text-muted" : "text-muted"}`} style={{ width: W }}>
                  <div>{"SMTWTFS"[wd]}</div><div className="font-semibold">{Number(k.slice(8))}</div>
                </div>
              );
            })}
          </div>
        </div>

        {ctx.lists.map((l) => {
          const rows = dated.filter((f) => f.c.listId === l.id);
          if (rows.length === 0) return null;
          return (
            <section key={l.id} aria-label={l.name}>
              <div className="flex border-b border-line bg-bg/70">
                <div className="sticky left-0 z-10 shrink-0 border-r border-line bg-bg px-3 py-1.5 text-xs font-bold" style={{ width: LEFT, color: CATEGORY_COLOR[l.category] }}>{l.name} · {rows.length}</div>
                <div className="flex-1" />
              </div>
              {rows.map(({ c, startDay, dueDay }) => {
                const span = barSpan(from, { startDay, dueDay })!;
                const pct = cardProgress({ category: l.category, checkDone: c.checklist.filter((k) => k.done).length, checkTotal: c.checklist.length });
                const overdue = !!dueDay && dueDay < ctx.today && l.category !== "DONE";
                return (
                  <div key={c.id} className="flex border-b border-line/60">
                    <div className="sticky left-0 z-10 flex shrink-0 items-center justify-between gap-2 border-r border-line bg-surface px-3 py-1.5" style={{ width: LEFT }}>
                      <Link href={ctx.href({ card: c.id })} scroll={false} className="truncate text-sm font-medium hover:text-brand hover:underline">{c.title}</Link>
                      <Facepile people={c.assignees.map((a) => a.employee)} max={2} size={20} />
                    </div>
                    <div className="relative h-9 shrink-0" style={{ width, ...grid }}>
                      <Link
                        href={ctx.href({ card: c.id })}
                        scroll={false}
                        title={`${c.title}: ${startDay ? formatDay(startDay, { month: "short", day: "numeric" }) : "?"} → ${dueDay ? formatDay(dueDay, { month: "short", day: "numeric" }) : "?"} · ${pct}%`}
                        className={`absolute top-1.5 flex h-6 items-center overflow-hidden rounded-md text-[11px] font-semibold text-white shadow-sm ring-offset-1 transition hover:brightness-110 ${overdue ? "ring-2 ring-danger" : ""}`}
                        style={{ left: span.left * W + 1, width: span.days * W - 2, backgroundColor: CATEGORY_COLOR[l.category] }}
                      >
                        <span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${pct}%` }} />
                        <span className="relative truncate px-1.5">{span.days * W > 70 ? c.title : ""}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        {dated.length === 0 && <p className="px-4 py-6 text-sm text-muted" style={{ marginLeft: 0 }}>{ctx.filtered ? "No cards match the filters." : "No card has a start or due date yet. Set dates in the table view or inside a card, and the bars appear here."}</p>}

        {undated.length > 0 && (
          <section aria-label="Cards without dates">
            <div className="flex border-y border-line bg-bg/70"><div className="sticky left-0 shrink-0 bg-bg px-3 py-1.5 text-xs font-bold text-muted" style={{ width: LEFT }}>No dates · {undated.length}</div></div>
            <ul className="sticky left-0 flex flex-wrap gap-2 px-3 py-2" style={{ maxWidth: "min(100%, 70rem)" }}>
              {undated.map(({ c }) => <li key={c.id}><Link href={ctx.href({ card: c.id })} scroll={false} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-bg">{c.title}</Link></li>)}
            </ul>
          </section>
        )}

        {/* Today marker */}
        {todayAt >= 0 && todayAt <= width && <div aria-hidden className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0.5 bg-danger/70" style={{ left: LEFT + todayAt }} />}
      </div>
    </div>
  );
}
