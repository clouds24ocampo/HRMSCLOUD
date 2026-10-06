import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { describeDays, hasRegular } from "@/lib/schedule";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { addDays, dayKey, daysBetween, formatDay, weekStart } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { RegularScheduleForm, ScheduleForm, type Team } from "./ScheduleForm";
import { CellEditor, CopyWeekForm, RelinkButton } from "./ScheduleCells";
import { teamOf } from "@/lib/schedule";
import { ScheduleTabs } from "@/components/ScheduleTabs";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string; employee?: string }> }) {
  const me = await requireUser("/schedule");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const today = dayKey(new Date(), settings.timezone);
  const ws = weekStart(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const days = daysBetween(ws, addDays(ws, 6));
  const canEdit = me.role.key === ROLES.MANAGER || isHr(me.role.key);

  const scope = await employeeScope(me, mine.id);
  const [people, shifts] = await Promise.all([
    prisma.employee.findMany({
      // AND, not a spread: a spread of {id} would overwrite the visibility rule.
      where: { AND: [scope, { status: { not: "SEPARATED" } }, sp.employee ? { id: sp.employee } : {}] },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, managerId: true, scheduleLinked: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 300,
    }),
    canEdit ? prisma.shiftTemplate.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: { startTime: "asc" } }) : [],
  ]);
  const sched = await loadSchedules(me.organizationId, people.map((p) => p.id), ws, days[6]);
  const resolved = new Map(people.map((p) => [p.id, resolvePerson(sched.get(p.id), days)]));
  const uncovered = people.filter((p) => !hasRegular(sched.get(p.id)?.regulars ?? [], today));
  const link = (w: string) => `/schedule?${new URLSearchParams({ week: w, ...(sp.employee ? { employee: sp.employee } : {}) })}`;
  const shiftOpts = shifts.map((s) => ({ id: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }));
  const personOpts = people.map((p) => ({ id: p.id, label: `${p.lastName}, ${p.firstName}` }));
  const nameOf = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const rows = people.map((p) => ({ id: p.id, managerId: p.managerId, scheduleLinked: p.scheduleLinked }));
  const leaders = [...new Set(people.map((p) => p.managerId).filter((m): m is string => !!m && nameOf.has(m)))];
  const teams: Team[] = leaders.map((id) => ({ id, label: `${nameOf.get(id)}'s team`, members: teamOf(rows, id) }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Schedule"
        subtitle={canEdit ? "The plan: who works which shift. DTR compares it with what was actually worked, to find late, undertime and overtime." : "Your planned shifts. DTR compares them with what you actually worked."}
      />

      <ScheduleTabs active="/schedule" leader={canEdit} />

      {canEdit && uncovered.length > 0 && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">{uncovered.length} {uncovered.length === 1 ? "person has" : "people have"} no regular schedule</p>
          <p className="mt-1 text-muted">Late, undertime and overtime cannot be measured for them until one is set. {uncovered.slice(0, 6).map((p) => `${p.firstName} ${p.lastName}`).join(", ")}{uncovered.length > 6 ? ` and ${uncovered.length - 6} more` : ""}.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={link(addDays(ws, -7))} className={ghostClass}>← Previous</Link>
        <Link href={link(weekStart(today))} className={ghostClass}>This week</Link>
        <Link href={link(addDays(ws, 7))} className={ghostClass}>Next →</Link>
        <p className="ml-1 text-sm font-medium">{formatDay(ws, { month: "short", day: "numeric" })} – {formatDay(days[6], { month: "short", day: "numeric", year: "numeric" })}</p>
        {sp.employee && <Link href="/schedule" className="text-sm font-medium text-muted hover:text-ink">Show everyone</Link>}
        {canEdit && people.length > 0 && <div className="ml-auto"><CopyWeekForm weekStart={ws} peopleIds={people.map((p) => p.id)} /></div>}
      </div>

      {people.length === 0 ? (
        <EmptyState title="No one to schedule yet" hint={canEdit ? "Add employees first." : undefined} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-3 font-medium">Person</th>
                {days.map((d) => (
                  <th key={d} className={`px-2 py-3 text-center font-medium ${d === today ? "text-brand" : ""}`}>{formatDay(d, { weekday: "short", day: "numeric" })}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {people.map((p) => {
                const regs = sched.get(p.id)?.regulars ?? [];
                const cur = [...regs].reverse().find((r) => r.effectiveFrom <= today);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.lastName}, {p.firstName}</p>
                      <p className="text-xs text-muted">{cur ? `${cur.shift.name} · ${describeDays(cur.workDays)}` : "No regular schedule"}</p>
                      {p.managerId && nameOf.has(p.managerId) && (
                        p.scheduleLinked ? (
                          <p className="mt-0.5"><Badge tone="brand">Follows {nameOf.get(p.managerId)!.split(" ")[0]}</Badge></p>
                        ) : (
                          <p className="mt-0.5 flex flex-wrap items-center gap-2"><Badge tone="warning">Custom</Badge>{canEdit && <RelinkButton employeeId={p.id} />}</p>
                        )
                      )}
                    </td>
                    {days.map((d) => {
                      const r = resolved.get(p.id)?.get(d);
                      return (
                        <td key={d} className="px-1.5 py-2 text-center">
                          <CellEditor employeeId={p.id} day={d} weekday={new Date(`${d}T00:00:00Z`).getUTCDay()} shifts={shiftOpts} locked={!canEdit || (d < today && !isHr(me.role.key))}>
                          {r?.shift ? (
                            <span
                              title={`${r.shift.name}${r.source === "override" ? " (changed for this day)" : ""}`}
                              className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${r.source === "override" ? "bg-warning/15 text-warning ring-1 ring-warning/40" : "bg-brand/10 text-brand"}`}
                            >
                              {r.shift.startTime}–{r.shift.endTime}
                            </span>
                          ) : r ? (
                            <span className={`text-xs ${r.source === "override" ? "font-semibold text-warning" : "text-muted"}`}>Off</span>
                          ) : (
                            <span className="text-muted/50">—</span>
                          )}
                          </CellEditor>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            <Badge tone="brand">blue</Badge> regular schedule · <Badge tone="warning">orange</Badge> changed for that day · — nothing scheduled{canEdit ? " · click any day to change it" : ""}
          </p>
        </Card>
      )}

      {canEdit && people.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Regular weekly schedule</h2>
            <p className="mb-4 text-sm text-muted">Set once and it repeats every week. Changing a leader&apos;s schedule updates everyone who follows them. Changing it later starts a new one from that date, so past days are judged by the schedule that applied then.</p>
            <RegularScheduleForm people={personOpts} teams={teams} shifts={shiftOpts} from={today} preselect={sp.employee} />
          </Card>
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Change specific days</h2>
            <p className="mb-4 text-sm text-muted">A swap, an extra shift or a day off. This sits on top of the regular schedule.{isHr(me.role.key) ? "" : " You can change today and later."}</p>
            <ScheduleForm people={personOpts} teams={teams} shifts={shiftOpts} from={ws > today ? ws : today} to={days[6] > today ? days[6] : addDays(today, 6)} preselect={sp.employee} />
          </Card>
        </div>
      )}
    </div>
  );
}
