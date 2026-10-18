import Link from "next/link";
import { loadReportData, nameMap } from "@/lib/worksync-data";
import { burnUp, cycleTime, dailySeries, personReport, rangeOf } from "@/lib/worksync-report";
import { AddedResolvedChart, BurnUpChart, CardsReport, PeopleTable, RangeTabs, ReportTiles } from "../ReportParts";
import { buttonClass } from "@/components/ui";
import { dayKey } from "@/lib/time";
import type { ViewCtx } from "./types";

// Project report: who added, who resolved, who is working, and how far it all got, for the last 7, 30 or 90 days.
// Leads, HR and managers see every person; anyone else sees only their own row (the cards and totals are shared work).
export async function ReportsView({ ctx, days, showAll, meUserId }: { ctx: ViewCtx; days: number; showAll: boolean; meUserId: string }) {
  const { cards, events } = await loadReportData([ctx.projectId]);
  const r = rangeOf(ctx.today, days);
  const people = personReport(cards, events, r, ctx.tz, ctx.today);
  const names = await nameMap([...new Set([...cards.flatMap((c) => [c.createdById, ...(c.completedById ? [c.completedById] : []), ...c.assigneeKeys]), ...events.map((e) => e.actorId)])]);

  const resolvedNow = cards.filter((c) => c.category === "DONE" && c.completedAt && dayKey(c.completedAt, ctx.tz) >= r.from && dayKey(c.completedAt, ctx.tz) <= r.to);
  const onTime = resolvedNow.length ? Math.round((resolvedNow.filter((c) => !c.dueDay || dayKey(c.completedAt!, ctx.tz) <= c.dueDay).length / resolvedNow.length) * 100) : null;
  const added = cards.filter((c) => dayKey(c.createdAt, ctx.tz) >= r.from && dayKey(c.createdAt, ctx.tz) <= r.to).length;
  const shown = new Set(ctx.cards.map((c) => c.id)); // the search and filters above apply to the card report

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs days={days} href={(v) => ctx.href({ r: v })} />
        <span className="flex gap-2">
          <Link href={`/worksync/${ctx.projectId}/export?r=${days}`} className={`${buttonClass} !py-1.5 text-sm`}>Download card report (CSV)</Link>
          {showAll && <Link href={`/worksync/${ctx.projectId}/export?r=${days}&type=people`} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold transition hover:bg-bg">Download people report (CSV)</Link>}
        </span>
      </div>
      <ReportTiles added={added} resolved={resolvedNow.length} open={cards.filter((c) => c.category !== "DONE").length} cycle={cycleTime(cards, r, ctx.tz)} onTime={onTime} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AddedResolvedChart series={dailySeries(cards, r, ctx.tz)} />
        <BurnUpChart data={burnUp(cards, r, ctx.tz)} />
      </div>
      <PeopleTable rows={showAll ? people : people.filter((p) => p.key === meUserId)} names={names} days={days} />
      {!showAll && <p className="text-xs text-muted">You see your own figures. Leads, managers and HR see everyone.</p>}
      <CardsReport cards={cards.filter((c) => shown.has(c.id))} events={events} names={names} tz={ctx.tz} href={(c) => ctx.href({ card: c.id })} />
    </div>
  );
}
