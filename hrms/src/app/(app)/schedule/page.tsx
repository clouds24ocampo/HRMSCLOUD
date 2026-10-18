import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { describeDays, hasRegular } from "@/lib/schedule";
import { loadSchedules, resolvePerson } from "@/lib/schedule-data";
import { loadTeamDtr } from "@/lib/team-dtr";
import { addDays, dayKey, daysBetween, dbDate, formatDay, formatDuration, formatTime, keyOfDbDate, weekStart, zonedTimeToUtc } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { RegularScheduleForm, ScheduleForm, type Team } from "./ScheduleForm";
import { CellEditor, CopyWeekForm, RelinkButton, type CellActivity } from "./ScheduleCells";
import { teamOf } from "@/lib/schedule";
import { ScheduleTabs } from "@/components/ScheduleTabs";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string; employee?: string }> }) {
  const me = await requireUser("/schedule");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const ws = weekStart(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const days = daysBetween(ws, addDays(ws, 6));
  const canEdit = me.role.key === ROLES.MANAGER || isHr(me.role.key);

  const scope = await employeeScope(me, mine.id);
  const [people, shifts] = await Promise.all([
    prisma.employee.findMany({
      // AND, not a spread: a spread of {id} would overwrite the visibility rule.
      where: { AND: [scope, { status: { not: "SEPARATED" } }, sp.employee ? { id: sp.employee } : {}] },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, managerId: true, scheduleLinked: true, flexible: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 300,
    }),
    canEdit ? prisma.shiftTemplate.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: { startTime: "asc" } }) : [],
  ]);

  const peopleIds = people.map((p) => p.id);
  const [sched, teamDtr, events, leaves] = await Promise.all([
    loadSchedules(me.organizationId, peopleIds, ws, days[6]),
    loadTeamDtr(me.organizationId, peopleIds, ws, days[6], tz, settings.graceMinutes),
    prisma.timeEvent.findMany({
      where: {
        organizationId: me.organizationId,
        employeeId: { in: peopleIds },
        voidedAt: null,
        at: {
          gte: zonedTimeToUtc(addDays(ws, -1), 0, tz),
          lt: zonedTimeToUtc(addDays(days[6], 2), 0, tz),
        },
      },
      include: { stampType: { select: { name: true, icon: true, page: true } } },
      orderBy: { at: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        organizationId: me.organizationId,
        employeeId: { in: peopleIds },
        status: "APPROVED",
        startDate: { lte: dbDate(days[6]) },
        endDate: { gte: dbDate(ws) },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ]);

  const eventsByEmpAndDay = new Map<string, typeof events>();
  for (const e of events) {
    const k = `${e.employeeId}:${dayKey(e.at, tz)}`;
    eventsByEmpAndDay.set(k, [...(eventsByEmpAndDay.get(k) ?? []), e]);
  }

  const leaveSetByEmp = new Map<string, Set<string>>();
  for (const l of leaves) {
    const set = leaveSetByEmp.get(l.employeeId) ?? new Set<string>();
    daysBetween(keyOfDbDate(l.startDate), keyOfDbDate(l.endDate)).forEach((d) => set.add(d));
    leaveSetByEmp.set(l.employeeId, set);
  }

  const resolved = new Map(people.map((p) => [p.id, resolvePerson(sched.get(p.id), days)]));
  const uncovered = people.filter((p) => !p.flexible && !hasRegular(sched.get(p.id)?.regulars ?? [], today));
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
        subtitle={canEdit ? "The plan and actual activity: who works which shift. For flexible workers, finished transactions reflect their exact times." : "Your planned and actual schedule. Flexible schedule shows your finished time transactions."}
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
                const dtrDays = teamDtr.get(p.id) ?? [];

                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{p.lastName}, {p.firstName}</p>
                      {p.flexible ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone="success">Flexible schedule</Badge>
                          <span className="text-xs text-muted">Min 8h/day</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted">{cur ? `${cur.shift.name} · ${describeDays(cur.workDays)}` : "No regular schedule"}</p>
                      )}
                      {p.managerId && nameOf.has(p.managerId) && !p.flexible && (
                        p.scheduleLinked ? (
                          <p className="mt-0.5"><Badge tone="brand">Follows {nameOf.get(p.managerId)!.split(" ")[0]}</Badge></p>
                        ) : (
                          <p className="mt-0.5 flex flex-wrap items-center gap-2"><Badge tone="warning">Custom</Badge>{canEdit && <RelinkButton employeeId={p.id} />}</p>
                        )
                      )}
                    </td>
                    {days.map((d) => {
                      const r = resolved.get(p.id)?.get(d);
                      const dtrDay = dtrDays.find((x) => x.day === d);
                      const dayEvs = eventsByEmpAndDay.get(`${p.id}:${d}`) ?? [];
                      const hasLeave = leaveSetByEmp.get(p.id)?.has(d);
                      const isFinished = !!(dtrDay?.firstIn && dtrDay?.lastOut);
                      const isInProgress = !!(dtrDay?.firstIn && !dtrDay?.lastOut && d <= today);
                      const hasActivity = isFinished || isInProgress || dayEvs.length > 0;

                      const activity: CellActivity | null = hasActivity
                        ? {
                            firstIn: dtrDay?.firstIn ? formatTime(dtrDay.firstIn, tz) : null,
                            lastOut: dtrDay?.lastOut ? formatTime(dtrDay.lastOut, tz) : null,
                            workedMinutes: dtrDay?.workedMinutes ?? 0,
                            workedDuration: formatDuration(dtrDay?.workedMinutes ?? 0),
                            isFinished,
                            isInProgress,
                            events: dayEvs.map((ev) => ({
                              type: ev.type,
                              name: ev.stampType?.name ?? (ev.type === "IN" ? "Time In" : ev.type === "OUT" ? "Time Out" : "Pause"),
                              icon: ev.stampType?.icon ?? (ev.type === "IN" ? "▶️" : ev.type === "OUT" ? "⏹️" : "⏸️"),
                              time: formatTime(ev.at, tz),
                              note: ev.note,
                            })),
                            pauses: dtrDay?.pauses.map((pa) => ({
                              name: pa.name,
                              count: pa.count,
                              minutes: pa.minutes,
                            })),
                          }
                        : null;

                      return (
                        <td key={d} className="px-1.5 py-2 text-center">
                          <CellEditor
                            employeeId={p.id}
                            day={d}
                            weekday={new Date(`${d}T00:00:00Z`).getUTCDay()}
                            shifts={shiftOpts}
                            locked={!canEdit || (d < today && !isHr(me.role.key))}
                            activity={activity}
                          >
                            {/* 1. FLEXIBLE SCHEDULE */}
                            {p.flexible ? (
                              isFinished ? (
                                <span
                                  title={`Finished transaction: ${activity?.firstIn} – ${activity?.lastOut} · ${activity?.workedDuration} worked`}
                                  className="inline-flex flex-col items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-1 text-center text-xs font-semibold text-emerald-800 shadow-2xs transition hover:border-emerald-400"
                                >
                                  <span className="whitespace-nowrap">{activity?.firstIn}–{activity?.lastOut}</span>
                                  <span className="text-[10px] font-medium text-emerald-700 tabular-nums">
                                    {activity?.workedDuration}
                                    {dtrDay && dtrDay.pauses.length > 0 && <span className="ml-1 text-[9px] text-emerald-600">({dtrDay.pauses.length}p)</span>}
                                  </span>
                                </span>
                              ) : isInProgress ? (
                                <span
                                  title={`In progress since ${activity?.firstIn} · ${activity?.workedDuration} so far`}
                                  className="inline-flex flex-col items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-2 py-1 text-center text-xs font-semibold text-blue-800 shadow-2xs"
                                >
                                  <span className="flex items-center gap-1 whitespace-nowrap">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                                    {activity?.firstIn}–Now
                                  </span>
                                  <span className="text-[10px] font-medium text-blue-600 tabular-nums">
                                    {activity?.workedDuration} so far
                                  </span>
                                </span>
                              ) : r?.source === "override" ? (
                                r.shift ? (
                                  <span
                                    title={`Override: ${r.shift.name} (${r.shift.startTime}–${r.shift.endTime})`}
                                    className="inline-block rounded-lg border border-warning/40 bg-warning/15 px-2 py-1 text-xs font-semibold text-warning"
                                  >
                                    {r.shift.startTime}–{r.shift.endTime}
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-warning">Day off</span>
                                )
                              ) : hasLeave ? (
                                <span className="inline-block rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                                  Leave
                                </span>
                              ) : d < today ? (
                                <span className="text-xs text-muted/60">Rest day</span>
                              ) : d === today ? (
                                <span
                                  title="Flexible schedule: minimum 8 hours per working day"
                                  className="inline-block rounded-lg border border-brand/30 bg-brand/5 px-2 py-1 text-xs font-medium text-brand"
                                >
                                  Flexible (8h)
                                </span>
                              ) : (
                                <span
                                  title="Future flexible schedule day"
                                  className="inline-block rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-muted hover:border-brand/40"
                                >
                                  Flexible (8h)
                                </span>
                              )
                            ) : (
                              /* 2. REGULAR SCHEDULE */
                              r?.shift ? (
                                <span
                                  title={`${r.shift.name}${r.source === "override" ? " (changed for this day)" : ""}${isFinished ? ` · Actual: ${activity?.firstIn}–${activity?.lastOut} (${activity?.workedDuration})` : ""}`}
                                  className={`inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold ${
                                    r.source === "override"
                                      ? "border border-warning/40 bg-warning/15 text-warning ring-1 ring-warning/40"
                                      : "border border-brand/20 bg-brand/10 text-brand"
                                  }`}
                                >
                                  <span className="whitespace-nowrap">{r.shift.startTime}–{r.shift.endTime}</span>
                                  {isFinished && (
                                    <span className="text-[10px] font-medium text-emerald-700 tabular-nums">
                                      ✓ {activity?.workedDuration}
                                    </span>
                                  )}
                                </span>
                              ) : hasLeave ? (
                                <span className="inline-block rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                                  Leave
                                </span>
                              ) : r ? (
                                <span className={`text-xs ${r.source === "override" ? "font-semibold text-warning" : "text-muted"}`}>Off</span>
                              ) : (
                                <span className="text-muted/50">—</span>
                              )
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
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span className="flex items-center gap-1.5"><Badge tone="success">green</Badge> Finished transaction (actual time in & out)</span>
            <span className="flex items-center gap-1.5"><Badge tone="brand">blue</Badge> Regular shift / flexible active</span>
            <span className="flex items-center gap-1.5"><Badge tone="warning">orange</Badge> Changed for that day</span>
            <span className="flex items-center gap-1.5"><Badge tone="neutral">purple</Badge> Approved leave</span>
            {canEdit ? <span className="ml-auto text-muted">Click any day to view details or change schedule</span> : <span className="ml-auto text-muted">Click any day to view transaction timeline</span>}
          </div>
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
