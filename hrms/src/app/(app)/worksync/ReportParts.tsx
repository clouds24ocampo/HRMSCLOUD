import Link from "next/link";
import { Card, Stat } from "@/components/ui";
import { dayKey, formatDay, formatTime } from "@/lib/time";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/worksync";
import { cardContributors, formatHours, type PersonRow, type RCard, type REvent } from "@/lib/worksync-report";
import { Bar } from "./parts";

const short = (k: string) => formatDay(k, { month: "short", day: "numeric" });
const when = (d: Date, tz: string) => `${short(dayKey(d, tz))} ${formatTime(d, tz)}`;

export const RANGES = [7, 30, 90] as const;

export function RangeTabs({ days, href }: { days: number; href: (r: string) => string }) {
  return (
    <nav aria-label="Report period" className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm font-medium">
      {RANGES.map((r) => <Link key={r} href={href(String(r))} scroll={false} aria-current={days === r ? "page" : undefined} className={`rounded-lg px-3 py-1.5 transition ${days === r ? "bg-brand text-brand-ink" : "text-muted hover:bg-bg"}`}>Last {r} days</Link>)}
    </nav>
  );
}

export function ReportTiles({ added, resolved, open, cycle, onTime }: { added: number; resolved: number; open: number; cycle: { avgHours: number; medianHours: number; n: number } | null; onTime: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Stat label="Cards added" value={added} />
      <Stat label="Cards resolved" value={resolved} tone={resolved ? "success" : undefined} />
      <Stat label="Open now" value={open} />
      <Stat label="Resolved on time" value={onTime == null ? "—" : `${onTime}%`} hint={onTime == null ? undefined : "by the due date"} />
      <Stat label="Average time to resolve" value={cycle ? formatHours(cycle.avgHours) : "—"} hint={cycle ? `median ${formatHours(cycle.medianHours)}` : undefined} />
    </div>
  );
}

// Cards added and cards resolved, side by side. A long range is grouped by week so the bars stay readable.
export function AddedResolvedChart({ series }: { series: { day: string; added: number; resolved: number }[] }) {
  const size = series.length > 31 ? 7 : 1;
  const buckets: { label: string; added: number; resolved: number }[] = [];
  for (let i = 0; i < series.length; i += size) {
    const part = series.slice(i, i + size);
    buckets.push({ label: size === 1 ? short(part[0].day) : `${short(part[0].day)} – ${short(part[part.length - 1].day)}`, added: part.reduce((n, d) => n + d.added, 0), resolved: part.reduce((n, d) => n + d.resolved, 0) });
  }
  const max = Math.max(1, ...buckets.flatMap((b) => [b.added, b.resolved]));
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Added and resolved {size === 7 ? "per week" : "per day"}</h3>
        <span className="flex gap-3 text-xs text-muted"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />Added</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />Resolved</span></span>
      </div>
      <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label={`Cards added and resolved: ${buckets.map((b) => `${b.label} added ${b.added}, resolved ${b.resolved}`).join("; ")}`}>
        {buckets.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`${b.label}: ${b.added} added, ${b.resolved} resolved`}>
            <div className="w-1/2 max-w-3 rounded-t bg-indigo-500" style={{ height: `${b.added ? Math.max(4, (b.added / max) * 100) : 0}%` }} />
            <div className="w-1/2 max-w-3 rounded-t bg-green-500" style={{ height: `${b.resolved ? Math.max(4, (b.resolved / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{buckets[0]?.label}</span><span>{buckets[buckets.length - 1]?.label}</span></div>
    </Card>
  );
}

// Burn-up: how many cards exist (indigo) against how many are finished (green). The gap is what is left.
export function BurnUpChart({ data }: { data: { day: string; created: number; done: number }[] }) {
  const W = 600, H = 150, P = 6;
  const max = Math.max(1, ...data.map((d) => d.created));
  const x = (i: number) => P + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = (k: "created" | "done") => data.map((d, i) => `${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Progress over time (burn-up)</h3>
        <span className="flex gap-3 text-xs text-muted"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />All cards</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />Finished</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-40 w-full" role="img" aria-label={last ? `${last.done} of ${last.created} cards finished by ${short(last.day)}` : "No data"} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={P} x2={W - P} y1={y(max * g)} y2={y(max * g)} stroke="#e2e8f0" strokeDasharray="3 4" />)}
        <polyline points={line("created")} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={line("done")} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{data[0] && short(data[0].day)}</span><span>{last && `${last.done} of ${last.created} finished`}</span><span>{last && short(last.day)}</span></div>
    </Card>
  );
}

// One row per person. Figures are information for managing the work, not a performance score.
export function PeopleTable({ rows, names, days }: { rows: PersonRow[]; names: Map<string, string>; days: number }) {
  const cols: [string, string][] = [["Added", `Cards created in the last ${days} days`], ["Resolved", `Cards moved to a done list in the last ${days} days`], ["On time", "Resolved by the due date"], ["Working on", "Assigned, not finished"], ["Finished", "Assigned and finished"], ["Overdue", "Assigned, not finished, past due"], ["Progress", "Average progress of all cards assigned"], ["Comments", ""], ["Moves", "Moved, finished or blocked a card"], ["Steps", "Checklist steps ticked"], ["Active days", `Days with any board action in the last ${days} days`]];
  return (
    <Card className="p-0">
      <div className="px-5 pt-5"><h3 className="font-semibold">People: who added, who resolved, who is working</h3><p className="mt-0.5 text-xs text-muted">Counts of what people did on the boards. It shows where work and help are needed; it is not a performance score.</p></div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="px-5 py-2 font-medium">Person</th>{cols.map(([c, t]) => <th key={c} title={t} className="px-2 py-2 text-right font-medium">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-line tabular-nums">
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-bg/60">
                <td className="px-5 py-2 font-medium">{names.get(r.key) ?? "Former user"}</td>
                <td className="px-2 text-right">{r.added}</td>
                <td className="px-2 text-right font-semibold text-success">{r.resolved}</td>
                <td className="px-2 text-right">{r.resolved ? `${r.resolvedOnTime}/${r.resolved}` : "—"}</td>
                <td className="px-2 text-right">{r.assignedOpen}</td>
                <td className="px-2 text-right">{r.assignedDone}</td>
                <td className={`px-2 text-right ${r.overdue ? "font-semibold text-danger" : ""}`}>{r.overdue}</td>
                <td className="px-2"><div className="flex items-center justify-end gap-2"><Bar percent={r.avgProgress} color="#6366f1" className="w-14" /><span className="w-9 text-right text-xs">{r.assignedOpen + r.assignedDone ? `${r.avgProgress}%` : "—"}</span></div></td>
                <td className="px-2 text-right">{r.comments}</td>
                <td className="px-2 text-right">{r.moves}</td>
                <td className="px-2 text-right">{r.steps}</td>
                <td className="px-2 text-right">{r.activeDays}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={12} className="px-5 py-6 text-center text-muted">No activity in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// The report of every card: who added it, who resolved it, who worked on it, how far it got.
export function CardsReport({ cards, events, names, tz, href, showProject = false }: { cards: (RCard & { projectName?: string })[]; events: REvent[]; names: Map<string, string>; tz: string; href: (c: RCard) => string; showProject?: boolean }) {
  const name = (k: string) => names.get(k) ?? "Former user";
  const byCard = new Map<string, REvent[]>();
  for (const e of events) if (e.cardId) byCard.set(e.cardId, [...(byCard.get(e.cardId) ?? []), e]);
  const sorted = [...cards].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <Card className="p-0">
      <div className="px-5 pt-5"><h3 className="font-semibold">Card report <span className="font-normal text-muted">({cards.length})</span></h3><p className="mt-0.5 text-xs text-muted">Every card: added by, resolved by, who worked on it, and its progress. Newest first.</p></div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="px-5 py-2 font-medium">Card</th><th className="px-2 font-medium">Status</th><th className="px-2 font-medium">Added by</th><th className="px-2 font-medium">Resolved by</th><th className="px-2 font-medium">Time to resolve</th><th className="px-2 font-medium">Worked on by</th><th className="px-2 pr-5 font-medium">Progress</th></tr></thead>
          <tbody className="divide-y divide-line align-top">
            {sorted.map((c) => {
              const people = cardContributors(c, byCard.get(c.id) ?? []);
              const workers = people.filter((p) => p.actions > 0 || p.assigned);
              return (
                <tr key={c.id} className="hover:bg-bg/60">
                  <td className="px-5 py-2"><Link href={href(c)} scroll={false} className="font-medium hover:text-brand hover:underline">{c.title}</Link>{showProject && c.projectName && <span className="block text-xs text-muted">{c.projectName}</span>}</td>
                  <td className="px-2 py-2"><span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: CATEGORY_COLOR[c.category] }} title={CATEGORY_LABEL[c.category]}>{c.listName}</span></td>
                  <td className="px-2 py-2">{name(c.createdById)}<span className="block text-xs text-muted">{when(c.createdAt, tz)}</span></td>
                  <td className="px-2 py-2">{c.category === "DONE" && c.completedAt ? <>{c.completedById ? name(c.completedById) : "—"}<span className="block text-xs text-muted">{when(c.completedAt, tz)}</span></> : <span className="text-muted">Not yet</span>}</td>
                  <td className="px-2 py-2 tabular-nums">{c.category === "DONE" && c.completedAt ? formatHours(Math.max(0, (c.completedAt.getTime() - c.createdAt.getTime()) / 3_600_000)) : "—"}</td>
                  <td className="px-2 py-2 text-xs">{workers.length === 0 ? <span className="text-muted">Nobody yet</span> : workers.slice(0, 4).map((p) => <span key={p.actorId} className="mr-1 inline-block" title={`${name(p.actorId)}: ${p.actions} actions${p.comments ? `, ${p.comments} comments` : ""}${p.assigned ? ", assigned" : ""}`}>{name(p.actorId)}{p.assigned && <span aria-label="assigned"> ◆</span>}{workers.indexOf(p) < Math.min(workers.length, 4) - 1 ? "," : ""}</span>)}{workers.length > 4 && <span className="text-muted"> +{workers.length - 4}</span>}</td>
                  <td className="px-2 py-2 pr-5"><div className="flex items-center gap-2"><Bar percent={c.progress} color={CATEGORY_COLOR[c.category]} className="w-16" /><span className="text-xs tabular-nums text-muted">{c.progress}%</span></div></td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">No cards.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-4 pt-2 text-xs text-muted">◆ = assigned to the card. Time zone and day boundaries follow the company setting.</p>
    </Card>
  );
}
