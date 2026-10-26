import { Icon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import { Card, Stat } from "@/components/ui";
import { addDays, dayKey, formatDay } from "@/lib/time";
import { CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, STUCK_DAYS, donutGradient, personName, summarize, type Category } from "@/lib/worksync";
import { cardFacts, dayOf, type CardRow } from "@/lib/worksync-data";
import type { ViewCtx } from "./types";

const CATS: Category[] = ["TODO", "DOING", "BLOCKED", "DONE"];
const short = (k: string) => formatDay(k, { month: "short", day: "numeric" });

function Attention({ title, tone, rows, ctx, hint }: { title: string; tone: string; rows: CardRow[]; ctx: ViewCtx; hint?: (c: CardRow) => string }) {
  return (
    <Card>
      <h3 className="flex items-center justify-between font-semibold"><span>{title}</span><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: tone }}>{rows.length}</span></h3>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing here. <Icon name="celebrate" className={ICON_INLINE} /></p> : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {rows.slice(0, 6).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
              <Link href={ctx.href({ card: c.id })} scroll={false} className="min-w-0 truncate font-medium hover:text-brand hover:underline">{c.title}</Link>
              <span className="shrink-0 text-xs text-muted">{hint?.(c) ?? c.list.name}</span>
            </li>
          ))}
          {rows.length > 6 && <li className="pt-1.5 text-xs text-muted">+{rows.length - 6} more</li>}
        </ul>
      )}
    </Card>
  );
}

// The project at a glance, in pure CSS charts: where cards stand, who carries what, what finished lately, what needs attention.
export function DashboardView({ ctx }: { ctx: ViewCtx }) {
  const cards = ctx.cards;
  const s = summarize(cards.map(cardFacts), ctx.today, ctx.now);
  const catOf = (c: CardRow) => c.list.category;
  const open = cards.filter((c) => catOf(c) !== "DONE");

  const perList = ctx.lists.map((l) => ({ l, n: cards.filter((c) => c.listId === l.id).length }));
  const maxList = Math.max(1, ...perList.map((x) => x.n));

  const workers = ctx.members.filter((m) => m.role !== "VIEWER").map((m) => {
    const mine = cards.filter((c) => c.assignees.some((a) => a.employeeId === m.employeeId));
    const doing = mine.filter((c) => catOf(c) !== "DONE");
    return { m, open: doing.length, done: mine.length - doing.length, overdue: doing.filter((c) => c.dueDate && dayOf(c.dueDate)! < ctx.today).length, blocked: doing.filter((c) => catOf(c) === "BLOCKED").length };
  });
  const unassigned = open.filter((c) => c.assignees.length === 0).length;
  const maxWork = Math.max(1, unassigned, ...workers.map((w) => w.open + w.done));

  const last14 = Array.from({ length: 14 }, (_, i) => addDays(ctx.today, i - 13));
  const doneBy = new Map<string, number>();
  for (const c of cards) if (c.completedAt && catOf(c) === "DONE") { const k = dayKey(c.completedAt, ctx.tz); doneBy.set(k, (doneBy.get(k) ?? 0) + 1); }
  const maxDay = Math.max(1, ...last14.map((k) => doneBy.get(k) ?? 0));
  const finished14 = last14.reduce((n, k) => n + (doneBy.get(k) ?? 0), 0);

  const byPri = (["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => ({ p, n: open.filter((c) => c.priority === p).length }));
  const stuckMs = STUCK_DAYS * 86_400_000;
  const blocked = cards.filter((c) => catOf(c) === "BLOCKED");
  const overdue = open.filter((c) => c.dueDate && dayOf(c.dueDate)! < ctx.today);
  const stuck = open.filter((c) => ctx.now - c.updatedAt.getTime() > stuckMs && catOf(c) !== "BLOCKED");
  const next7 = addDays(ctx.today, 7);
  const upcoming = open.filter((c) => c.dueDate && dayOf(c.dueDate)! >= ctx.today && dayOf(c.dueDate)! <= next7).sort((a, b) => dayOf(a.dueDate)!.localeCompare(dayOf(b.dueDate)!));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Cards" value={s.total} />
        <Stat label="Complete" value={`${s.percent}%`} />
        <Stat label="In progress" value={s.by.DOING} />
        <Stat label="Blocked" value={s.by.BLOCKED} tone={s.by.BLOCKED ? "danger" : undefined} hint={s.by.BLOCKED ? "needs help" : undefined} />
        <Stat label="Overdue" value={s.overdue} tone={s.overdue ? "warning" : undefined} hint={s.overdue ? "past due" : undefined} />
        <Stat label="Finished, 14 days" value={finished14} tone={finished14 ? "success" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="font-semibold">Status</h3>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ backgroundImage: donutGradient(CATS.map((c) => ({ value: s.by[c], color: CATEGORY_COLOR[c] }))) }} role="img" aria-label={`Status: ${CATS.map((c) => `${CATEGORY_LABEL[c]} ${s.by[c]}`).join(", ")}`}>
              <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-surface"><span className="text-2xl font-bold tabular-nums">{s.percent}%</span><span className="text-[10px] text-muted">complete</span></div>
            </div>
            <ul className="space-y-1.5 text-sm">
              {CATS.map((c) => <li key={c} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR[c] }} /><span className="text-muted">{CATEGORY_LABEL[c]}</span><span className="ml-auto pl-3 font-semibold tabular-nums">{s.by[c]}</span></li>)}
            </ul>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold">Cards per list</h3>
          <ul className="mt-3 space-y-2.5 text-sm">
            {perList.map(({ l, n }) => (
              <li key={l.id}>
                <div className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="font-semibold tabular-nums">{n}</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(n / maxList) * 100}%`, backgroundColor: CATEGORY_COLOR[l.category] }} /></div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold">Open cards by priority</h3>
          <ul className="mt-3 space-y-2.5 text-sm">
            {byPri.map(({ p, n }) => (
              <li key={p}>
                <div className="flex justify-between gap-2"><span>{PRIORITY_LABEL[p]}</span><span className="font-semibold tabular-nums">{n}</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${open.length ? (n / open.length) * 100 : 0}%`, backgroundColor: PRIORITY_COLOR[p] }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Workload</h3>
          <p className="text-xs text-muted">Open cards (solid) and finished cards (light) per person. Red = overdue.</p>
          <ul className="mt-3 space-y-3 text-sm">
            {workers.map((w) => (
              <li key={w.m.employeeId}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{personName(w.m)}</span>
                  <span className="text-xs text-muted tabular-nums">{w.open} open · {w.done} done{w.overdue > 0 && <span className="font-semibold text-danger"> · {w.overdue} overdue</span>}{w.blocked > 0 && <span className="font-semibold text-danger"> · {w.blocked} blocked</span>}</span>
                </div>
                <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-line">
                  <span style={{ width: `${((w.open - w.overdue) / maxWork) * 100}%`, backgroundColor: "#6366f1" }} />
                  <span style={{ width: `${(w.overdue / maxWork) * 100}%`, backgroundColor: "#ef4444" }} />
                  <span style={{ width: `${(w.done / maxWork) * 100}%`, backgroundColor: "#86efac" }} />
                </div>
              </li>
            ))}
            {unassigned > 0 && (
              <li><div className="flex justify-between gap-2"><span className="text-muted">Unassigned</span><span className="text-xs tabular-nums text-muted">{unassigned} open</span></div><div className="mt-1 flex h-3 overflow-hidden rounded-full bg-line"><span style={{ width: `${(unassigned / maxWork) * 100}%`, backgroundColor: "#94a3b8" }} /></div></li>
            )}
            {workers.length === 0 && <li className="text-muted">No one is working on this project yet.</li>}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold">Finished per day, last 14 days</h3>
          <div className="mt-4 flex h-36 items-end gap-1" role="img" aria-label={`Cards finished per day: ${last14.map((k) => `${short(k)} ${doneBy.get(k) ?? 0}`).join(", ")}`}>
            {last14.map((k) => {
              const n = doneBy.get(k) ?? 0;
              return (
                <div key={k} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${short(k)}: ${n}`}>
                  <span className="text-[10px] font-semibold tabular-nums text-muted">{n || ""}</span>
                  <div className="w-full rounded-t-md" style={{ height: `${n ? Math.max(6, (n / maxDay) * 100) : 2}%`, backgroundColor: n ? "#22c55e" : "#e2e8f0" }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{short(last14[0])}</span><span>{short(last14[13])}</span></div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Attention ctx={ctx} title="Blocked" tone="#ef4444" rows={blocked} />
        <Attention ctx={ctx} title="Overdue" tone="#f59e0b" rows={overdue} hint={(c) => `due ${short(dayOf(c.dueDate)!)}`} />
        <Attention ctx={ctx} title={`Stuck (${STUCK_DAYS}+ days)`} tone="#64748b" rows={stuck} />
        <Attention ctx={ctx} title="Due in 7 days" tone="#6366f1" rows={upcoming} hint={(c) => short(dayOf(c.dueDate)!)} />
      </div>
    </div>
  );
}
