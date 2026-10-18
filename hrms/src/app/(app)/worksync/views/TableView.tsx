import Link from "next/link";
import { formatDay } from "@/lib/time";
import { CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, cardProgress } from "@/lib/worksync";
import { dayOf } from "@/lib/worksync-data";
import { AddItemRow, DateCell, PriorityCell, StatusCell } from "../Cells";
import { Bar, Facepile, LabelChip } from "../parts";
import type { ViewCtx } from "./types";

const COLS = "grid-cols-[minmax(240px,1fr)_96px_150px_110px_130px_130px_120px]";
const short = (k: string) => formatDay(k, { month: "short", day: "numeric" });

// monday-style table: one group per list, one row per card, every cell editable in place.
export function TableView({ ctx }: { ctx: ViewCtx }) {
  const labelById = new Map(ctx.labels.map((l) => [l.id, l]));
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[980px] space-y-6">
        {ctx.lists.map((l) => {
          const cards = ctx.cards.filter((c) => c.listId === l.id);
          const color = CATEGORY_COLOR[l.category];
          const pct = (c: (typeof cards)[number]) => cardProgress({ category: l.category, checkDone: c.checklist.filter((k) => k.done).length, checkTotal: c.checklist.length });
          const avg = cards.length ? Math.round(cards.reduce((n, c) => n + pct(c), 0) / cards.length) : 0;
          const starts = cards.map((c) => dayOf(c.startDate) ?? dayOf(c.dueDate)).filter((d): d is string => !!d).sort();
          const ends = cards.map((c) => dayOf(c.dueDate) ?? dayOf(c.startDate)).filter((d): d is string => !!d).sort();
          const byPri = (["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => ({ p, n: cards.filter((c) => c.priority === p).length }));
          return (
            <details key={l.id} open className="group rounded-xl bg-surface shadow-sm ring-1 ring-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-t-xl px-4 py-2.5 select-none">
                <span aria-hidden className="text-xs text-muted transition group-open:rotate-90">▶</span>
                <span className="font-bold" style={{ color }}>{l.name}</span>
                <span className="text-sm text-muted">{cards.length} {cards.length === 1 ? "item" : "items"} · {CATEGORY_LABEL[l.category]}</span>
              </summary>
              <div className="border-l-[5px]" style={{ borderColor: color }}>
                <div className={`grid ${COLS} items-center gap-x-2 border-y border-line bg-bg/60 px-3 py-1.5 text-xs font-semibold text-muted`} role="row">
                  <span>Item</span><span>People</span><span className="text-center">Status</span><span className="text-center">Priority</span><span>Start</span><span>Due</span><span>Progress</span>
                </div>
                {cards.map((c) => (
                  <div key={c.id} className={`grid ${COLS} items-center gap-x-2 border-b border-line/70 px-3 py-1.5 text-sm transition hover:bg-bg/60 ${ctx.selected === c.id ? "bg-brand/5" : ""}`} role="row">
                    <div className="min-w-0 pr-2">
                      <Link href={ctx.href({ card: c.id })} scroll={false} className="block truncate font-medium hover:text-brand hover:underline">{c.title}</Link>
                      {(c.labels.length > 0 || c._count.comments > 0) && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                          {c.labels.map((x) => labelById.get(x.labelId)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => <LabelChip key={x.id} label={x} compact />)}
                          {c._count.comments > 0 && <span><span aria-hidden>💬</span> {c._count.comments}</span>}
                        </div>
                      )}
                    </div>
                    <div><Facepile people={c.assignees.map((a) => a.employee)} size={24} /></div>
                    <StatusCell cardId={c.id} listId={c.listId} lists={ctx.lists} canEdit={ctx.canEdit} />
                    <PriorityCell cardId={c.id} value={c.priority} canEdit={ctx.canEdit} />
                    <DateCell cardId={c.id} field="startDate" value={dayOf(c.startDate) ?? ""} canEdit={ctx.canEdit} label={`Start date of ${c.title}`} />
                    <DateCell cardId={c.id} field="dueDate" value={dayOf(c.dueDate) ?? ""} canEdit={ctx.canEdit} label={`Due date of ${c.title}`} />
                    <div className="flex items-center gap-2"><Bar percent={pct(c)} color={color} className="flex-1" /><span className="w-9 text-right text-xs tabular-nums text-muted">{pct(c)}%</span></div>
                  </div>
                ))}
                {cards.length === 0 && <p className="px-4 py-3 text-sm text-muted">{ctx.filtered ? "No items match the filters." : "No items yet."}</p>}
                {ctx.canEdit && !ctx.filtered && <AddItemRow projectId={ctx.projectId} listId={l.id} />}
                {cards.length > 0 && (
                  <div className={`grid ${COLS} items-center gap-x-2 px-3 py-2 text-xs text-muted`} aria-label={`Summary of ${l.name}`}>
                    <span /><span />
                    <span />
                    <div className="flex h-2 overflow-hidden rounded-full bg-line" title={byPri.filter((x) => x.n).map((x) => `${PRIORITY_LABEL[x.p]} ${x.n}`).join(", ")}>
                      {byPri.filter((x) => x.n).map((x) => <span key={x.p} style={{ width: `${(x.n / cards.length) * 100}%`, backgroundColor: PRIORITY_COLOR[x.p] }} />)}
                    </div>
                    <span className="col-span-2 tabular-nums">{starts.length ? `${short(starts[0])} – ${short(ends[ends.length - 1])}` : "No dates"}</span>
                    <span className="tabular-nums">avg {avg}%</span>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
